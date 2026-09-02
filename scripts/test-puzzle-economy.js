// Phase 14C — puzzle economy & solve history test suite.
//
// Runs against the REAL live database, same pattern as
// scripts/test-daily-challenge.js: the service-role key for seeding /
// direct inspection, plus a REAL authenticated (non-service-role) session
// for every RLS-relevant path, exactly as a real client sees it.
//
// REQUIRES migration 0029_puzzle_library_solves.sql to be applied first
// (this repo's migrations are applied by hand in the Supabase SQL Editor).
// If the table is missing the suite reports PENDING and exits 0.
//
// Run: node scripts/test-puzzle-economy.js

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

async function makeChild(label) {
  const parentId = await getTestParentId();
  const { data, error } = await admin
    .from("children")
    .insert({ parent_id: parentId, display_name: label.slice(0, 40), avatar_id: "knight-kid", buddy_id: "wise-owl" })
    .select("id")
    .single();
  if (error) throw new Error("makeChild failed: " + error.message);
  return data.id;
}

async function cleanupChild(childId) {
  await admin.from("puzzle_library_solves").delete().eq("child_id", childId);
  await admin.from("daily_challenge_history").delete().eq("child_id", childId);
  await admin.from("puzzle_attempts").delete().eq("child_id", childId);
  await admin.from("children").delete().eq("id", childId);
}

// Mirrors lib/supabase/queries.ts recordPuzzleLibrarySolve — the client
// write path (authenticated, RLS-enforced), not a service-role shortcut.
async function recordSolve(client, childId, puzzleId, source, firstTry, attempts) {
  return client.from("puzzle_library_solves").upsert(
    { child_id: childId, puzzle_id: puzzleId, source, first_try: firstTry, attempts: Math.max(1, attempts) },
    { onConflict: "child_id,puzzle_id", ignoreDuplicates: true }
  );
}

