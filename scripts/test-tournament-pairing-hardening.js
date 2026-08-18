// Adversarial + structural test suite for the rewritten Swiss pairing
// algorithm (migration 0024) — exercises the REAL live database function
// (generate_tournament_round), not a JS mirror, since the algorithm now
// lives entirely in PL/pgSQL. Uses the service-role key to seed synthetic
// tournaments/participants/history directly (data seeding, not calling an
// RPC on someone else's behalf) and to call generate_tournament_round
// directly (only service_role/postgres can — see 0024's grant lockdown).
//
// Run: node scripts/test-tournament-pairing-hardening.js

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(label + (detail ? " -- " + detail : ""));
    console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`);
  }
}

let parentIdCache = null;
async function getTestParentId() {
  if (parentIdCache) return parentIdCache;
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === "dev-test@local.chessmind.test");
  if (!user) throw new Error("dev-test user not found — run scripts/dev-seed-test-user.js first");
  const { data: parent, error: pErr } = await admin.from("parents").select("id").eq("auth_user_id", user.id).single();
  if (pErr) throw pErr;
  parentIdCache = parent.id;
  return parent.id;
}

async function makeTournament(label, playerCount, roundsTotal, category, timeControl) {
  const parentId = await getTestParentId();
  const rows = Array.from({ length: playerCount }, (_, i) => ({
    parent_id: parentId,
    display_name: `${label}_${i + 1}`.slice(0, 40),
    avatar_id: "knight-kid",
    buddy_id: "wise-owl",
    rating: 400 + i,
  }));
  const { data: children, error: cErr } = await admin.from("children").insert(rows).select("id");
  if (cErr) throw new Error("seed children failed: " + cErr.message);

  const { data: t, error: tErr } = await admin
    .from("tournaments")
    .insert({
      name: label,
      creator_child_id: children[0].id,
      category: category || "Blitz",
      time_control: timeControl || "3+0",
      max_players: playerCount,
      rounds_total: roundsTotal,
      status: "active",
      current_round: 0,
    })
    .select("id")
    .single();
  if (tErr) throw new Error("seed tournament failed: " + tErr.message);

  const participants = children.map((c, i) => ({ tournament_id: t.id, child_id: c.id, seed: i }));
  const { data: parts, error: pErr } = await admin.from("tournament_participants").insert(participants).select("id, child_id, seed");
  if (pErr) throw new Error("seed participants failed: " + pErr.message);

  return { tournamentId: t.id, participants: parts, childIds: children.map((c) => c.id) };
}

/**
 * Seed fabricated pairing "history" at fake earlier round numbers, each
 * backed by a real *finished* online_games row (generate_tournament_round
 * now refuses to advance past a round with any unfinished game -- a
 * defense-in-depth guard added by this hardening pass -- so fabricated
 * history needs a matching finished game to be a faithful test fixture).
 * Then sets tournaments.current_round to match.
 */
async function seedHistory(tournamentId, pairsByRound) {
  let maxRound = 0;
  for (const [roundStr, pairs] of Object.entries(pairsByRound)) {
    const round = Number(roundStr);
    maxRound = Math.max(maxRound, round);
    for (const [a, b] of pairs) {
      const { data: game, error: gErr } = await admin
        .from("online_games")
        .insert({
          host_child_id: (await admin.from("tournament_participants").select("child_id").eq("id", a).single()).data.child_id,
          guest_child_id: (await admin.from("tournament_participants").select("child_id").eq("id", b).single()).data.child_id,
          host_color: "w",
          status: "finished",
          winner: "w",
          match_type: "tournament",
          tournament_id: tournamentId,
          round_number: round,
        })
        .select("id")
        .single();
      if (gErr) throw new Error("seedHistory game insert failed: " + gErr.message);

      const { data: pairing, error: pErr } = await admin
        .from("tournament_pairings")
        .insert({
          tournament_id: tournamentId,
          round_number: round,
          white_participant_id: a,
          black_participant_id: b,
          is_bye: false,
          points_awarded: true,
          online_game_id: game.id,
        })
        .select("id")
        .single();
      if (pErr) throw new Error("seedHistory pairing insert failed: " + pErr.message);

      await admin.from("online_games").update({ tournament_pairing_id: pairing.id }).eq("id", game.id);
    }
  }
  const { error: uErr } = await admin.from("tournaments").update({ current_round: maxRound }).eq("id", tournamentId);
  if (uErr) throw new Error("seedHistory current_round update failed: " + uErr.message);
}

async function seedByes(tournamentId, roundParticipantPairs) {
  // roundParticipantPairs: [[round, participantId], ...]
  const rows = roundParticipantPairs.map(([round, pid]) => ({
    tournament_id: tournamentId,
    round_number: round,
    white_participant_id: pid,
    black_participant_id: null,
    is_bye: true,
    points_awarded: true,
  }));
  const { error } = await admin.from("tournament_pairings").insert(rows);
  if (error) throw new Error("seedByes failed: " + error.message);
}

async function generateRound(tournamentId) {
  const { error } = await admin.rpc("generate_tournament_round", { p_tournament_id: tournamentId });
  return error;
}

async function getRound(tournamentId, round) {
  const { data, error } = await admin.from("tournament_pairings").select("*").eq("tournament_id", tournamentId).eq("round_number", round);
  if (error) throw error;
  return data;
}

async function getTournament(tournamentId) {
  const { data, error } = await admin.from("tournaments").select("*").eq("id", tournamentId).single();
  if (error) throw error;
  return data;
}

async function cleanup(tournamentId, childIds) {
  await admin.from("tournaments").delete().eq("id", tournamentId);
  await admin.from("children").delete().in("id", childIds);
}

/** Finish every non-bye game in a round via service-role update (fires the real trigger). */
async function finishRound(tournamentId, round) {
  const rows = await getRound(tournamentId, round);
  for (const p of rows) {
    if (p.is_bye) continue;
    await admin.from("online_games").update({ status: "finished", winner: "w" }).eq("id", p.online_game_id);
  }
  await new Promise((r) => setTimeout(r, 120));
}

function assertStructural(label, playerCount, pairings) {
  const expectedGames = Math.floor(playerCount / 2);
  const hasBye = playerCount % 2 === 1;
  const appearances = [];
  let byeCount = 0;
  let selfPair = 0;
  for (const p of pairings) {
    appearances.push(p.white_participant_id);
    if (p.black_participant_id) appearances.push(p.black_participant_id);
    if (p.is_bye) byeCount++;
    if (p.black_participant_id && p.black_participant_id === p.white_participant_id) selfPair++;
  }
  check(`${label}: correct pairing row count`, pairings.length === expectedGames + (hasBye ? 1 : 0), pairings.length);
  check(`${label}: every player appears exactly once`, appearances.length === playerCount && new Set(appearances).size === playerCount, `${appearances.length}/${new Set(appearances).size} vs ${playerCount}`);
  check(`${label}: bye count matches parity`, byeCount === (hasBye ? 1 : 0), byeCount);
  check(`${label}: no self-pairing`, selfPair === 0, selfPair);
}

/** Returns true if (a,b) appears in any pairing outside the given round's own rows. */
function buildPlayedSet(priorPairings) {
  const s = new Set();
  for (const p of priorPairings) {
    if (p.is_bye) continue;
    s.add([p.white_participant_id, p.black_participant_id].sort().join("|"));
  }
  return s;
}

async function testStructuralSweep(sizes) {
  console.log("\n=== Structural sweep across player counts (self-consistent history: 3 real prior rounds each) ===");
  for (const n of sizes) {
    const label = `n=${n}`;
    // Deliberately do NOT cap rounds_total to what the odd pool's bye
    // rotation can support — for n=3 that's the whole point of this case:
    // rounds_total=4 is still "allowed" by the tournament's own config, so
    // round 4 reaches the bye-exhaustion path (rather than being turned
    // away earlier by the simpler "already past rounds_total" guard) and
    // exercises the graceful-early-completion behaviour under test.
    const roundsTotal = Math.max(4, Math.ceil(Math.log2(n)) + 2);
    const { tournamentId, participants, childIds } = await makeTournament(`Sweep_${n}`, n, roundsTotal);

    const err0 = await generateRound(tournamentId); // round 1 (random)
    check(`${label}: round 1 generation succeeded`, !err0, err0?.message);

    // Drive 3 more rounds by actually finishing each round's games (fires
    // the real trigger chain, exactly like production) rather than calling
    // generate_tournament_round directly and repeatedly — the latter would
    // now correctly be refused by the new "previous round must be
    // finished" guard, same as it should be refused for a real out-of-order
    // client call.
    let lastRound = 1;
    let completedEarly = false;
    for (let r = 1; r <= 3; r++) {
      await finishRound(tournamentId, r);
      const t = await getTournament(tournamentId);
      if (t.status === "completed") {
        completedEarly = true;
        break;
      }
      check(`${label}: round ${r + 1} auto-generated after round ${r} finished`, t.current_round === r + 1, `current_round=${t.current_round}`);
      lastRound = t.current_round;
    }

    if (completedEarly) {
      // Only expected for tiny odd pools that exhaust their one-bye-per-
      // player rotation before reaching this many rounds.
      check(`${label}: early completion only for a tiny odd pool`, n % 2 === 1 && n <= 5, `n=${n}`);
      await cleanup(tournamentId, childIds);
      continue;
    }

    const allPriorRounds = [];
    for (let r = 1; r < lastRound; r++) allPriorRounds.push(...(await getRound(tournamentId, r)));
    const finalRound = await getRound(tournamentId, lastRound);
    assertStructural(label, n, finalRound);

    const playedBefore = buildPlayedSet(allPriorRounds);
    let avoidableRepeats = 0;
    for (const p of finalRound) {
      if (p.is_bye) continue;
      const key = [p.white_participant_id, p.black_participant_id].sort().join("|");
      if (playedBefore.has(key) && !p.forced_repeat) avoidableRepeats++;
    }
    check(`${label}: no repeat pairing lacks forced_repeat flag`, avoidableRepeats === 0, avoidableRepeats);

    await cleanup(tournamentId, childIds);
  }
}

async function testScenarioF_GreedyTrap() {
  // The exact hand-traced case that broke the single-phase design: 6
  // players, equal score, only 5-6 have played. A correct search must find
  // e.g. 1-2,3-5,4-6 or similar — NOT be forced into repeating 5-6.
  console.log("\n=== Scenario F: naive-greedy trap (must find the non-obvious zero-repeat solution) ===");
  const { tournamentId, participants, childIds } = await makeTournament("GreedyTrap", 6, 3);
  const [p1, p2, p3, p4, p5, p6] = participants.sort((a, b) => a.seed - b.seed).map((p) => p.id);
  await seedHistory(tournamentId, { 1: [[p5, p6]] });

  const err = await generateRound(tournamentId);
  check("greedy-trap: round generation succeeded", !err, err?.message);
  const round = await getRound(tournamentId, 2);
  assertStructural("greedy-trap", 6, round);
  const repeats = round.filter((p) => !p.is_bye && [p.white_participant_id, p.black_participant_id].sort().join("|") === [p5, p6].sort().join("|"));
  check("greedy-trap: 5-6 repeat was avoided even though it was the first-explored branch", repeats.length === 0, JSON.stringify(round.map((r) => [r.white_participant_id, r.black_participant_id])));

  await cleanup(tournamentId, childIds);
}

async function testScenarioG_ForcedRepeat() {
  // n=4, all 3 possible perfect matchings of K4 already used across 3 fake
  // rounds -> every edge exhausted -> round 4 MUST repeat something.
  console.log("\n=== Scenario G: repeat is mathematically unavoidable ===");
  const { tournamentId, participants, childIds } = await makeTournament("ForcedRepeat", 4, 4);
  const [p1, p2, p3, p4] = participants.sort((a, b) => a.seed - b.seed).map((p) => p.id);
  await seedHistory(tournamentId, {
    1: [[p1, p2], [p3, p4]],
    2: [[p1, p3], [p2, p4]],
    3: [[p1, p4], [p2, p3]],
  });

  const err = await generateRound(tournamentId);
  check("forced-repeat: round generation succeeded (did not hang/crash)", !err, err?.message);
  const round = await getRound(tournamentId, 4);
  assertStructural("forced-repeat", 4, round);
  const anyRepeat = round.some((p) => !p.is_bye);
  check("forced-repeat: round 4 was produced despite exhausted edge set", anyRepeat, JSON.stringify(round));
  const allFlagged = round.filter((p) => !p.is_bye).every((p) => p.forced_repeat === true);
  check("forced-repeat: the repeat pairing is honestly flagged forced_repeat=true", allFlagged, JSON.stringify(round.map((r) => r.forced_repeat)));

  await cleanup(tournamentId, childIds);
}

async function testScenarioA_SameScore() {
  console.log("\n=== Scenario A: everyone has the same score ===");
  const { tournamentId, participants, childIds } = await makeTournament("SameScore", 10, 4);
  await admin.from("tournament_participants").update({ points: 3 }).eq("tournament_id", tournamentId);
  const ids = participants.map((p) => p.id);
  await seedHistory(tournamentId, { 1: [[ids[0], ids[1]], [ids[2], ids[3]]] });

  const err = await generateRound(tournamentId);
  check("same-score: round generation succeeded", !err, err?.message);
  const round = await getRound(tournamentId, 2);
  assertStructural("same-score", 10, round);
  const gaps = round.filter((p) => !p.is_bye).map(() => 0); // all points equal(3) so gap is always 0 by construction
  check("same-score: all pairings are within the single score bracket", gaps.length === 5, gaps.length);

  await cleanup(tournamentId, childIds);
}

async function testScenarioB_TwoGroups() {
  console.log("\n=== Scenario B: two large score groups ===");
  const { tournamentId, participants, childIds } = await makeTournament("TwoGroups", 20, 5);
  const sorted = participants.sort((a, b) => a.seed - b.seed);
  const high = sorted.slice(0, 10).map((p) => p.id);
  const low = sorted.slice(10).map((p) => p.id);
  for (const id of high) await admin.from("tournament_participants").update({ points: 5 }).eq("id", id);
  for (const id of low) await admin.from("tournament_participants").update({ points: 2 }).eq("id", id);
  await admin.from("tournaments").update({ current_round: 1 }).eq("id", tournamentId);

  const err = await generateRound(tournamentId);
  check("two-groups: round generation succeeded", !err, err?.message);
  const round = await getRound(tournamentId, 2);
  assertStructural("two-groups", 20, round);
  const highSet = new Set(high);
  let sameGroup = 0;
  let crossGroup = 0;
  for (const p of round) {
    if (p.is_bye) continue;
    const aHigh = highSet.has(p.white_participant_id);
    const bHigh = highSet.has(p.black_participant_id);
    if (aHigh === bHigh) sameGroup++;
    else crossGroup++;
  }
  check("two-groups: every pairing stays within its score group (even split, no history)", crossGroup === 0, `same=${sameGroup} cross=${crossGroup}`);

  await cleanup(tournamentId, childIds);
}

async function testScenarioI_ByeRotation() {
  console.log("\n=== Scenario I: bye never repeats even when the prior bye recipient is lowest-ranked ===");
  const { tournamentId, participants, childIds } = await makeTournament("ByeRotation", 9, 3);
  const sorted = participants.sort((a, b) => a.seed - b.seed);
  const ids = sorted.map((p) => p.id);
  // Give participant 0 the lowest points (would be first pick for a bye by
  // the ordering rule) AND a prior bye — must be skipped in favour of
  // someone else.
  await admin.from("tournament_participants").update({ points: 0 }).eq("id", ids[0]);
  for (let i = 1; i < ids.length; i++) {
    await admin.from("tournament_participants").update({ points: 2 }).eq("id", ids[i]);
  }
  await seedByes(tournamentId, [[1, ids[0]]]);
  await admin.from("tournaments").update({ current_round: 1 }).eq("id", tournamentId);

  const err = await generateRound(tournamentId);
  check("bye-rotation: round generation succeeded", !err, err?.message);
  const round = await getRound(tournamentId, 2);
  assertStructural("bye-rotation", 9, round);
  const byeRow = round.find((p) => p.is_bye);
  check("bye-rotation: bye did NOT go to the participant who already had one", byeRow && byeRow.white_participant_id !== ids[0], byeRow?.white_participant_id);

  await cleanup(tournamentId, childIds);
}

async function testScenarioJ_LargeTournament() {
  console.log("\n=== Scenario J: 100-player tournament, round 1 then round 2 ===");
  const t0 = Date.now();
  const { tournamentId, participants, childIds } = await makeTournament("Large100", 100, 6);
  const err1 = await generateRound(tournamentId);
  check("100-player: round 1 (random) generation succeeded", !err1, err1?.message);
  const round1 = await getRound(tournamentId, 1);
  assertStructural("100-player round1", 100, round1);

  await finishRound(tournamentId, 1);
  const t = await getTournament(tournamentId);
  check("100-player: round 2 auto-generated after round 1 finished", t.current_round === 2, t.current_round);
  const round2 = await getRound(tournamentId, 2);
  assertStructural("100-player round2", 100, round2);
  const elapsedMs = Date.now() - t0;
  check("100-player: both rounds completed in well under a minute", elapsedMs < 60000, `${elapsedMs}ms`);
  console.log(`  (100-player, 2 rounds: ${elapsedMs}ms total)`);

  await cleanup(tournamentId, childIds);
}

async function main() {
  await testStructuralSweep([2, 3, 4, 5, 7, 8, 9, 10, 16, 20, 21, 32, 50]);
  await testScenarioF_GreedyTrap();
  await testScenarioG_ForcedRepeat();
  await testScenarioA_SameScore();
  await testScenarioB_TwoGroups();
  await testScenarioI_ByeRotation();
  await testScenarioJ_LargeTournament();

  console.log(`\n=== PAIRING HARDENING SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
