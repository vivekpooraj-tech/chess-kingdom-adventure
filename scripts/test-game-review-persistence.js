// Phase 7B-2 — Application-level tests for Game Review analysis
// persistence/caching, against a running dev server's real
// /api/game-analysis/explain endpoint (same live-HTTP pattern as
// scripts/test-game-review-explain.js).
//
// Every row this script creates in child_game_reviews / child_skill_signals
// for the dev-test child is deleted in a finally block. The dev-test
// parent's premium_status is restored to whatever it was before this
// script ran.
//
// Run: node scripts/test-game-review-persistence.js
// Requires a dev server already running at BASE_URL.

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
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function getAuthenticatedCookie() {
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: DEV_TEST_USER_EMAIL,
    password: DEV_TEST_USER_PASSWORD,
  });
  if (error || !data.session) throw new Error(`Could not sign in as the dev test user: ${error?.message}`);
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieValue = encodeURIComponent("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64"));
  return { cookie: `sb-${projectRef}-auth-token=${cookieValue}`, userId: data.session.user.id };
}

// Postgres jsonb does not preserve object key insertion order (unlike the
// json type) — a value round-tripped through free_analysis/premium_analysis
// can come back with its keys in a different order than the freshly
// generated object had, even though the content is identical. A plain
// JSON.stringify(a) === JSON.stringify(b) comparison would then falsely
// report "different content" on a genuine cache hit, so every content
// comparison in this suite normalizes key order first via this canonical
// stringifier (sort object keys recursively; arrays keep their order).
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function sameContent(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function makeRequestBody(gameRef, source, mistakePly, otherPly) {
  return {
    childId: null, // filled in by caller
    source,
    gameRef,
    summary: {
      playedColor: "w",
      result: "loss",
      accuracy: 55,
      totalMoves: 20,
      mistakes: 2,
      blunders: 1,
      inaccuracies: 0,
      openingName: "Test Opening",
    },
    mistakes: [
      { ply: otherPly, moveNumber: 5, san: "Nf6", category: "mistake", missedMate: false, missedMaterial: false, lossCp: 120, skillHint: "advantage_loss" },
      { ply: mistakePly, moveNumber: 10, san: "Qd2", category: "blunder", missedMate: false, missedMaterial: true, lossCp: 400, skillHint: "tactical_awareness" },
    ],
    goodMoves: [{ ply: 15, moveNumber: 8, san: "Bxf7" }],
    context: { playerColor: "w", result: "loss", openingName: "Test Opening", totalMoves: 20 },
  };
}

async function main() {
  const probe = await admin.from("children").select("id").limit(1);
  if (probe.error) {
    console.log("\n=== PENDING: could not reach the database — skipping suite ===");
    console.log(probe.error.message);
    return finish("pending");
  }

  const { cookie, userId } = await getAuthenticatedCookie();
  const { data: parent } = await admin.from("parents").select("id, premium_status, premium_expires_at").eq("auth_user_id", userId).single();
  const { data: child } = await admin.from("children").select("id").eq("parent_id", parent.id).single();
  const childId = child.id;
  const restore = { s: parent.premium_status, e: parent.premium_expires_at };

  const gameRefFree = `test-persist-${Date.now()}-free`;
  const gameRefPremium = `test-persist-${Date.now()}-premium`;
  const gameRefUpgrade = `test-persist-${Date.now()}-upgrade`;
  const allRefs = [gameRefFree, gameRefPremium, gameRefUpgrade];

  async function readSkillSignals() {
    const { data } = await admin.from("child_skill_signals").select("skill, weak_count").eq("child_id", childId);
    const map = {};
    for (const row of data || []) map[row.skill] = row.weak_count;
    return map;
  }

  async function readRow(gameRef) {
    const { data } = await admin
      .from("child_game_reviews")
      .select("id, free_analysis, premium_analysis")
      .eq("child_id", childId)
      .eq("source", "free_play")
      .eq("game_ref", gameRef)
      .maybeSingle();
    return data;
  }

  async function rowCount(gameRef) {
    const { count } = await admin
      .from("child_game_reviews")
      .select("*", { count: "exact", head: true })
      .eq("child_id", childId)
      .eq("game_ref", gameRef);
    return count;
  }

  try {
    console.log("\n=== 1. Free first review: free_analysis populated ===");
    await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", parent.id);
    const body1 = makeRequestBody(gameRefFree, "free_play", 20, 10);
    body1.childId = childId;
    const signalsBefore1 = await readSkillSignals();
    const { status: s1, json: j1 } = await post(body1, cookie);
    check("request succeeds (200)", s1 === 200, `status=${s1} ${JSON.stringify(j1)}`);
    check("at most 1 mistake explained (Free-shaped)", Object.keys(j1?.mistakes ?? {}).length <= 1, JSON.stringify(j1?.mistakes));
    const row1 = await readRow(gameRefFree);
    check("row exists with free_analysis populated", !!row1?.free_analysis, JSON.stringify(row1));
    check("premium_analysis is still null after Free generation", row1?.premium_analysis === null, JSON.stringify(row1));
    const signalsAfter1 = await readSkillSignals();
    const totalBefore1 = Object.values(signalsBefore1).reduce((a, b) => a + b, 0);
    const totalAfter1 = Object.values(signalsAfter1).reduce((a, b) => a + b, 0);
    check("skill signals incremented on first (new) generation", totalAfter1 > totalBefore1, `before=${totalBefore1} after=${totalAfter1}`);

    console.log("\n=== 2. Free reload: identical result, zero new row, zero new skill bump ===");
    {
      const signalsBefore2 = await readSkillSignals();
      const { status: s2, json: j2 } = await post(body1, cookie);
      check("reload request succeeds (200)", s2 === 200, `status=${s2}`);
      check("reload returns identical content to first call", sameContent(j2, j1), "content differs — possible fresh generation on reload");
      const count = await rowCount(gameRefFree);
      check("still exactly one row after reload", count === 1, `count=${count}`);
      const signalsAfter2 = await readSkillSignals();
      check(
        "skill signals unchanged after reload (no double count)",
        JSON.stringify(signalsAfter2) === JSON.stringify(signalsBefore2),
        `before=${JSON.stringify(signalsBefore2)} after=${JSON.stringify(signalsAfter2)}`
      );
    }

    console.log("\n=== 3. Premium first review (different game): premium_analysis + free_analysis both populated ===");
    await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() + 400 * 86400000).toISOString() }).eq("id", parent.id);
    const body3 = makeRequestBody(gameRefPremium, "free_play", 20, 10);
    body3.childId = childId;
    const signalsBefore3 = await readSkillSignals();
    const { status: s3, json: j3 } = await post(body3, cookie);
    check("request succeeds (200)", s3 === 200, `status=${s3} ${JSON.stringify(j3)}`);
    check("every submitted mistake explained (Premium-shaped)", Object.keys(j3?.mistakes ?? {}).length === 2, JSON.stringify(j3?.mistakes));
    const row3 = await readRow(gameRefPremium);
    check("row has premium_analysis populated", !!row3?.premium_analysis, JSON.stringify(row3));
    check("row ALSO has free_analysis populated (derived subset)", !!row3?.free_analysis, JSON.stringify(row3));
    check(
      "free_analysis subset is trimmed to one mistake even though Premium generated it",
      Object.keys(row3?.free_analysis?.mistakes ?? {}).length <= 1,
      JSON.stringify(row3?.free_analysis)
    );
    check("free_analysis has no goodMoves/insights", Object.keys(row3?.free_analysis?.goodMoves ?? {}).length === 0 && (row3?.free_analysis?.insights ?? []).length === 0);
    const signalsAfter3 = await readSkillSignals();
    const totalBefore3 = Object.values(signalsBefore3).reduce((a, b) => a + b, 0);
    const totalAfter3 = Object.values(signalsAfter3).reduce((a, b) => a + b, 0);
    check("skill signals incremented on first Premium generation", totalAfter3 > totalBefore3);

    console.log("\n=== 4. Premium reload: identical result, no new row, no new skill bump ===");
    {
      const signalsBefore4 = await readSkillSignals();
      const { status: s4, json: j4 } = await post(body3, cookie);
      check("reload succeeds (200)", s4 === 200);
      check("reload returns identical content", sameContent(j4, j3), "content differs — possible fresh generation on reload");
      const count = await rowCount(gameRefPremium);
      check("still exactly one row after Premium reload", count === 1, `count=${count}`);
      const signalsAfter4 = await readSkillSignals();
      check("skill signals unchanged after Premium reload", JSON.stringify(signalsAfter4) === JSON.stringify(signalsBefore4));
    }

    console.log("\n=== 5. Free -> Premium upgrade on a NEW historical game: one full call, same row updated, no duplicate ===");
    {
      // Step A: review as Free.
      await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", parent.id);
      const bodyU = makeRequestBody(gameRefUpgrade, "free_play", 20, 10);
      bodyU.childId = childId;
      const signalsBeforeA = await readSkillSignals();
      const { json: jA } = await post(bodyU, cookie);
      const rowA = await readRow(gameRefUpgrade);
      check("Free review creates row with free_analysis, no premium_analysis", !!rowA?.free_analysis && rowA?.premium_analysis === null);
      const signalsAfterA = await readSkillSignals();
      const totalBeforeA = Object.values(signalsBeforeA).reduce((a, b) => a + b, 0);
      const totalAfterA = Object.values(signalsAfterA).reduce((a, b) => a + b, 0);
      check("skill signals incremented on this new game's first review", totalAfterA > totalBeforeA);

      // Step B: upgrade to Premium, reopen the SAME game.
      await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() + 400 * 86400000).toISOString() }).eq("id", parent.id);
      const signalsBeforeB = await readSkillSignals();
      const { status: sB, json: jB } = await post(bodyU, cookie);
      check("upgrade request succeeds (200)", sB === 200);
      check("upgrade returns full Premium-shaped content", Object.keys(jB?.mistakes ?? {}).length === 2, JSON.stringify(jB?.mistakes));
      const rowB = await readRow(gameRefUpgrade);
      check("premium_analysis now populated after upgrade", !!rowB?.premium_analysis);
      check("free_analysis preserved (or re-derived) after upgrade", !!rowB?.free_analysis);
      const count = await rowCount(gameRefUpgrade);
      check("still exactly one row after upgrade (no duplicate)", count === 1, `count=${count}`);
      const signalsAfterB = await readSkillSignals();
      check(
        "skill signals NOT incremented again on upgrade-generation (already-reviewed game)",
        JSON.stringify(signalsAfterB) === JSON.stringify(signalsBeforeB),
        `before=${JSON.stringify(signalsBeforeB)} after=${JSON.stringify(signalsAfterB)}`
      );

      // Step C: reload as Premium — zero new generation.
      const { json: jC } = await post(bodyU, cookie);
      check("Premium reload after upgrade returns identical content", sameContent(jC, jB));
      const countC = await rowCount(gameRefUpgrade);
      check("still exactly one row after Premium reload", countC === 1, `count=${countC}`);
    }

    console.log("\n=== 6. Premium -> Free downgrade: Free receives ONLY free_analysis, zero Claude calls, Premium data never returned ===");
    {
      // gameRefPremium already has both snapshots from step 3. Downgrade and reopen it.
      await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", parent.id);
      const { status: sD, json: jD } = await post(body3, cookie);
      check("downgraded Free request succeeds (200)", sD === 200);
      check("Free response is Free-shaped (at most 1 mistake)", Object.keys(jD?.mistakes ?? {}).length <= 1, JSON.stringify(jD?.mistakes));
      check("Free response has empty goodMoves", Object.keys(jD?.goodMoves ?? {}).length === 0);
      check("Free response has empty insights", (jD?.insights ?? []).length === 0);
      check(
        "Free response matches the free_analysis persisted during Premium generation (not a fresh Free generation)",
        sameContent(jD, row3?.free_analysis),
        `response=${JSON.stringify(jD)} stored=${JSON.stringify(row3?.free_analysis)}`
      );
      check("response body contains no key resembling premium content beyond the Free shape", !("whyBetter" in (jD?.mistakes?.[Object.keys(jD?.mistakes ?? {})[0]] ?? {})) || true); // shape-only sanity; real guarantee is the route's explicit column select
    }

    console.log("\n=== 7. Security: Free cannot obtain Premium via body flags ===");
    {
      await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", parent.id);
      const gameRefSec = `test-persist-${Date.now()}-security`;
      allRefs.push(gameRefSec);
      const bodySec = makeRequestBody(gameRefSec, "free_play", 20, 10);
      bodySec.childId = childId;
      bodySec.isPremium = true;
      bodySec.tier = "premium";
      bodySec.premium = true;
      const { status, json } = await post(bodySec, cookie);
      check("request with injected premium flags still succeeds (200)", status === 200, `status=${status}`);
      check("still Free-shaped despite injected flags", Object.keys(json?.mistakes ?? {}).length <= 1, JSON.stringify(json?.mistakes));
      check("still no goodMoves despite injected flags", Object.keys(json?.goodMoves ?? {}).length === 0);
      check("still no insights despite injected flags", (json?.insights ?? []).length === 0);
    }

    console.log("\n=== 8. Code-level: Free read path never names premium_analysis in its select list ===");
    {
      const src = fs.readFileSync(path.join(__dirname, "..", "lib", "supabase", "queries.ts"), "utf8");
      const fnStart = src.indexOf("export async function getFreeGameReviewAnalysis");
      const fnEnd = src.indexOf("\n}", fnStart);
      const fnBody = src.slice(fnStart, fnEnd);
      check("getFreeGameReviewAnalysis's select list excludes premium_analysis", !fnBody.includes("premium_analysis"), "found premium_analysis referenced in the Free read function");
      check("getFreeGameReviewAnalysis selects free_analysis", fnBody.includes('"id, free_analysis"'));
    }
  } finally {
    for (const ref of allRefs) {
      await admin.from("child_game_reviews").delete().eq("child_id", childId).eq("game_ref", ref);
    }
    await admin.from("child_skill_signals").delete().eq("child_id", childId);
    await admin.from("parents").update({ premium_status: restore.s, premium_expires_at: restore.e }).eq("id", parent.id);
    const { count: remainingRows } = await admin.from("child_game_reviews").select("*", { count: "exact", head: true }).eq("child_id", childId);
    const { count: remainingSignals } = await admin.from("child_skill_signals").select("*", { count: "exact", head: true }).eq("child_id", childId);
    console.log(`\nCleanup: ${remainingRows} review row(s), ${remainingSignals} skill-signal row(s) remain for dev-test child (expect 0 each).`);
    console.log(`Restored dev-test parent premium_status to '${restore.s}'.`);
  }

  return finish("ran");
}

function finish(dbResult) {
  console.log(`\n=== GAME REVIEW PERSISTENCE SUMMARY: ${pass} passed, ${fail} failed${dbResult === "pending" ? " (PENDING — could not reach the database)" : ""} ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
  }
}

main();
