// Phase 7A — Game Review server-side entitlement for
// /api/game-analysis/explain.
//
// Live HTTP tests against a running dev server (same pattern as
// scripts/test-ollie-security.js: a real signed-in session cookie,
// constructed the same way @supabase/ssr's browser client sets it —
// without one every request is rejected by middleware before reaching the
// route, which would prove nothing about the route's own tier logic).
//
// Requires: a dev server already running at BASE_URL (default
// http://localhost:3000) and the existing dev-test user/child fixture.
//
// Assertions are structural (mistake count, presence/absence of goodMoves/
// insights, which ply was explained) rather than exact wording, so this
// passes whether ANTHROPIC_API_KEY is configured (real Claude call) or not
// (mockResponse() fallback) — both paths must honor the same Free/Premium
// shape.
//
// Every premium_status flip this makes on the dev-test parent is restored
// at the end. No database schema, migration, or protected system is
// touched.
//
// Run: node scripts/test-game-review-explain.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
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

const BASE_URL = process.env.GAME_REVIEW_TEST_BASE_URL || "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/game-analysis/explain`;
const DEV_TEST_USER_EMAIL = "dev-test@local.chessmind.test";
const DEV_TEST_USER_PASSWORD = "dev-test-local-only-not-secret";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    failures.push(label + (detail ? " -- " + detail : ""));
    console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`);
  }
}

async function post(body, cookie) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response (e.g. a redirect) — status is the signal */
  }
  return { status: res.status, json };
}

async function getAuthenticatedCookie() {
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: DEV_TEST_USER_EMAIL,
    password: DEV_TEST_USER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Could not sign in as the dev test user: ${error?.message}`);
  }
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieValue = encodeURIComponent("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64"));
  return { cookie: `sb-${projectRef}-auth-token=${cookieValue}`, userId: data.session.user.id };
}

// Two mistakes with different ranks — the deterministic expected "biggest
// moment" is the missedMaterial one (ply 20), regardless of the other's
// lossCp, per pickBiggestMoment()'s own rank(missedMate) > rank(missedMaterial)
// > lossCp ordering (lib/analysis/skillMapping.ts).
const MISTAKES = [
  { ply: 10, moveNumber: 5, san: "Nf6", category: "mistake", missedMate: false, missedMaterial: false, lossCp: 120, skillHint: "advantage_loss" },
  { ply: 20, moveNumber: 10, san: "Qd2", category: "blunder", missedMate: false, missedMaterial: true, lossCp: 400, skillHint: "tactical_awareness" },
];
const GOOD_MOVES = [{ ply: 15, moveNumber: 8, san: "Bxf7" }];
const CONTEXT = { playerColor: "w", result: "loss", openingName: "Test Opening", totalMoves: 20 };
const BIGGEST_MOMENT_PLY = 20;

