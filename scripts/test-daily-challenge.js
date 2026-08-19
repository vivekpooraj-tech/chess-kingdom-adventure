// Daily Challenge test suite — against the REAL live database, using both
// the service-role key (seeding synthetic history, inspecting tables
// directly) and a REAL authenticated (non-service-role) session for every
// ownership/security-relevant RPC call, exactly as a real client would see
// it. Matches the pattern established by scripts/test-tournament-*.js.
//
// Run: node scripts/test-daily-challenge.js

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
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

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

let parentIdCache = null;
async function getTestParentId() {
  if (parentIdCache) return parentIdCache;
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === "dev-test@local.chessmind.test");
  if (!user) throw new Error("dev-test user not found — run scripts/dev-seed-test-user.js first");
  const { data: parent } = await admin.from("parents").select("id").eq("auth_user_id", user.id).single();
  parentIdCache = parent.id;
  return parent.id;
}

async function makeChild(label, rating) {
  const parentId = await getTestParentId();
  const { data, error } = await admin
    .from("children")
    .insert({ parent_id: parentId, display_name: label.slice(0, 40), avatar_id: "knight-kid", buddy_id: "wise-owl", rating: rating ?? 400 })
    .select("id")
    .single();
  if (error) throw new Error("makeChild failed: " + error.message);
  return data.id;
}

async function cleanupChild(childId) {
  await admin.from("daily_challenge_history").delete().eq("child_id", childId);
  await admin.from("children").delete().eq("id", childId);
}

/** Seed a fabricated Daily Challenge history row directly (bypassing the RPC — data seeding, not calling the RPC on someone's behalf, same reasoning used throughout this session's other test suites). */
async function seedHistoryRow(childId, dateStr, puzzleId, level, result, attempts) {
  const { error } = await admin.from("daily_challenge_history").insert({
    child_id: childId,
    challenge_date: dateStr,
    puzzle_id: puzzleId,
    level_served: level,
    result,
    attempts,
    completed_at: result === "solved" ? new Date().toISOString() : null,
  });
  if (error) throw new Error("seedHistoryRow failed: " + error.message);
}

async function anyPuzzleAtLevel(level) {
  const { data } = await admin.from("daily_challenge_puzzles").select("puzzle_id").eq("level", level).limit(1).single();
  return data.puzzle_id;
}

