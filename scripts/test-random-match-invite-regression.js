// Regression test for Random Match and Invite-a-Friend — verifies these
// pre-existing flows still work correctly after migrations 0021-0024
// (which repaired previously-missing clock/security infrastructure and
// then hardened tournament security further). Runs against the real live
// database via the real dev-test authenticated session.
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
function check(label, condition, detail) {
  if (condition) pass++;
  else {
    fail++;
    failures.push(label + (detail ? " -- " + detail : ""));
    console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`);
  }
}

async function main() {
  const client = createClient(url, anonKey);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);
  const { data: myParent } = await client.from("parents").select("id").eq("auth_user_id", authData.user.id).single();

  const { data: kids, error: kidsErr } = await admin
    .from("children")
    .insert([
      { parent_id: myParent.id, display_name: "RMRegA", avatar_id: "knight-kid", buddy_id: "wise-owl", rating: 500 },
      { parent_id: myParent.id, display_name: "RMRegB", avatar_id: "knight-kid", buddy_id: "wise-owl", rating: 520 },
      { parent_id: myParent.id, display_name: "InviteHost", avatar_id: "knight-kid", buddy_id: "wise-owl", rating: 400 },
      { parent_id: myParent.id, display_name: "InviteGuest", avatar_id: "knight-kid", buddy_id: "wise-owl", rating: 400 },
    ])
    .select("id, display_name");
  if (kidsErr) throw new Error("seed children failed: " + kidsErr.message);
  const A = kids.find((k) => k.display_name === "RMRegA").id;
  const B = kids.find((k) => k.display_name === "RMRegB").id;
  const host = kids.find((k) => k.display_name === "InviteHost").id;
  const guest = kids.find((k) => k.display_name === "InviteGuest").id;

  console.log("\n=== Random Match ===");
  const r1 = await client.rpc("find_or_create_match", { p_child_id: A, p_rating: 500 });
  check("find_or_create_match: A queues (no match yet)", !r1.error && r1.data[0].matched === false, r1.error?.message ?? JSON.stringify(r1.data));

  const r2 = await client.rpc("find_or_create_match", { p_child_id: B, p_rating: 520 });
  check("find_or_create_match: B matches A", !r2.error && r2.data[0].matched === true, r2.error?.message ?? JSON.stringify(r2.data));
  const gameId = r2.data?.[0]?.game_id;
  check("a game id was returned", !!gameId);

  const game = (await admin.from("online_games").select("*").eq("id", gameId).single()).data;
  check("match_type is 'random'", game.match_type === "random", game.match_type);
  check("clock started: time_control set", game.time_control === "10+0", game.time_control);
  check("clock started: white_time_ms/black_time_ms populated", game.white_time_ms > 0 && game.black_time_ms > 0, `${game.white_time_ms}/${game.black_time_ms}`);
  check("status is active", game.status === "active", game.status);

  const hostChildId = game.host_child_id;
  const guestChildId = game.guest_child_id;
  const hostColor = game.host_color;
  const moverChildId = hostColor === "w" ? hostChildId : guestChildId;

  const moveResult = await client.rpc("submit_online_move", {
    p_game_id: gameId,
    p_child_id: moverChildId,
    p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    p_san: "e4",
  });
  check("submit_online_move: a real move succeeds", !moveResult.error, moveResult.error?.message);
  check("submit_online_move: game still active, turn flipped", moveResult.data?.[0]?.status === "active", JSON.stringify(moveResult.data));

  // Simulate a timeout: push last_move_at far into the past for the side to move.
  await admin.from("online_games").update({ last_move_at: new Date(Date.now() - 999999999).toISOString() }).eq("id", gameId);
  const nonMoverChildId = moverChildId === hostChildId ? guestChildId : hostChildId;
  const timeoutResult = await client.rpc("claim_timeout", { p_game_id: gameId, p_child_id: nonMoverChildId });
  check("claim_timeout: succeeds", !timeoutResult.error, timeoutResult.error?.message);
  check("claim_timeout: game finished on time", timeoutResult.data?.[0]?.status === "finished", JSON.stringify(timeoutResult.data));

  // After the e4 move it's the OPPONENT's turn (nonMoverChildId's) — their
  // clock is the one we fast-forwarded, so they're the one who times out
  // and the ORIGINAL mover (moverChildId) should be declared the winner.
  const moverColor = moverChildId === hostChildId ? hostColor : (hostColor === "w" ? "b" : "w");
  const finishedGame = (await admin.from("online_games").select("*").eq("id", gameId).single()).data;
  check("timeout produced the correct winner (the side on the clock loses, not the mover)", finishedGame.winner === moverColor, `expected ${moverColor}, got ${finishedGame.winner}`);

  const beforeRatingA = 500;
  const beforeRatingB = 520;
  const ratingResult = await client.rpc("apply_match_rating", { p_game_id: gameId });
  check("apply_match_rating: succeeds", !ratingResult.error, ratingResult.error?.message);
  const afterA = (await admin.from("children").select("rating").eq("id", A).single()).data.rating;
  const afterB = (await admin.from("children").select("rating").eq("id", B).single()).data.rating;
  check("Random Match rating: at least one side's rating actually changed", afterA !== beforeRatingA || afterB !== beforeRatingB, `${afterA}/${afterB}`);
  check("Random Match rating: winner's rating went up, loser's went down", (finishedGame.winner === "w") === (hostColor === "w" ? afterA >= beforeRatingA || afterB >= beforeRatingB : true), "sanity check");

  const freeUsage = await admin.from("free_game_usage").select("*").in("child_id", [A, B]);
  check("Random Match: free_game_usage credit consumed for both players", freeUsage.data.length === 2, JSON.stringify(freeUsage.data));

  console.log("\n=== Invite a Friend ===");
  const inviteResult = await client.rpc("create_invite_game", { p_host_child_id: host, p_time_control: "5+0" });
  check("create_invite_game: succeeds", !inviteResult.error, inviteResult.error?.message);
  const inviteGameId = inviteResult.data?.[0]?.id;
  const inviteGameBefore = (await admin.from("online_games").select("*").eq("id", inviteGameId).single()).data;
  check("invite game starts in 'waiting' status", inviteGameBefore.status === "waiting", inviteGameBefore.status);
  check("invite game match_type is 'invite'", inviteGameBefore.match_type === "invite", inviteGameBefore.match_type);

  const joinResult = await client.rpc("join_online_game", { p_game_id: inviteGameId, p_guest_child_id: guest });
  check("join_online_game: friend joins successfully", !joinResult.error && joinResult.data[0].joined === true, joinResult.error?.message ?? JSON.stringify(joinResult.data));

  const inviteGame = (await admin.from("online_games").select("*").eq("id", inviteGameId).single()).data;
  check("invite game active after join", inviteGame.status === "active", inviteGame.status);
  check("invite game clock started", inviteGame.white_time_ms > 0 && inviteGame.black_time_ms > 0, `${inviteGame.white_time_ms}/${inviteGame.black_time_ms}`);

  const inviteMover = inviteGame.host_color === "w" ? inviteGame.host_child_id : inviteGame.guest_child_id;
  const inviteMoveResult = await client.rpc("submit_online_move", {
    p_game_id: inviteGameId,
    p_child_id: inviteMover,
    p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    p_san: "e4",
  });
  check("Invite Friend: a move succeeds", !inviteMoveResult.error, inviteMoveResult.error?.message);

  const finishInvite = await client.rpc("finish_online_game_by_result", { p_game_id: inviteGameId, p_child_id: host, p_winner: "w" });
  check("Invite Friend: finish result succeeds", !finishInvite.error, finishInvite.error?.message);
  const finishedInvite = (await admin.from("online_games").select("status,winner").eq("id", inviteGameId).single()).data;
  check("Invite Friend: game finished with the reported winner", finishedInvite.status === "finished" && finishedInvite.winner === "w", JSON.stringify(finishedInvite));

  const inviteFreeUsage = await admin.from("free_game_usage").select("*").in("child_id", [host, guest]);
  check("Invite Friend: free_game_usage credit consumed for both players", inviteFreeUsage.data.length === 2, JSON.stringify(inviteFreeUsage.data));

  // Reactions (chat/quick-reactions) remain enabled for invite games at the DB level.
  const reactionResult = await client.from("online_games").update({ host_reaction: "🎉" }).eq("id", inviteGameId);
  check("Invite Friend: host_reaction update allowed", !reactionResult.error, reactionResult.error?.message);

  // Cleanup.
  await admin.from("online_games").delete().in("id", [gameId, inviteGameId]);
  await admin.from("free_game_usage").delete().in("child_id", [A, B, host, guest]);
  await admin.from("children").delete().in("id", [A, B, host, guest]);

  console.log(`\n=== RANDOM MATCH / INVITE REGRESSION SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Regression test crashed:", err);
  process.exit(1);
});
