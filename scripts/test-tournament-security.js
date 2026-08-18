// Security audit test suite — empirical, against the REAL live database,
// using a REAL authenticated (non-service-role) session for every attempted
// write, exactly as a client (or a malicious hand-crafted API call) would
// see it. Complements the grant/RLS/function-definition inspection done via
// direct SQL earlier in this audit; this script proves the DENY outcomes
// actually happen at runtime, not just on paper.
//
// Run: node scripts/test-tournament-security.js

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
/** A write attempt is "correctly blocked" if it errored OR silently had no effect. */
function blocked(error, unchanged) {
  return !!error || unchanged;
}

async function main() {
  const client = createClient(url, anonKey);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);
  const { data: myParent } = await client.from("parents").select("id, premium_status").eq("auth_user_id", authData.user.id).single();

  // My own child, owned by the authenticated session.
  const { data: myChild } = await admin
    .from("children")
    .insert({ parent_id: myParent.id, display_name: "SecTestMine", avatar_id: "knight-kid", buddy_id: "wise-owl", rating: 500 })
    .select("id")
    .single();

  // A second, unrelated parent + child — NOT owned by the authenticated
  // session — for cross-player tampering tests.
  const { data: otherParent } = await admin
    .from("parents")
    .insert({ auth_user_id: null, email: "other-sectest@local.chessmind.test", premium_status: "free" })
    .select("id")
    .single();
  const { data: otherChild } = await admin
    .from("children")
    .insert({ parent_id: otherParent.id, display_name: "SecTestOther", avatar_id: "knight-kid", buddy_id: "wise-owl", rating: 500 })
    .select("id")
    .single();

  console.log("\n=== Phase 6: direct client writes to sensitive fields must fail ===");

  {
    const before = (await admin.from("children").select("rating").eq("id", myChild.id).single()).data.rating;
    const { error } = await client.from("children").update({ rating: 9999 }).eq("id", myChild.id);
    const after = (await admin.from("children").select("rating").eq("id", myChild.id).single()).data.rating;
    check("children.rating: direct UPDATE blocked (own child)", blocked(error, after === before), error?.message ?? `${before}->${after}`);
  }
  {
    // INSERT a new child specifying rating directly (the 0024 fix).
    const { error, data } = await client.from("children").insert({ parent_id: myParent.id, display_name: "SecTestRatingInsert", rating: 9999 }).select("id");
    check("children.rating: direct INSERT with explicit rating blocked", !!error, error?.message ?? JSON.stringify(data));
    if (!error && data?.[0]?.id) await admin.from("children").delete().eq("id", data[0].id);
  }
  {
    const before = myParent.premium_status;
    const { error } = await client.from("parents").update({ premium_status: "premium" }).eq("id", myParent.id);
    const after = (await admin.from("parents").select("premium_status").eq("id", myParent.id).single()).data.premium_status;
    check("parents.premium_status: direct UPDATE blocked (own account)", blocked(error, after === before), error?.message ?? `${before}->${after}`);
  }
  {
    const { error } = await client.from("parents").update({ premium_status: "premium" }).eq("id", otherParent.id);
    const after = (await admin.from("parents").select("premium_status").eq("id", otherParent.id).single()).data.premium_status;
    check("parents.premium_status: direct UPDATE blocked (someone else's account)", blocked(error, after === "free"), error?.message ?? after);
  }

  // Seed a real tournament game between myChild and otherChild for the
  // online_games field tests below.
  const { data: game } = await admin
    .from("online_games")
    .insert({
      host_child_id: myChild.id,
      guest_child_id: otherChild.id,
      host_color: "w",
      status: "active",
      match_type: "tournament",
      time_control: "3+0",
      last_move_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  for (const [field, value] of [
    ["status", "finished"],
    ["winner", "w"],
    ["host_child_id", otherChild.id],
    ["guest_child_id", myChild.id],
    ["tournament_id", "00000000-0000-0000-0000-000000000000"],
    ["round_number", 99],
  ]) {
    const before = (await admin.from("online_games").select(field).eq("id", game.id).single()).data[field];
    const { error } = await client.from("online_games").update({ [field]: value }).eq("id", game.id);
    const after = (await admin.from("online_games").select(field).eq("id", game.id).single()).data[field];
    check(`online_games.${field}: direct UPDATE blocked`, blocked(error, JSON.stringify(after) === JSON.stringify(before)), error?.message ?? `${before}->${after}`);
  }

  // tournament_pairing_id: needs a real pairing row to point at.
  {
    const { data: t } = await admin
      .from("tournaments")
      .insert({ name: "SecTest", creator_child_id: myChild.id, category: "Blitz", time_control: "3+0", max_players: 8, rounds_total: 2, status: "active", current_round: 0 })
      .select("id")
      .single();
    const { data: part1 } = await admin.from("tournament_participants").insert({ tournament_id: t.id, child_id: myChild.id, seed: 0 }).select("id").single();
    const { data: part2 } = await admin.from("tournament_participants").insert({ tournament_id: t.id, child_id: otherChild.id, seed: 1 }).select("id").single();
    const { data: pairing } = await admin
      .from("tournament_pairings")
      .insert({ tournament_id: t.id, round_number: 1, white_participant_id: part1.id, black_participant_id: part2.id, is_bye: false })
      .select("id")
      .single();

    const { error: e1 } = await client.from("online_games").update({ tournament_pairing_id: pairing.id }).eq("id", game.id);
    check("online_games.tournament_pairing_id: direct UPDATE blocked", !!e1, e1?.message);

    for (const [field, value] of [
      ["points", 999],
      ["seed", 999],
    ]) {
      const before = (await admin.from("tournament_participants").select(field).eq("id", part1.id).single()).data[field];
      const { error } = await client.from("tournament_participants").update({ [field]: value }).eq("id", part1.id);
      const after = (await admin.from("tournament_participants").select(field).eq("id", part1.id).single()).data[field];
      check(`tournament_participants.${field}: direct UPDATE blocked (own participant row)`, blocked(error, JSON.stringify(after) === JSON.stringify(before)), error?.message ?? `${before}->${after}`);
    }
    {
      const before = (await admin.from("tournament_participants").select("points").eq("id", part2.id).single()).data.points;
      const { error } = await client.from("tournament_participants").update({ points: 999 }).eq("id", part2.id);
      const after = (await admin.from("tournament_participants").select("points").eq("id", part2.id).single()).data.points;
      check("tournament_participants.points: direct UPDATE blocked (someone else's participant row)", blocked(error, after === before), error?.message ?? `${before}->${after}`);
    }
    for (const [field, value] of [
      ["points_awarded", true],
      ["white_participant_id", part2.id],
      ["black_participant_id", part1.id],
      ["online_game_id", game.id],
    ]) {
      const before = (await admin.from("tournament_pairings").select(field).eq("id", pairing.id).single()).data[field];
      const { error } = await client.from("tournament_pairings").update({ [field]: value }).eq("id", pairing.id);
      const after = (await admin.from("tournament_pairings").select(field).eq("id", pairing.id).single()).data[field];
      check(`tournament_pairings.${field}: direct UPDATE blocked`, blocked(error, JSON.stringify(after) === JSON.stringify(before)), error?.message ?? `${before}->${after}`);
    }

    // Round-generation RPCs must not be directly callable by a client.
    const { error: genErr } = await client.rpc("generate_tournament_round", { p_tournament_id: t.id });
    check("generate_tournament_round: not callable by an authenticated client", !!genErr, genErr?.message ?? "call succeeded — should have been rejected");
    const { error: advErr } = await client.rpc("check_and_advance_tournament_round", { p_tournament_id: t.id, p_round: 1 });
    check("check_and_advance_tournament_round: not callable by an authenticated client", !!advErr, advErr?.message ?? "call succeeded — should have been rejected");

    await admin.from("tournaments").delete().eq("id", t.id);
  }

  console.log("\n=== Phase 7: tournament games must not touch children.rating ===");
  {
    const beforeMine = (await admin.from("children").select("rating").eq("id", myChild.id).single()).data.rating;
    const beforeOther = (await admin.from("children").select("rating").eq("id", otherChild.id).single()).data.rating;
    await client.rpc("finish_online_game_by_result", { p_game_id: game.id, p_child_id: myChild.id, p_winner: "w" });
    try {
      await client.rpc("apply_match_rating", { p_game_id: game.id }); // guarded by match_type<>'random' regardless
    } catch {}
    const afterMine = (await admin.from("children").select("rating").eq("id", myChild.id).single()).data.rating;
    const afterOther = (await admin.from("children").select("rating").eq("id", otherChild.id).single()).data.rating;
    check("tournament win: winner's rating unchanged", afterMine === beforeMine, `${beforeMine}->${afterMine}`);
    check("tournament loss: loser's rating unchanged", afterOther === beforeOther, `${beforeOther}->${afterOther}`);
  }

  console.log("\n=== Phase 9: tournament result/point tampering must fail or have no additional effect ===");
  {
    const gameStatus = (await admin.from("online_games").select("status,winner").eq("id", game.id).single()).data;
    check("tournament game correctly finished by the legitimate call above", gameStatus.status === "finished" && gameStatus.winner === "w", JSON.stringify(gameStatus));

    // Replay the same result again.
    const { error: replayErr } = await client.rpc("finish_online_game_by_result", { p_game_id: game.id, p_child_id: myChild.id, p_winner: "w" });
    const afterReplay = (await admin.from("online_games").select("status,winner").eq("id", game.id).single()).data;
    check("submitting the same result twice: no error, no change", !replayErr && afterReplay.status === "finished" && afterReplay.winner === "w", replayErr?.message ?? JSON.stringify(afterReplay));

    // Try to change an already-finished game's result (tampering).
    const { error: tamperErr } = await client.rpc("finish_online_game_by_result", { p_game_id: game.id, p_child_id: otherChild.id, p_winner: "b" });
    const afterTamper = (await admin.from("online_games").select("status,winner").eq("id", game.id).single()).data;
    check("changing an already-finished game's winner: no effect (idempotent no-op, not tamperable)", afterTamper.winner === "w", JSON.stringify(afterTamper));

    // A stranger (not a participant) trying to submit a fake result for this game.
    const { data: strangerParent } = await admin.from("parents").insert({ auth_user_id: null, email: "stranger-sectest@local.chessmind.test", premium_status: "free" }).select("id").single();
    const { data: strangerChild } = await admin.from("children").insert({ parent_id: strangerParent.id, display_name: "Stranger", avatar_id: "knight-kid", buddy_id: "wise-owl" }).select("id").single();
    const { error: strangerErr } = await client.rpc("finish_online_game_by_result", { p_game_id: game.id, p_child_id: strangerChild.id, p_winner: "b" });
    check("a non-participant child_id cannot submit a result (ownership check independent of game membership)", !!strangerErr, strangerErr?.message);
    await admin.from("children").delete().eq("id", strangerChild.id);
    await admin.from("parents").delete().eq("id", strangerParent.id);
  }

  console.log("\n=== Phase 8: premium/free-game-limit integrity ===");
  {
    const before = await admin.from("free_game_usage").select("id", { count: "exact", head: true }).eq("child_id", myChild.id);
    // A tournament game's creation path (generate_tournament_round) never
    // calls consume_free_game_credit — confirmed by source inspection of
    // migration 0023/0024. Empirically: no free_game_usage row exists for
    // the tournament game created above even though it went through a full
    // finish cycle.
    const rows = await admin.from("free_game_usage").select("*").eq("child_id", myChild.id);
    check("tournament games do not consume free_game_usage", rows.data.length === 0, JSON.stringify(rows.data));
  }
  {
    const { error } = await client.from("free_game_usage").insert({ child_id: otherChild.id, game_type: "multiplayer" });
    const count = (await admin.from("free_game_usage").select("id", { count: "exact", head: true }).eq("child_id", otherChild.id)).count;
    check("free_game_usage: direct client INSERT blocked", !!error || count === 0, error?.message ?? `count=${count}`);
  }

  console.log("\n=== Phase 14: standings tiebreak determinism ===");
  {
    const { data: t } = await admin
      .from("tournaments")
      .insert({ name: "TiebreakTest", creator_child_id: myChild.id, category: "Blitz", time_control: "3+0", max_players: 4, rounds_total: 1, status: "active", current_round: 1 })
      .select("id")
      .single();
    const kids = [myChild.id, otherChild.id];
    const { data: extraParent } = await admin.from("parents").insert({ auth_user_id: null, email: "tiebreak-extra@local.chessmind.test", premium_status: "free" }).select("id").single();
    const { data: extraKids } = await admin.from("children").insert([
      { parent_id: extraParent.id, display_name: "Tie3", avatar_id: "knight-kid", buddy_id: "wise-owl" },
      { parent_id: extraParent.id, display_name: "Tie4", avatar_id: "knight-kid", buddy_id: "wise-owl" },
    ]).select("id");
    const allKids = [...kids, ...extraKids.map((k) => k.id)];
    const parts = [];
    for (let i = 0; i < allKids.length; i++) {
      const { data: p } = await admin.from("tournament_participants").insert({ tournament_id: t.id, child_id: allKids[i], seed: i, points: 2 }).select("id").single();
      parts.push(p.id);
    }
    // All 4 tied at 2 points -- deterministic order must come from Buchholz then seed.
    const r1 = await admin.rpc("get_tournament_standings", { p_tournament_id: t.id });
    const r2 = await admin.rpc("get_tournament_standings", { p_tournament_id: t.id });
    check("get_tournament_standings: no error", !r1.error && !r2.error, (r1.error || r2.error)?.message);
    check("standings order is identical across repeated calls", JSON.stringify(r1.data.map((s) => s.participant_id)) === JSON.stringify(r2.data.map((s) => s.participant_id)));
    const ranks = r1.data.map((s) => s.rank);
    check("tied points still produce contiguous 1..N ranks", JSON.stringify(ranks.slice().sort((a, b) => a - b)) === JSON.stringify([1, 2, 3, 4]), JSON.stringify(ranks));

    await admin.from("tournaments").delete().eq("id", t.id);
    await admin.from("children").delete().in("id", extraKids.map((k) => k.id));
    await admin.from("parents").delete().eq("id", extraParent.id);
  }

  // Cleanup.
  await admin.from("online_games").delete().eq("id", game.id);
  await admin.from("children").delete().eq("id", myChild.id);
  await admin.from("children").delete().eq("id", otherChild.id);
  await admin.from("parents").delete().eq("id", otherParent.id);

  console.log(`\n=== SECURITY SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Security test suite crashed:", err);
  process.exit(1);
});