async function main() {
  const client = createClient(url, anonKey);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);

  console.log("\n=== 1-3: same-day consistency, new-day variety, no consecutive repeat ===");
  {
    const childId = await makeChild("DC_SameDay");
    const day1 = "2026-01-01";
    const r1 = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: day1 });
    const r2 = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: day1 });
    check("same call twice same day: no error", !r1.error && !r2.error, (r1.error || r2.error)?.message);
    check("same player + same day -> same puzzle", r1.data[0].out_puzzle_id === r2.data[0].out_puzzle_id, `${r1.data[0]?.out_puzzle_id} vs ${r2.data[0]?.out_puzzle_id}`);

    const day2 = addDays(day1, 1);
    const r3 = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: day2 });
    check("new day: no error", !r3.error, r3.error?.message);
    check("same puzzle never served on consecutive days", r3.data[0].out_puzzle_id !== r1.data[0].out_puzzle_id, `${r3.data[0]?.out_puzzle_id} vs ${r1.data[0]?.out_puzzle_id}`);

    const { count } = await admin.from("daily_challenge_history").select("id", { count: "exact", head: true }).eq("child_id", childId);
    check("exactly 2 history rows exist (one per day, no duplicates)", count === 2, count);

    await cleanupChild(childId);
  }

  console.log("\n=== 4-5: recent-history exclusion, never-seen preference ===");
  {
    const childId = await makeChild("DC_Exclusion");
    const { data: level1Puzzles } = await admin.from("daily_challenge_puzzles").select("puzzle_id").eq("level", 1);
    // Seed this child having played ALL but one level-1 puzzle in the last 5 days.
    const seen = level1Puzzles.slice(0, -1);
    const unseen = level1Puzzles[level1Puzzles.length - 1].puzzle_id;
    let d = "2026-02-01";
    for (const p of seen) {
      await seedHistoryRow(childId, d, p.puzzle_id, 1, "solved", 1);
      d = addDays(d, 1);
    }
    const nextDay = addDays(d, 3); // well past the 10-day exclusion window edge case isn't needed here -- pool is tiny
    const { data: served } = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: nextDay });
    check("never-seen puzzle preferred when one exists in the eligible pool", served[0].out_puzzle_id === unseen || !seen.some((s) => s.puzzle_id === served[0].out_puzzle_id), `served ${served[0]?.out_puzzle_id}, unseen was ${unseen}`);

    await cleanupChild(childId);
  }

  console.log("\n=== 6-9: difficulty adapts gradually, never jumps excessively ===");
  {
    // Strong performance -> up one level.
    const childA = await makeChild("DC_Strong");
    let d = "2026-03-01";
    const p3 = await anyPuzzleAtLevel(3);
    for (let i = 0; i < 5; i++) {
      await seedHistoryRow(childA, d, p3, 3, "solved", 1);
      d = addDays(d, 1);
    }
    const rStrong = await client.rpc("get_daily_challenge", { p_child_id: childA, p_date: d });
    check("strong recent performance (5/5 solved, 1 attempt each) -> level increases by exactly 1", rStrong.data[0].out_level_served === 4, rStrong.data[0].out_level_served);
    await cleanupChild(childA);

    // Average performance -> stays the same.
    const childB = await makeChild("DC_Average");
    d = "2026-03-01";
    for (let i = 0; i < 6; i++) {
      await seedHistoryRow(childB, d, p3, 3, i % 2 === 0 ? "solved" : "failed", 2);
      d = addDays(d, 1);
    }
    const rAvg = await client.rpc("get_daily_challenge", { p_child_id: childB, p_date: d });
    check("average recent performance (mixed results) -> level stays the same", rAvg.data[0].out_level_served === 3, rAvg.data[0].out_level_served);
    await cleanupChild(childB);

    // Weak performance -> down one level.
    const childC = await makeChild("DC_Weak");
    d = "2026-03-01";
    for (let i = 0; i < 5; i++) {
      await seedHistoryRow(childC, d, p3, 3, "failed", 4);
      d = addDays(d, 1);
    }
    const rWeak = await client.rpc("get_daily_challenge", { p_child_id: childC, p_date: d });
    check("weak recent performance (0/5 solved) -> level decreases by exactly 1", rWeak.data[0].out_level_served === 2, rWeak.data[0].out_level_served);
    await cleanupChild(childC);

    // Never more than 1 step even with an extreme (all-fail) history.
    const childD = await makeChild("DC_NeverJumps");
    d = "2026-03-01";
    const p5 = await anyPuzzleAtLevel(5);
    for (let i = 0; i < 10; i++) {
      await seedHistoryRow(childD, d, p5, 5, "failed", 9);
      d = addDays(d, 1);
    }
    const rJump = await client.rpc("get_daily_challenge", { p_child_id: childD, p_date: d });
    check("difficulty never jumps more than 1 level even after a long losing streak", rJump.data[0].out_level_served === 4, rJump.data[0].out_level_served);
    await cleanupChild(childD);
  }

  console.log("\n=== One lucky/unlucky result must not swing difficulty ===");
  {
    const childId = await makeChild("DC_OneLucky");
    const p3 = await anyPuzzleAtLevel(3);
    await seedHistoryRow(childId, "2026-04-01", p3, 3, "solved", 1);
    const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2026-04-02" });
    check("a single solved result (below the 3-attempt minimum window) does not bump difficulty", r.data[0].out_level_served === 3, r.data[0].out_level_served);
    await cleanupChild(childId);
  }

  console.log("\n=== 10-11: new player cold start, strong player higher initial difficulty ===");
  {
    const newPlayer = await makeChild("DC_NewPlayer", 400);
    const r = await client.rpc("get_daily_challenge", { p_child_id: newPlayer, p_date: "2026-05-01" });
    check("brand-new player (no history, default rating) gets a valid low initial level", !r.error && r.data[0].out_level_served >= 1 && r.data[0].out_level_served <= 3, r.data[0]?.out_level_served);
    await cleanupChild(newPlayer);

    const strongPlayer = await makeChild("DC_StrongPlayer", 700);
    const r2 = await client.rpc("get_daily_challenge", { p_child_id: strongPlayer, p_date: "2026-05-01" });
    check("a player with an established higher rating starts at a higher initial level than the cold-start floor", r2.data[0].out_level_served > 1, r2.data[0].out_level_served);
    await cleanupChild(strongPlayer);
  }

  console.log("\n=== 12-13: puzzle solution validity / invalid content rejected ===");
  {
    const { error } = await admin.from("daily_challenge_puzzles").insert({ puzzle_id: "bad-level-test", level: 9, mate_in: 1, theme: "x" });
    check("a puzzle metadata row with an out-of-range level is rejected by the DB constraint", !!error, error?.message);
    const { error: error2 } = await admin.from("daily_challenge_puzzles").insert({ puzzle_id: "bad-mate-test", level: 1, mate_in: 9, theme: "x" });
    check("a puzzle metadata row with an out-of-range mate_in is rejected by the DB constraint", !!error2, error2?.message);
  }

  console.log("\n=== 14-15: no duplicate challenges from repeated or concurrent requests ===");
  {
    const childId = await makeChild("DC_Concurrency");
    const dateStr = "2026-06-01";
    const results = await Promise.all(Array.from({ length: 15 }, () => client.rpc("get_daily_challenge", { p_child_id: childId, p_date: dateStr })));
    const errors = results.filter((r) => r.error);
    check("15 concurrent same-day requests all succeed", errors.length === 0, JSON.stringify(errors.map((e) => e.error.message)));
    const puzzleIds = new Set(results.map((r) => r.data?.[0]?.out_puzzle_id));
    check("all 15 concurrent requests resolve to the SAME single puzzle", puzzleIds.size === 1, JSON.stringify([...puzzleIds]));
    const { count } = await admin.from("daily_challenge_history").select("id", { count: "exact", head: true }).eq("child_id", childId).eq("challenge_date", dateStr);
    check("exactly one history row was created despite the concurrency", count === 1, count);
    await cleanupChild(childId);
  }

  console.log("\n=== 16-17: client cannot manipulate difficulty or puzzle id ===");
  {
    // No such parameter exists on the RPC at all -- PostgREST refuses to
    // even dispatch a call whose parameter names don't match the function's
    // real signature (stronger than "ignored": the call never runs at all).
    const childId = await makeChild("DC_NoManipulation");
    const attempt = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2026-07-01", p_level: 6, p_puzzle_id: "m3-rook-box-a" });
    check("passing unsupported params (p_level/p_puzzle_id) is rejected outright, not honored", !!attempt.error, JSON.stringify(attempt.data));

    // The real (valid-signature) call still works normally afterward.
    const real = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2026-07-01" });
    check("the real call (no extra params) succeeds", !real.error, real.error?.message);

    // Direct table writes are blocked entirely.
    const { error: insErr } = await client.from("daily_challenge_history").insert({ child_id: childId, challenge_date: "2026-07-02", puzzle_id: "m1-backrank-rook", level_served: 1 });
    check("direct client INSERT into daily_challenge_history is blocked", !!insErr, insErr?.message);
    const before = await admin.from("daily_challenge_history").select("level_served").eq("child_id", childId).eq("challenge_date", "2026-07-01").single();
    const { error: updErr } = await client.from("daily_challenge_history").update({ level_served: 6, result: "solved" }).eq("child_id", childId).eq("challenge_date", "2026-07-01");
    const after = await admin.from("daily_challenge_history").select("level_served,result").eq("child_id", childId).eq("challenge_date", "2026-07-01").single();
    check("direct client UPDATE (e.g. self-awarding 'solved' or a higher level) is blocked", (!!updErr || after.data.level_served === before.data.level_served) && after.data.result !== "solved", updErr?.message ?? JSON.stringify(after.data));

    await cleanupChild(childId);
  }
  {
    // Cross-child: authenticated session cannot act on a child it doesn't own.
    const { data: strangerParent } = await admin.from("parents").insert({ auth_user_id: null, email: "dc-stranger@local.chessmind.test", premium_status: "free" }).select("id").single();
    const { data: strangerChild } = await admin.from("children").insert({ parent_id: strangerParent.id, display_name: "DCStranger", avatar_id: "knight-kid", buddy_id: "wise-owl" }).select("id").single();
    const r = await client.rpc("get_daily_challenge", { p_child_id: strangerChild.id, p_date: "2026-07-01" });
    check("get_daily_challenge rejects a child_id the caller does not own", !!r.error, r.error?.message);
    const r2 = await client.rpc("record_daily_challenge_result", { p_child_id: strangerChild.id, p_date: "2026-07-01", p_solved: true });
    check("record_daily_challenge_result rejects a child_id the caller does not own", !!r2.error, r2.error?.message);
    await admin.from("children").delete().eq("id", strangerChild.id);
    await admin.from("parents").delete().eq("id", strangerParent.id);
  }

  console.log("\n=== Result idempotency: cannot double-solve or un-solve ===");
  {
    const childId = await makeChild("DC_Idempotent");
    await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2026-08-01" });
    const r1 = await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: "2026-08-01", p_solved: true });
    check("first solve call succeeds", !r1.error, r1.error?.message);
    const afterFirst = await admin.from("daily_challenge_history").select("result,attempts").eq("child_id", childId).eq("challenge_date", "2026-08-01").single();
    check("solved with attempts=1", afterFirst.data.result === "solved" && afterFirst.data.attempts === 1, JSON.stringify(afterFirst.data));

    await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: "2026-08-01", p_solved: true });
    await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: "2026-08-01", p_solved: false });
    const afterReplay = await admin.from("daily_challenge_history").select("result,attempts").eq("child_id", childId).eq("challenge_date", "2026-08-01").single();
    check("replayed/duplicate result calls do not change an already-solved record", afterReplay.data.result === "solved" && afterReplay.data.attempts === 1, JSON.stringify(afterReplay.data));

    await cleanupChild(childId);
  }

  console.log("\n=== 18: existing Chess Mind streak is completely unaffected ===");
  {
    const childId = await makeChild("DC_StreakUnaffected");
    const before = await admin.from("child_chess_mind_activity").select("id", { count: "exact", head: true }).eq("child_id", childId);
    await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2026-09-01" });
    await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: "2026-09-01", p_solved: true });
    const after = await admin.from("child_chess_mind_activity").select("id", { count: "exact", head: true }).eq("child_id", childId);
    check("Daily Challenge never writes to child_chess_mind_activity (the unrelated Chess Mind streak table)", (before.count ?? 0) === (after.count ?? 0), `${before.count} -> ${after.count}`);
    await cleanupChild(childId);
  }

  console.log("\n=== Free-tier puzzle preview counter is unaffected (unrelated existing feature) ===");
  {
    const childId = await makeChild("DC_PreviewUnaffected");
    const before = await admin.from("puzzle_preview_usage").select("id", { count: "exact", head: true }).eq("child_id", childId);
    await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2026-09-02" });
    const after = await admin.from("puzzle_preview_usage").select("id", { count: "exact", head: true }).eq("child_id", childId);
    check("Daily Challenge selection never touches puzzle_preview_usage", (before.count ?? 0) === (after.count ?? 0), `${before.count} -> ${after.count}`);
    await cleanupChild(childId);
  }

  console.log("\n=== Randomized 30-day simulation: weak / average / strong phases ===");
  {
    const childId = await makeChild("DC_Sim30");
    let d = "2027-01-01";
    let level = 1;
    const history = [];
    const phaseAt = (day) => (day < 10 ? "weak" : day < 20 ? "average" : "strong");
    let violations = 0;
    for (let day = 0; day < 30; day++) {
      const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: d });
      if (r.error) throw new Error("sim30 get_daily_challenge failed: " + r.error.message);
      const served = r.data[0].out_level_served;
      if (Math.abs(served - level) > 1) violations++;
      level = served;

      const phase = phaseAt(day);
      const solved = phase === "strong" ? true : phase === "average" ? day % 2 === 0 : false;
      const attempts = phase === "strong" ? 1 : phase === "average" ? 2 : 5;
      await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: d, p_solved: solved });
      // attempts beyond the first failed try, to make "average"/"weak" genuinely take multiple tries like a real session would
      for (let extra = 1; extra < attempts && !solved; extra++) {
        await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: d, p_solved: extra === attempts - 1 ? solved : false });
      }
      history.push({ day, phase, level: served, solved });
      d = addDays(d, 1);
    }
    check("30-day simulation: level never jumped more than 1 step in a single day", violations === 0, violations);
    const weakEndLevel = history.filter((h) => h.phase === "weak").slice(-1)[0].level;
    const strongEndLevel = history.filter((h) => h.phase === "strong").slice(-1)[0].level;
    check("30-day simulation: sustained strong performance ends at a meaningfully higher level than sustained weak performance", strongEndLevel > weakEndLevel, `weak ended at ${weakEndLevel}, strong ended at ${strongEndLevel}`);
    await cleanupChild(childId);
  }

  console.log("\n=== Randomized 90-day simulation: system does not get permanently stuck ===");
  {
    const childId = await makeChild("DC_Sim90");
    let d = "2028-01-01";
    const levelsSeen = new Set();
    for (let day = 0; day < 90; day++) {
      const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: d });
      if (r.error) throw new Error("sim90 get_daily_challenge failed: " + r.error.message);
      levelsSeen.add(r.data[0].out_level_served);
      // Alternate strong/weak every 15 days to force real movement both directions.
      const strongPhase = Math.floor(day / 15) % 2 === 0;
      const solved = strongPhase;
      await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: d, p_solved: solved });
      d = addDays(d, 1);
    }
    check("90-day simulation: the player visited more than one difficulty level (not frozen)", levelsSeen.size > 1, JSON.stringify([...levelsSeen]));
    await cleanupChild(childId);
  }

  console.log(`\n=== DAILY CHALLENGE SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Daily Challenge test suite crashed:", err);
  process.exit(1);
});