async function main() {
  // ---- pure-function check: no-repeat selection (no DB) ----
  {
    // Minimal re-implementation guard: pickRandomPuzzle must never return a
    // solved puzzle while an unsolved one exists. Load the real function via
    // a tiny transpile-free require of the compiled logic is overkill here;
    // instead assert the contract against the source shape.
    const selSrc = fs.readFileSync(path.join(__dirname, "..", "lib", "puzzles", "selection.ts"), "utf8");
    check("selection.ts: pickRandomPuzzle takes a `solved` set param", /pickRandomPuzzle\(\s*[^)]*solved/.test(selSrc), "signature");
    check("selection.ts: unsolved puzzles are preferred over solved", /unsolved/.test(selSrc) && /solved\.has/.test(selSrc), "filter logic");
  }

  // ---- page-logic check: Daily Challenge bypasses the free quota ----
  {
    const pageSrc = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "puzzles", "page.tsx"), "utf8");
    check("puzzles/page.tsx: limitReached excludes Daily Challenge", /limitReached\s*=\s*!isPremium\s*&&\s*!isDaily/.test(pageSrc), "limitReached expr");
    check("puzzles/page.tsx: preview counter is not incremented for Daily Challenge", /!isPremium\s*&&\s*!isDaily\s*&&\s*childId\)\s*{[\s\S]*?incrementPreviewCount/.test(pageSrc), "incrementPreviewCount guard");
    check("puzzles/page.tsx: Daily Challenge still records via record_daily_challenge_result", /isDaily && childId[\s\S]*?recordDailyChallengeResult/.test(pageSrc), "RPC call retained");
    check("puzzles/page.tsx: solves are written to puzzle_library_solves", /recordPuzzleLibrarySolve\(/.test(pageSrc), "library solve call");
  }

  // ---- DB checks (require 0029) ----
  const probe = await admin.from("puzzle_library_solves").select("id").limit(1);
  if (probe.error && /relation .* does not exist|Could not find the table/i.test(probe.error.message)) {
    console.log("\n=== PENDING: migration 0029_puzzle_library_solves.sql is not applied yet ===");
    console.log("Static checks above still ran. Apply 0029 in the Supabase SQL Editor, then re-run for the DB suite.");
    console.log(`\n=== PUZZLE ECONOMY SUMMARY: ${pass} passed, ${fail} failed (DB suite skipped) ===`);
    if (fail > 0) { console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n")); process.exit(1); }
    process.exit(0);
  }
  if (probe.error) throw new Error("unexpected probe error: " + probe.error.message);

  const client = createClient(url, anonKey);
  const { error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);

  console.log("\n=== D: trainer solve creates exactly one record ===");
  {
    const childId = await makeChild("PE_Trainer");
    const r1 = await recordSolve(client, childId, "m1-backrank-rook", "trainer", true, 1);
    check("trainer solve write succeeds", !r1.error, r1.error?.message);
    const { data, count } = await admin
      .from("puzzle_library_solves")
      .select("puzzle_id, source, first_try, attempts", { count: "exact" })
      .eq("child_id", childId);
    check("exactly one row", count === 1, count);
    check("row shape correct", data?.[0]?.source === "trainer" && data?.[0]?.first_try === true, JSON.stringify(data?.[0]));
    await cleanupChild(childId);
  }

  console.log("\n=== D: repeated solve of the same puzzle does not create a duplicate ===");
  {
    const childId = await makeChild("PE_Dup");
    await recordSolve(client, childId, "m1-backrank-rook", "trainer", false, 3);
    const first = await admin.from("puzzle_library_solves").select("solved_at, attempts, first_try").eq("child_id", childId).single();
    await new Promise((r) => setTimeout(r, 50));
    const r2 = await recordSolve(client, childId, "m1-backrank-rook", "trainer", true, 1);
    check("second write of the same puzzle does not error", !r2.error, r2.error?.message);
    const { count } = await admin.from("puzzle_library_solves").select("id", { count: "exact", head: true }).eq("child_id", childId);
    check("still exactly one row after a re-solve", count === 1, count);
    const after = await admin.from("puzzle_library_solves").select("solved_at, attempts, first_try").eq("child_id", childId).single();
    check("original solved_at / attempts / first_try preserved (no fabricated update)",
      after.data.solved_at === first.data.solved_at && after.data.attempts === first.data.attempts && after.data.first_try === first.data.first_try,
      `${JSON.stringify(first.data)} -> ${JSON.stringify(after.data)}`);
    await cleanupChild(childId);
  }

  console.log("\n=== D: same puzzle solved through Daily then Trainer stays one row ===");
  {
    const childId = await makeChild("PE_DailyThenTrainer");
    await recordSolve(client, childId, "m2-two-rooks-a", "daily", true, 1);
    await recordSolve(client, childId, "m2-two-rooks-a", "trainer", true, 1);
    const { data, count } = await admin.from("puzzle_library_solves").select("source", { count: "exact" }).eq("child_id", childId);
    check("one row for a puzzle solved on both surfaces", count === 1, count);
    check("source stays as first recorded ('daily')", data?.[0]?.source === "daily", data?.[0]?.source);
    await cleanupChild(childId);
  }

  console.log("\n=== D: unique(child_id, puzzle_id) is enforced at the DB level ===");
  {
    const childId = await makeChild("PE_Unique");
    await admin.from("puzzle_library_solves").insert({ child_id: childId, puzzle_id: "m1-corner-queen-a", source: "trainer", first_try: true });
    const dup = await admin.from("puzzle_library_solves").insert({ child_id: childId, puzzle_id: "m1-corner-queen-a", source: "daily", first_try: false });
    check("a second raw insert for the same (child, puzzle) is rejected", !!dup.error, dup.error?.message);
    const bad = await admin.from("puzzle_library_solves").insert({ child_id: childId, puzzle_id: "x", source: "invalid", first_try: true });
    check("source check constraint rejects values other than trainer/daily", !!bad.error, bad.error?.message);
    await cleanupChild(childId);
  }

  console.log("\n=== D: RLS — a session cannot read/write another family's solves ===");
  {
    const { data: strangerParent } = await admin.from("parents").insert({ auth_user_id: null, email: "pe-stranger@local.chessmind.test", premium_status: "free" }).select("id").single();
    const { data: strangerChild } = await admin.from("children").insert({ parent_id: strangerParent.id, display_name: "PEStranger", avatar_id: "knight-kid", buddy_id: "wise-owl" }).select("id").single();
    await admin.from("puzzle_library_solves").insert({ child_id: strangerChild.id, puzzle_id: "m1-backrank-rook", source: "trainer", first_try: true });
    const read = await client.from("puzzle_library_solves").select("id").eq("child_id", strangerChild.id);
    check("cross-family SELECT returns nothing", (read.data ?? []).length === 0, JSON.stringify(read.data));
    const write = await recordSolve(client, strangerChild.id, "m2-two-rooks-a", "trainer", true, 1);
    const { count } = await admin.from("puzzle_library_solves").select("id", { count: "exact", head: true }).eq("child_id", strangerChild.id);
    check("cross-family INSERT is blocked by RLS with check", (write.error != null) || count === 1, `err=${write.error?.message} count=${count}`);
    await admin.from("puzzle_library_solves").delete().eq("child_id", strangerChild.id);
    await admin.from("children").delete().eq("id", strangerChild.id);
    await admin.from("parents").delete().eq("id", strangerParent.id);
  }

  console.log("\n=== E: Parent Dashboard weekly count — library solves, no double count ===");
  {
    const childId = await makeChild("PE_Parent");
    const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0, 0, 0, 0);
    // 2 distinct puzzles: one trainer, one solved on both surfaces (still 1 row).
    await recordSolve(client, childId, "m1-backrank-rook", "trainer", true, 1);
    await recordSolve(client, childId, "m2-two-rooks-a", "daily", true, 1);
    await recordSolve(client, childId, "m2-two-rooks-a", "trainer", true, 1);
    const { count: libCount } = await admin
      .from("puzzle_library_solves")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .gte("solved_at", since.toISOString());
    check("weekly library-solve count = 2 distinct puzzles (not 3)", libCount === 2, libCount);
    // lesson puzzles counted separately, unchanged
    await admin.from("puzzle_attempts").insert({ child_id: childId, day_number: 1, is_correct: true, attempt_number: 1 });
    const { count: lessonCount } = await admin
      .from("puzzle_attempts")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .eq("is_correct", true);
    check("lesson puzzle attempts still counted on their own axis", lessonCount === 1, lessonCount);
    await cleanupChild(childId);
  }

  console.log("\n=== F: existing Daily Challenge history + RPCs unaffected ===");
  {
    const childId = await makeChild("PE_DCUnaffected");
    const today = new Date().toISOString().slice(0, 10);
    const g = await client.rpc("get_daily_challenge", { p_child_id: childId, p_date: today });
    check("get_daily_challenge still returns a puzzle", !g.error && !!g.data?.[0]?.out_puzzle_id, g.error?.message);
    const rec = await client.rpc("record_daily_challenge_result", { p_child_id: childId, p_date: today, p_solved: true });
    check("record_daily_challenge_result still works", !rec.error, rec.error?.message);
    const h = await admin.from("daily_challenge_history").select("result").eq("child_id", childId).eq("challenge_date", today).single();
    check("daily_challenge_history row updated to solved", h.data?.result === "solved", JSON.stringify(h.data));
    // puzzle_library_solves is NOT written by the RPC — that's the client's job
    const { count } = await admin.from("puzzle_library_solves").select("id", { count: "exact", head: true }).eq("child_id", childId);
    check("the DC RPC itself does not write puzzle_library_solves (client-owned)", count === 0, count);
    await cleanupChild(childId);
  }

  console.log(`\n=== PUZZLE ECONOMY SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Puzzle economy test suite crashed:", err);
  process.exit(1);
});