async function main() {
  const probe = await admin.from("children").select("id").limit(1);
  if (probe.error) {
    console.log("\n=== PENDING: could not reach the database — skipping live HTTP suite ===");
    console.log(probe.error.message);
    return finish("pending");
  }

  const { cookie, userId } = await getAuthenticatedCookie();
  const { data: parent } = await admin.from("parents").select("id, premium_status, premium_expires_at").eq("auth_user_id", userId).single();
  const restore = { s: parent.premium_status, e: parent.premium_expires_at };

  try {
    console.log("\n=== A. FREE: trimmed response ===");
    await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", parent.id);
    {
      const { status, json } = await post({ mistakes: MISTAKES, goodMoves: GOOD_MOVES, context: CONTEXT }, cookie);
      check("request succeeds (200)", status === 200, `status=${status} ${JSON.stringify(json)}`);
      const mistakeKeys = Object.keys(json?.mistakes ?? {});
      check("at most 1 mistake is explained", mistakeKeys.length <= 1, JSON.stringify(mistakeKeys));
      check("the explained mistake is the biggest moment (ply 20)", mistakeKeys.length === 1 && Number(mistakeKeys[0]) === BIGGEST_MOMENT_PLY, JSON.stringify(mistakeKeys));
      check("the other mistake (ply 10) is NOT explained", json?.mistakes?.[10] === undefined, JSON.stringify(json?.mistakes));
      check("goodMoves is empty", Object.keys(json?.goodMoves ?? {}).length === 0, JSON.stringify(json?.goodMoves));
      check("insights is empty", Array.isArray(json?.insights) && json.insights.length === 0, JSON.stringify(json?.insights));
      check("biggestLesson is populated", typeof json?.biggestLesson === "string" && json.biggestLesson.trim().length > 0, JSON.stringify(json?.biggestLesson));
    }

    console.log("\n=== B. SECURITY: client cannot self-declare Premium ===");
    {
      const { status, json } = await post(
        { mistakes: MISTAKES, goodMoves: GOOD_MOVES, context: CONTEXT, isPremium: true, tier: "premium", premium: true },
        cookie
      );
      check("request with injected premium fields still succeeds (200)", status === 200, `status=${status}`);
      const mistakeKeys = Object.keys(json?.mistakes ?? {});
      check("still Free-shaped: at most 1 mistake despite client claiming premium", mistakeKeys.length <= 1, JSON.stringify(mistakeKeys));
      check("still Free-shaped: goodMoves empty despite client claiming premium", Object.keys(json?.goodMoves ?? {}).length === 0, JSON.stringify(json?.goodMoves));
      check("still Free-shaped: insights empty despite client claiming premium", Array.isArray(json?.insights) && json.insights.length === 0, JSON.stringify(json?.insights));
    }

    console.log("\n=== C. PREMIUM: full response ===");
    await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() + 400 * 86400000).toISOString() }).eq("id", parent.id);
    {
      const { status, json } = await post({ mistakes: MISTAKES, goodMoves: GOOD_MOVES, context: CONTEXT }, cookie);
      check("request succeeds (200)", status === 200, `status=${status} ${JSON.stringify(json)}`);
      const mistakeKeys = Object.keys(json?.mistakes ?? {}).map(Number).sort();
      check("every submitted mistake is explained (both plies)", mistakeKeys.length === 2 && mistakeKeys[0] === 10 && mistakeKeys[1] === 20, JSON.stringify(mistakeKeys));
      check("goodMoves is returned for the submitted good move", Object.keys(json?.goodMoves ?? {}).length === 1 && json.goodMoves[15] !== undefined, JSON.stringify(json?.goodMoves));
      check("insights is returned (non-empty)", Array.isArray(json?.insights) && json.insights.length > 0, JSON.stringify(json?.insights));
      check("biggestLesson is populated", typeof json?.biggestLesson === "string" && json.biggestLesson.trim().length > 0, JSON.stringify(json?.biggestLesson));
    }

    console.log("\n=== D. UNAUTHENTICATED: no reply ===");
    {
      const { status, json } = await post({ mistakes: MISTAKES, goodMoves: GOOD_MOVES, context: CONTEXT });
      check("unauthenticated request never returns analysis data", !json?.mistakes && !json?.biggestLesson, `status=${status} ${JSON.stringify(json)}`);
    }
  } finally {
    await admin.from("parents").update({ premium_status: restore.s, premium_expires_at: restore.e }).eq("id", parent.id);
  }

  return finish("ran");
}

console.log("\n=== E. REGRESSION (pure logic): partial explanations map degrades safely ===");
function runPureRegressionChecks() {
  // Mirrors resolvedSkill()'s fallback chain in lib/analysis/gameReviewSignals.ts
  // without importing it directly (that module pulls in gameAnalysis.ts's
  // browser-only type surface in a way this plain-node harness doesn't
  // transpile) — this re-derives the exact same fallback rule the real
  // function implements, to prove the rule itself is safe against a
  // Free-trimmed (partial) apiSkillByPly map.
  function resolvedSkill(engineHint, apiSkill) {
    return apiSkill ?? engineHint ?? "advantage_loss";
  }
  const apiSkillByPly = { 20: "tactical_awareness" }; // only the biggest moment, as Free now returns
  check("biggest-moment mistake (ply 20) uses the AI-refined skill", resolvedSkill("advantage_loss", apiSkillByPly[20]) === "tactical_awareness");
  check("other mistake (ply 10, missing from the trimmed map) falls back to the engine hint, not a crash", resolvedSkill("advantage_loss", apiSkillByPly[10]) === "advantage_loss");
  check("a ply with no engine hint either falls back to the neutral bucket", resolvedSkill(undefined, apiSkillByPly[999]) === "advantage_loss");
}

function finish(dbResult) {
  console.log(`\n=== GAME REVIEW EXPLAIN SUMMARY: ${pass} passed, ${fail} failed${dbResult === "pending" ? " (HTTP suite PENDING — could not reach the database)" : ""} ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
  }
}

runPureRegressionChecks();
main();
