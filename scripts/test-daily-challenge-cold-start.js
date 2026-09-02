// Phase 14D — learner-aware Daily Challenge cold-start test.
//
// Against the REAL live database, same pattern as
// scripts/test-daily-challenge.js: service-role key for seeding synthetic
// children / inspecting tables, a REAL authenticated (non-service-role)
// session for the get_daily_challenge RPC call itself.
//
// REQUIRES migration 0030_learner_aware_daily_challenge.sql to be applied
// first (this repo applies migrations by hand in the Supabase SQL Editor).
// If the RPC still has the pre-14D cold-start behavior the band assertions
// below fail loudly.
//
// Every child it creates is deleted at the end. No real user data is
// touched. No production solves are recorded.
//
// Run: node scripts/test-daily-challenge-cold-start.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const content = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; failures.push(label + (detail ? " -- " + detail : "")); console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`); }
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

async function makeChild({ label, rating = 400, experience = undefined }) {
  const parentId = await getTestParentId();
  const row = { parent_id: parentId, display_name: label.slice(0, 40), avatar_id: "knight-kid", buddy_id: "wise-owl", rating };
  if (experience !== undefined) row.experience_level = experience; // undefined -> column stays NULL
  const { data, error } = await admin.from("children").insert(row).select("id").single();
  if (error) throw new Error("makeChild failed: " + error.message);
  return data.id;
}

async function cleanupChild(childId) {
  await admin.from("daily_challenge_history").delete().eq("child_id", childId);
  await admin.from("puzzle_library_solves").delete().eq("child_id", childId);
  await admin.from("children").delete().eq("id", childId);
}

async function seedHistoryRow(childId, dateStr, puzzleId, level, result, attempts) {
  const { error } = await admin.from("daily_challenge_history").insert({
    child_id: childId, challenge_date: dateStr, puzzle_id: puzzleId, level_served: level,
    result, attempts, completed_at: result === "solved" ? new Date().toISOString() : null,
  });
  if (error) throw new Error("seedHistoryRow failed: " + error.message);
}

async function main() {
  const client = createClient(url, anonKey);
  const { error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);

  // Pool must be exactly 1000 and untouched.
  const { count: poolCount } = await admin.from("daily_challenge_puzzles").select("puzzle_id", { count: "exact", head: true });
  check("daily_challenge_puzzles pool is exactly 1000 (unchanged)", poolCount === 1000, poolCount);

  // A fresh child has no history and no exclusions, so tolerance stays at 0
  // and the served puzzle's level equals the cold-start target exactly.
  console.log("\n=== Cold start: experience_level sets the day-1 band ===");
  const cases = [
    { experience: "new", rating: 400, expect: 1 },
    { experience: "knows_basics", rating: 400, expect: 2 },
    { experience: "plays_regularly", rating: 400, expect: 3 },
    { experience: undefined, rating: 400, expect: 1, note: "NULL experience_level -> treated as 'new'" },
  ];
  let day = "2099-01-01";
  for (const c of cases) {
    const childId = await makeChild({ label: "DC14D_" + (c.experience ?? "null"), rating: c.rating, experience: c.experience });
    const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: day });
    const served = r.data?.[0]?.out_level_served;
    check(`cold start ${c.note ?? "experience=" + c.experience} -> level ${c.expect}`, !r.error && served === c.expect, r.error?.message ?? `served ${served}`);
    await cleanupChild(childId);
    day = addDays(day, 1);
  }

  // A 'new' child with a strong rating: the existing +1 rating nudge still
  // applies, but the early cap (2) holds.
  console.log("\n=== Cold start: existing rating/Chess Mind nudges stay, capped by the band ===");
  {
    const childId = await makeChild({ label: "DC14D_newStrongRating", rating: 900, experience: "new" });
    const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: day });
    const served = r.data?.[0]?.out_level_served;
    check("new + rating 900 -> nudged to 2 but never past the 'new' cap of 2", !r.error && served === 2, r.error?.message ?? `served ${served}`);
    await cleanupChild(childId);
    day = addDays(day, 1);
  }
  {
    const childId = await makeChild({ label: "DC14D_playsRegStrong", rating: 900, experience: "plays_regularly" });
    const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: day });
    const served = r.data?.[0]?.out_level_served;
    check("plays_regularly + rating 900 -> nudged toward 4, capped at 4", !r.error && served === 4, r.error?.message ?? `served ${served}`);
    await cleanupChild(childId);
    day = addDays(day, 1);
  }

  // Warm start must ignore experience_level entirely: a child with real
  // history anchored at level 5 stays near 5 even if they claimed to be new.
  console.log("\n=== Warm start: experience_level is NOT consulted once history exists ===");
  {
    const childId = await makeChild({ label: "DC14D_warmNew", rating: 400, experience: "new" });
    let d = "2099-06-01";
    // pick a real level-5 puzzle id from the pool
    const { data: l5 } = await admin.from("daily_challenge_puzzles").select("puzzle_id").eq("level", 5).limit(1).single();
    for (let i = 0; i < 4; i++) { await seedHistoryRow(childId, d, l5.puzzle_id, 5, "solved", 1); d = addDays(d, 1); }
    const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: d });
    const served = r.data?.[0]?.out_level_served;
    check("history anchored at 5 + experience 'new' -> warm target stays 4-6 (not reset to 1)", !r.error && served >= 4 && served <= 6, r.error?.message ?? `served ${served}`);
    await cleanupChild(childId);
  }

  // RPC still returns a puzzle that exists in the pool.
  console.log("\n=== RPC still returns a valid puzzle ===");
  {
    const childId = await makeChild({ label: "DC14D_valid", experience: "knows_basics" });
    const r = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: "2099-12-31" });
    const pid = r.data?.[0]?.out_puzzle_id;
    const { data: exists } = await admin.from("daily_challenge_puzzles").select("puzzle_id").eq("puzzle_id", pid ?? "").maybeSingle();
    check("returned puzzle_id exists in daily_challenge_puzzles", !!pid && !!exists, `pid=${pid}`);
    check("returned mate_in is 1-3 and level_served 1-6", [1, 2, 3].includes(r.data?.[0]?.out_mate_in) && r.data?.[0]?.out_level_served >= 1 && r.data?.[0]?.out_level_served <= 6, JSON.stringify(r.data?.[0]));
    await cleanupChild(childId);
  }

  console.log(`\n=== COLD-START SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Cold-start test suite crashed:", err);
  process.exit(1);
});
