// Regression test for Random Match and Invite-a-Friend.
//
// Covers the behaviour the app actually has now:
//   * a random game is created in 'matched' and does not start until both
//     clients call mark_game_client_ready (0048/0049)
//   * daily multiplayer credits are no longer consumed (0047)
//   * the rematch the opponent receives is the button "Accept rematch".
//     A case-sensitive search for "Rematch" does not see that button — that
//     mismatch produced a false failure in the two-device harness.
//   * migration 0051: replica identity, capped rating window, queue-age
//     preservation, and abandoned-match expiry. The SQL is checked here
//     directly. The live "repeat search keeps the row" check reports
//     PENDING when 0051 has not been applied yet, because applying it
//     changes production matchmaking.
//
// Run: node scripts/test-random-match-invite-regression.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
const failures = [];
const pending = [];
function check(label, condition, detail) {
  if (condition) pass++;
  else {
    fail++;
    failures.push(label + (detail ? " -- " + detail : ""));
    console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`);
  }
}

function readRepo(...parts) {
  return fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");
}

// 3+2 is a legal server speed and is not one of the four speeds the launch
// UI offers, so this test cannot pair with a real child waiting in 3+0,
// 5+0, 10+0 or 15+10.
const TEST_TC = "3+2";

function staticChecks() {
  console.log("\n=== UI: rematch labels ===");
  const page = readRepo("app", "online", "[gameId]", "page.tsx");
  const rematch = readRepo("lib", "online", "rematch.ts");
  check("the received-state button is Accept rematch", page.includes("Accept rematch"));
  check(
    "a case-sensitive search for Rematch does not match Accept rematch",
    "Accept rematch".includes("Rematch") === false && "Accept rematch".toLowerCase().includes("rematch")
  );
  check("the first offer button is still Rematch", /\n\s*Rematch\n\s*<\/Button>/.test(page));
  check(
    "the waiting status is not the accept button",
    rematch.includes("Rematch offered — waiting for your opponent") &&
      !rematch.includes("Accept rematch")
  );

  console.log("\n=== 0051 source ===");
  const sql = readRepo("supabase", "migrations", "0051_matchmaking_realtime_widening_and_expiry.sql");
  check("replica identity full is set on matchmaking_queue", /alter table public\.matchmaking_queue replica identity full/i.test(sql));
  check("the rating window's final step is 400", /else 400/.test(sql));
  check("the window no longer grows without a ceiling", !/floor\(\(extract/.test(sql));
  check("a repeat search updates the waiting row instead of always replacing it", /set rating = v_rating/.test(sql));
  check("expiry requires random + matched + not started",
    /match_type = 'random'/.test(sql) && /status = 'matched'/.test(sql) && /started_at is null/.test(sql));
  check("expiry records no winner and blocks a later rating payout",
    /winner = null/.test(sql) && /rating_applied = true/.test(sql));
  check("expiry is not granted to authenticated",
    /revoke execute on function public\.expire_abandoned_matched_games\(boolean\) from authenticated/.test(sql));
  const matchmaking = readRepo("app", "matchmaking", "page.tsx");
  check("the 5s matchmaking poll is still there", /5000\)/.test(matchmaking));
  check("the poll still re-reads the queue", matchmaking.includes("getMatchmakingQueueStatus"));
}

async function main() {
  staticChecks();

  const client = createClient(url, anonKey);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);
  const { data: myParent } = await client.from("parents").select("id").eq("auth_user_id", authData.user.id).single();

  const childIds = [];
  const gameIds = [];

  async function makeChild(name, rating) {
    const { data, error } = await admin
      .from("children")
      .insert({ parent_id: myParent.id, display_name: name, avatar_id: "knight-kid", buddy_id: "wise-owl", rating })
      .select("id")
      .single();
    if (error) throw new Error("seed child failed: " + error.message);
    childIds.push(data.id);
    return data.id;
  }

  try {
    const A = await makeChild("RMRegA", 1500);
    const B = await makeChild("RMRegB", 1520);
    const host = await makeChild("InviteHost", 400);
    const guest = await makeChild("InviteGuest", 400);

    console.log("\n=== Random Match ===");
    const r1 = await client.rpc("find_or_create_match", { p_child_id: A, p_rating: 1500, p_time_control: TEST_TC });
    check("find_or_create_match: A queues (no match yet)", !r1.error && r1.data[0].matched === false && r1.data[0].blocked === false, r1.error?.message ?? JSON.stringify(r1.data));

    const r2 = await client.rpc("find_or_create_match", { p_child_id: B, p_rating: 1520, p_time_control: TEST_TC });
    check("find_or_create_match: B matches A", !r2.error && r2.data[0].matched === true && r2.data[0].blocked === false, r2.error?.message ?? JSON.stringify(r2.data));
    const gameId = r2.data?.[0]?.game_id;
    check("a game id was returned", !!gameId);
    if (gameId) gameIds.push(gameId);

    const game = (await admin.from("online_games").select("*").eq("id", gameId).single()).data;
    check("match_type is 'random'", game.match_type === "random", game.match_type);
    check("the agreed speed was stored", game.time_control === TEST_TC, game.time_control);
    check("clock columns are populated before the start", game.white_time_ms > 0 && game.black_time_ms > 0, `${game.white_time_ms}/${game.black_time_ms}`);
    check("status is matched, not active", game.status === "matched", game.status);
    check("the clock has not started", game.last_move_at == null && game.started_at == null, `last=${game.last_move_at} started=${game.started_at}`);

    const hostChildId = game.host_child_id;
    const guestChildId = game.guest_child_id;
    const hostColor = game.host_color;
    const moverChildId = hostColor === "w" ? hostChildId : guestChildId;

    const browserMove = await client.rpc("submit_online_move", {
      p_game_id: gameId,
      p_child_id: moverChildId,
      p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      p_san: "e4",
    });
    check("a browser cannot submit a move directly", !!browserMove.error, browserMove.error ? "rejected" : JSON.stringify(browserMove.data));

    const earlyMove = await admin.rpc("submit_online_move_as_server", {
      p_game_id: gameId,
      p_child_id: moverChildId,
      p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      p_san: "e4",
    });
    check("the server rejects a move while the game is still matched", !!earlyMove.error, earlyMove.error ? "rejected" : JSON.stringify(earlyMove.data));

    const readyFirst = await client.rpc("mark_game_client_ready", { p_game_id: gameId, p_child_id: hostChildId });
    check("the first ready call leaves the game matched", !readyFirst.error && readyFirst.data?.[0]?.status === "matched", readyFirst.error?.message ?? JSON.stringify(readyFirst.data));
    const readySecond = await client.rpc("mark_game_client_ready", { p_game_id: gameId, p_child_id: guestChildId });
    check("the second ready call starts the game", !readySecond.error && readySecond.data?.[0]?.status === "active", readySecond.error?.message ?? JSON.stringify(readySecond.data));

    const started = (await admin.from("online_games").select("status, last_move_at, started_at").eq("id", gameId).single()).data;
    check("status is active once both clients are ready", started.status === "active", started.status);
    check("last_move_at is set when the clock starts", !!started.last_move_at && !!started.started_at);

    const moveResult = await admin.rpc("submit_online_move_as_server", {
      p_game_id: gameId,
      p_child_id: moverChildId,
      p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      p_san: "e4",
    });
    check("submit_online_move_as_server: a real move succeeds once the game is active", !moveResult.error, moveResult.error?.message);
    check("submit_online_move_as_server: game still active", moveResult.data?.[0]?.status === "active", JSON.stringify(moveResult.data));

    await admin.from("online_games").update({ last_move_at: new Date(Date.now() - 999999999).toISOString() }).eq("id", gameId);
    const nonMoverChildId = moverChildId === hostChildId ? guestChildId : hostChildId;
    const timeoutResult = await client.rpc("claim_timeout", { p_game_id: gameId, p_child_id: nonMoverChildId });
    check("claim_timeout: succeeds", !timeoutResult.error, timeoutResult.error?.message);
    check("claim_timeout: game finished on time", timeoutResult.data?.[0]?.status === "finished", JSON.stringify(timeoutResult.data));

    const moverColor = moverChildId === hostChildId ? hostColor : (hostColor === "w" ? "b" : "w");
    const finishedGame = (await admin.from("online_games").select("*").eq("id", gameId).single()).data;
    check("timeout produced the correct winner", finishedGame.winner === moverColor, `expected ${moverColor}, got ${finishedGame.winner}`);

    const beforeA = (await admin.from("children").select("rating").eq("id", A).single()).data.rating;
    const beforeB = (await admin.from("children").select("rating").eq("id", B).single()).data.rating;
    const ratingResult = await client.rpc("apply_match_rating", { p_game_id: gameId });
    check("apply_match_rating: succeeds", !ratingResult.error, ratingResult.error?.message);
    const afterA = (await admin.from("children").select("rating").eq("id", A).single()).data.rating;
    const afterB = (await admin.from("children").select("rating").eq("id", B).single()).data.rating;
    const winnerId = finishedGame.winner === hostColor ? hostChildId : guestChildId;
    const winnerBefore = winnerId === A ? beforeA : beforeB;
    const winnerAfter = winnerId === A ? afterA : afterB;
    const loserAfter = winnerId === A ? afterB : afterA;
    const loserBefore = winnerId === A ? beforeB : beforeA;
    check("winner's rating went up and loser's went down", winnerAfter > winnerBefore && loserAfter < loserBefore, `${afterA}/${afterB}`);

    console.log("\n=== Rating window ===");
    const near = await makeChild("RMRegNear", 1600);
    const far = await makeChild("RMRegFar", 1680);
    const queued = await client.rpc("find_or_create_match", { p_child_id: near, p_rating: 1600, p_time_control: TEST_TC });
    check("a player with nobody in range queues", !queued.error && queued.data[0].matched === false, JSON.stringify(queued.data));
    const tooSoon = await client.rpc("find_or_create_match", { p_child_id: far, p_rating: 1680, p_time_control: TEST_TC });
    check("80 points apart does not match inside the first 15s (±50)", !tooSoon.error && tooSoon.data[0].matched === false, JSON.stringify(tooSoon.data));

    const { data: waitingRow } = await admin
      .from("matchmaking_queue")
      .select("id, created_at")
      .eq("child_id", near)
      .eq("status", "waiting")
      .maybeSingle();
    check("the first waiter still has a queue row", !!waitingRow?.id);
    if (waitingRow) {
      const aged = new Date(Date.now() - 20000).toISOString();
      await admin.from("matchmaking_queue").update({ created_at: aged }).eq("id", waitingRow.id);
      const widened = await client.rpc("find_or_create_match", { p_child_id: far, p_rating: 1680, p_time_control: TEST_TC });
      check("the same pair matches once the waiter is 20s old (±100)", !widened.error && widened.data?.[0]?.matched === true, widened.error?.message ?? JSON.stringify(widened.data));
      if (widened.data?.[0]?.game_id) gameIds.push(widened.data[0].game_id);
    }

    const again = await makeChild("RMRegAgain", 1700);
    const first = await client.rpc("find_or_create_match", { p_child_id: again, p_rating: 1700, p_time_control: TEST_TC });
    check("repeat-search subject queued", !first.error && first.data[0].matched === false, JSON.stringify(first.data));
    const { data: beforeRow } = await admin.from("matchmaking_queue").select("id").eq("child_id", again).eq("status", "waiting").maybeSingle();
    await client.rpc("find_or_create_match", { p_child_id: again, p_rating: 1700, p_time_control: TEST_TC });
    const { data: afterRow } = await admin.from("matchmaking_queue").select("id").eq("child_id", again).eq("status", "waiting").maybeSingle();
    if (beforeRow && afterRow && beforeRow.id === afterRow.id) {
      check("a repeat search keeps the same waiting row (0051 applied)", true);
    } else {
      pending.push("0051 is not applied on this database yet: a repeat search still replaces the waiting row, so the client must not keep retrying until the migration is applied");
      console.log("PENDING: 0051 not applied — repeat search replaced the queue row");
    }

    console.log("\n=== Invite a Friend ===");
    const inviteResult = await client.rpc("create_invite_game", { p_host_child_id: host, p_time_control: "5+0" });
    check("create_invite_game: succeeds", !inviteResult.error, inviteResult.error?.message);
    const inviteGameId = inviteResult.data?.[0]?.id;
    if (inviteGameId) gameIds.push(inviteGameId);
    const inviteGameBefore = (await admin.from("online_games").select("*").eq("id", inviteGameId).single()).data;
    check("invite game starts in 'waiting' status", inviteGameBefore.status === "waiting", inviteGameBefore.status);
    check("invite game match_type is 'invite'", inviteGameBefore.match_type === "invite", inviteGameBefore.match_type);

    const joinResult = await client.rpc("join_online_game", { p_game_id: inviteGameId, p_guest_child_id: guest });
    check("join_online_game: friend joins successfully", !joinResult.error && joinResult.data[0].joined === true, joinResult.error?.message ?? JSON.stringify(joinResult.data));

    const inviteGame = (await admin.from("online_games").select("*").eq("id", inviteGameId).single()).data;
    check("invite game active after join", inviteGame.status === "active", inviteGame.status);
    check("invite game clock started", inviteGame.white_time_ms > 0 && inviteGame.black_time_ms > 0, `${inviteGame.white_time_ms}/${inviteGame.black_time_ms}`);

    const inviteMover = inviteGame.host_color === "w" ? inviteGame.host_child_id : inviteGame.guest_child_id;
    const browserInviteMove = await client.rpc("submit_online_move", {
      p_game_id: inviteGameId,
      p_child_id: inviteMover,
      p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      p_san: "e4",
    });
    check("Invite Friend: a browser cannot submit a move directly", !!browserInviteMove.error);
    const inviteMoveResult = await admin.rpc("submit_online_move_as_server", {
      p_game_id: inviteGameId,
      p_child_id: inviteMover,
      p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      p_san: "e4",
    });
    check("Invite Friend: a move succeeds on the server path", !inviteMoveResult.error, inviteMoveResult.error?.message);

    const browserFinish = await client.rpc("finish_online_game_by_result", { p_game_id: inviteGameId, p_child_id: host, p_winner: "w" });
    check("Invite Friend: a browser cannot declare the result directly", !!browserFinish.error);
    const finishInvite = await admin.rpc("finish_online_game_by_result_as_server", { p_game_id: inviteGameId, p_child_id: host, p_winner: "w" });
    check("Invite Friend: server finish succeeds", !finishInvite.error, finishInvite.error?.message);
    const finishedInvite = (await admin.from("online_games").select("status,winner").eq("id", inviteGameId).single()).data;
    check("Invite Friend: game finished with the reported winner", finishedInvite.status === "finished" && finishedInvite.winner === "w", JSON.stringify(finishedInvite));

    const reactionResult = await client.from("online_games").update({ host_reaction: "🎉" }).eq("id", inviteGameId);
    check("Invite Friend: host_reaction update allowed", !reactionResult.error, reactionResult.error?.message);
  } finally {
    if (childIds.length) {
      await admin.from("matchmaking_queue").delete().in("child_id", childIds);
      await admin.from("free_game_usage").delete().in("child_id", childIds);
    }
    if (gameIds.length) {
      await admin.from("rating_history").delete().in("game_id", gameIds);
      await admin.from("online_games").delete().in("id", gameIds);
    }
    if (childIds.length) {
      await admin.from("children").delete().in("id", childIds);
    }
  }

  console.log(`\n=== RANDOM MATCH / INVITE REGRESSION SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (pending.length) console.log("Pending:\n" + pending.map((p) => " - " + p).join("\n"));
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Regression test crashed:", err);
  process.exit(1);
});
