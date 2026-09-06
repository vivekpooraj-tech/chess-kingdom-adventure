/**
 * End-to-end lifecycle of a rated online game.
 *
 *   node scripts/test-online-lifecycle.js
 *
 * MATCH -> GAME -> CLOCK -> FINISH -> RATING -> RATING HISTORY -> STATS
 *
 * This exists because the rating pipeline has never actually run. Every game in
 * the database is match_type 'invite', and apply_match_rating deliberately
 * ignores those, so rating_history has zero rows and the whole rated path was
 * unverified code. Logic that has never executed is not "working"; it is
 * untested.
 *
 * Fixtures are tracked at creation and removed in a finally, deleting by
 * explicit id only — never by name prefix — per the convention adopted after
 * the RS_* fixture leak. The suite asserts its own cleanup at the end.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require(path.join(process.cwd(), "node_modules", "@supabase/supabase-js"));

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const RUN = Math.random().toString(36).slice(2, 8);
let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? pass++ : failures.push(d ? `${n} (${d})` : n));

const createdChildren = new Set();
const createdGames = new Set();

async function signIn() {
  const { error } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (error) throw new Error("sign-in failed: " + error.message);
}

async function parentId() {
  const { data } = await admin
    .from("children")
    .select("parent_id")
    .eq("display_name", "Dev Test Child")
    .single();
  return data.parent_id;
}

async function makeChild(label, rating) {
  const parent_id = await parentId();
  const { data, error } = await admin
    .from("children")
    .insert({
      parent_id,
      display_name: `LC_${label}~${RUN}`.slice(0, 40),
      avatar_id: "knight-kid",
      buddy_id: "wise-owl",
      rating,
    })
    .select("id, rating")
    .single();
  if (error) throw new Error("makeChild: " + error.message);
  createdChildren.add(data.id);
  return data;
}

async function makeGame(hostId, guestId, { timeControl = "5+0", matchType = "random", hostColor = "w" } = {}) {
  const { data, error } = await admin
    .from("online_games")
    .insert({
      host_child_id: hostId,
      guest_child_id: guestId,
      host_color: hostColor,
      status: "active",
      match_type: matchType,
      time_control: timeControl,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      last_move_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error("makeGame: " + error.message);
  createdGames.add(data.id);
  return data;
}

const ratingOf = async (id) =>
  (await admin.from("children").select("rating").eq("id", id).single()).data.rating;

async function cleanup() {
  const gameIds = [...createdGames];
  const childIds = [...createdChildren];
  const problems = [];

  try {
    if (childIds.length) {
      await admin
        .from("rating_history")
        .delete()
        .or(childIds.map((id) => `child_id.eq.${id}`).join(","));
      for (const id of childIds) {
        await admin.from("rating_history").delete().eq("opponent_child_id", id);
        await admin.from("matchmaking_queue").delete().eq("child_id", id);
      }
    }
    if (gameIds.length) await admin.from("online_games").delete().in("id", gameIds);
    for (const id of childIds) {
      await admin.from("online_games").delete().or(`host_child_id.eq.${id},guest_child_id.eq.${id}`);
      await admin.from("children").delete().eq("id", id);
    }
  } catch (e) {
    problems.push(e.message);
  }

  // Assert cleanup rather than assume it.
  if (childIds.length) {
    const { data: kids } = await admin.from("children").select("id").in("id", childIds);
    if (kids?.length) problems.push(`${kids.length} fixture children remain`);
    const { data: rh } = await admin
      .from("rating_history")
      .select("id")
      .or(childIds.map((id) => `child_id.eq.${id}`).join(","));
    if (rh?.length) problems.push(`${rh.length} rating_history rows remain`);
  }
  if (gameIds.length) {
    const { data: gs } = await admin.from("online_games").select("id").in("id", gameIds);
    if (gs?.length) problems.push(`${gs.length} games remain`);
  }

  if (problems.length) {
    console.error("CLEANUP INCOMPLETE:\n  " + problems.join("\n  "));
    process.exitCode = 1;
  } else {
    console.log(`cleaned up ${childIds.length} children, ${gameIds.length} games (run ${RUN})`);
  }
  createdChildren.clear();
  createdGames.clear();
}

async function runSuite() {
  await signIn();

  // ---- A: a rated game updates both ratings and writes history ----
  {
    const host = await makeChild("H", 800);
    const guest = await makeChild("G", 800);
    const game = await makeGame(host.id, guest.id);

    check("a random match starts unrated", game.rating_applied === false);
    check("the clock initialised from the time control", game.initial_time_ms === 300000);

    // Host (White) wins.
    await admin
      .from("online_games")
      .update({ status: "finished", winner: "w" })
      .eq("id", game.id);

    const { error } = await client.rpc("apply_match_rating", { p_game_id: game.id });
    check("apply_match_rating succeeds", !error, error?.message);

    const hostAfter = await ratingOf(host.id);
    const guestAfter = await ratingOf(guest.id);
    check("the winner gains rating", hostAfter > 800, `${hostAfter}`);
    check("the loser loses rating", guestAfter < 800, `${guestAfter}`);
    // Equal ratings, K=32: +16 / -16.
    check("equal opponents move by K/2", hostAfter === 816 && guestAfter === 784, `${hostAfter}/${guestAfter}`);
    check("rating is conserved between the two players",
      hostAfter - 800 === -(guestAfter - 800));

    const { data: after } = await admin
      .from("online_games")
      .select("rating_applied, host_rating_before, host_rating_after, guest_rating_before, guest_rating_after")
      .eq("id", game.id)
      .single();
    check("the game is flagged rated", after.rating_applied === true);
    check("before/after values are stored for the result screen",
      after.host_rating_before === 800 && after.host_rating_after === 816 &&
      after.guest_rating_before === 800 && after.guest_rating_after === 784);

    const { data: history } = await admin
      .from("rating_history")
      .select("child_id, old_rating, new_rating, rating_change, result, opponent_child_id")
      .eq("game_id", game.id);
    check("rating history records both players", (history ?? []).length === 2, String(history?.length));
    const hostRow = history?.find((r) => r.child_id === host.id);
    const guestRow = history?.find((r) => r.child_id === guest.id);
    check("the winner's row says win", hostRow?.result === "win", hostRow?.result);
    check("the loser's row says loss", guestRow?.result === "loss", guestRow?.result);
    check("history records the real delta", hostRow?.rating_change === 16 && guestRow?.rating_change === -16);
    check("history records the opponent", hostRow?.opponent_child_id === guest.id);

    // ---- B: applying twice must not double-rate ----
    await client.rpc("apply_match_rating", { p_game_id: game.id });
    check("a second application changes nothing", (await ratingOf(host.id)) === hostAfter);
    const { data: history2 } = await admin.from("rating_history").select("id").eq("game_id", game.id);
    check("a second application writes no extra history", (history2 ?? []).length === 2);
  }

  // ---- C: a draw splits nothing when ratings are equal ----
  {
    const a = await makeChild("DA", 700);
    const b = await makeChild("DB", 700);
    const g = await makeGame(a.id, b.id);
    await admin.from("online_games").update({ status: "finished", winner: "draw" }).eq("id", g.id);
    await client.rpc("apply_match_rating", { p_game_id: g.id });
    check("an equal draw leaves ratings unchanged",
      (await ratingOf(a.id)) === 700 && (await ratingOf(b.id)) === 700);
    const { data: h } = await admin.from("rating_history").select("result").eq("game_id", g.id);
    check("a draw still records history", (h ?? []).length === 2);
    check("both rows say draw", (h ?? []).every((r) => r.result === "draw"));
  }

  // ---- D: invite games are never rated ----
  {
    const a = await makeChild("IA", 900);
    const b = await makeChild("IB", 900);
    const g = await makeGame(a.id, b.id, { matchType: "invite" });
    await admin.from("online_games").update({ status: "finished", winner: "w" }).eq("id", g.id);
    await client.rpc("apply_match_rating", { p_game_id: g.id });
    check("an invite game does not move ratings",
      (await ratingOf(a.id)) === 900 && (await ratingOf(b.id)) === 900);
    const { data: h } = await admin.from("rating_history").select("id").eq("game_id", g.id);
    check("an invite game writes no rating history", (h ?? []).length === 0);
  }

  // ---- E: an unfinished game is never rated ----
  {
    const a = await makeChild("UA", 650);
    const b = await makeChild("UB", 650);
    const g = await makeGame(a.id, b.id);
    await client.rpc("apply_match_rating", { p_game_id: g.id });
    check("an active game is not rated", (await ratingOf(a.id)) === 650);
    const { data: h } = await admin.from("rating_history").select("id").eq("game_id", g.id);
    check("an active game writes no history", (h ?? []).length === 0);
  }

  // ---- F: a timeout loss rates exactly like any other loss ----
  {
    const a = await makeChild("TA", 750);
    const b = await makeChild("TB", 750);
    const g = await makeGame(a.id, b.id, { timeControl: "3+0" });
    // Run White's clock out, then let the server decide.
    await admin
      .from("online_games")
      .update({ last_move_at: new Date(Date.now() - 200000).toISOString() })
      .eq("id", g.id);
    const { data: t } = await client.rpc("claim_timeout", { p_game_id: g.id, p_child_id: b.id });
    check("the server finishes a game on timeout", t?.[0]?.status === "finished", t?.[0]?.status);
    check("the player who flagged loses", t?.[0]?.winner === "b", t?.[0]?.winner);

    await client.rpc("apply_match_rating", { p_game_id: g.id });
    check("a timeout win gains rating", (await ratingOf(b.id)) > 750);
    check("a timeout loss costs rating", (await ratingOf(a.id)) < 750);
    const { data: h } = await admin.from("rating_history").select("result").eq("game_id", g.id);
    check("a timeout writes rating history", (h ?? []).length === 2);
  }

  // ---- G: rating floor is respected ----
  {
    const low = await makeChild("FL", 400);
    const strong = await makeChild("FS", 400);
    const g = await makeGame(low.id, strong.id);
    await admin.from("online_games").update({ status: "finished", winner: "b" }).eq("id", g.id);
    await client.rpc("apply_match_rating", { p_game_id: g.id });
    check("rating never falls below the 400 floor", (await ratingOf(low.id)) >= 400,
      String(await ratingOf(low.id)));
  }
}

(async () => {
  try {
    await runSuite();
  } catch (e) {
    console.error("suite crashed:", e.message);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
  console.log(`\n=== ONLINE LIFECYCLE: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
  }
})();
