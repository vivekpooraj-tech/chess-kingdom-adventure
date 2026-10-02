// Phase 7B-2 — RPC-level tests for upsert_child_game_review_analysis,
// run BEFORE any application write path uses it (per the phase brief).
//
// Uses the real dev-test user's authenticated session (not service role)
// so auth.uid() inside the SECURITY DEFINER function is populated exactly
// as it would be from a real request — a service-role call would have a
// NULL auth.uid() and could never exercise the ownership check honestly.
//
// All rows this script creates are deleted in a finally block, regardless
// of pass/fail.
//
// Run: node scripts/test-game-review-persistence-rpc.js

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_TEST_USER_EMAIL = "dev-test@local.chessmind.test";
const DEV_TEST_USER_PASSWORD = "dev-test-local-only-not-secret";

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

async function main() {
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
    email: DEV_TEST_USER_EMAIL,
    password: DEV_TEST_USER_PASSWORD,
  });
  if (signInErr || !signIn.session) {
    console.log("Could not sign in as dev-test user:", signInErr?.message);
    process.exitCode = 1;
    return;
  }
  const userId = signIn.session.user.id;
  const { data: parent } = await admin.from("parents").select("id").eq("auth_user_id", userId).single();
  const { data: child } = await admin.from("children").select("id").eq("parent_id", parent.id).single();
  const childId = child.id;

  // A per-request authenticated client (mirrors what the Next.js route uses
  // via cookies — here we just set the session on an anon-key client).
  const asUser = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await asUser.auth.setSession({ access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token });

  const gameRefA = `test-rpc-${Date.now()}-a`;
  const gameRefB = `test-rpc-${Date.now()}-b`;
  const createdRefs = [gameRefA, gameRefB];

  async function call(params) {
    return asUser.rpc("upsert_child_game_review_analysis", params);
  }

  try {
    console.log("\n=== 1. First insert with game_ref ===");
    {
      const { data, error } = await call({
        p_child_id: childId,
        p_source: "free_play",
        p_game_ref: gameRefA,
        p_mistakes: 2,
        p_blunders: 1,
        p_inaccuracies: 0,
        p_free_analysis: { mistakes: { 10: { explanation: "free v1" } }, goodMoves: {}, biggestLesson: "l1", insights: [] },
        p_premium_analysis: null,
      });
      check("RPC succeeds", !error, error?.message);
      check("is_new_row is true on first insert", data?.[0]?.is_new_row === true, JSON.stringify(data));
      check("has_free_analysis true", data?.[0]?.has_free_analysis === true);
      check("has_premium_analysis false", data?.[0]?.has_premium_analysis === false);
    }

    console.log("\n=== 2 & 3. Repeat same identity (Free re-generation) — exactly one row, Premium preserved ===");
    {
      // First, seed a premium_analysis via a second call so we can prove a
      // subsequent Free-only call doesn't erase it.
      await call({
        p_child_id: childId,
        p_source: "free_play",
        p_game_ref: gameRefA,
        p_premium_analysis: { mistakes: { 10: { explanation: "premium v1" } }, goodMoves: {}, biggestLesson: "l1", insights: ["i1"] },
      });
      const { data, error } = await call({
        p_child_id: childId,
        p_source: "free_play",
        p_game_ref: gameRefA,
        p_free_analysis: { mistakes: { 10: { explanation: "free v2 (regenerated)" } }, goodMoves: {}, biggestLesson: "l1", insights: [] },
        p_premium_analysis: null,
      });
      check("RPC succeeds", !error, error?.message);
      check("is_new_row is false on repeat identity", data?.[0]?.is_new_row === false, JSON.stringify(data));
      check("has_premium_analysis still true (not erased by NULL)", data?.[0]?.has_premium_analysis === true);

      const { count } = await admin
        .from("child_game_reviews")
        .select("*", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("source", "free_play")
        .eq("game_ref", gameRefA);
      check("exactly one row exists for this identity", count === 1, `count=${count}`);

      const { data: row } = await admin
        .from("child_game_reviews")
        .select("free_analysis, premium_analysis")
        .eq("child_id", childId)
        .eq("source", "free_play")
        .eq("game_ref", gameRefA)
        .single();
      check(
        "free_analysis was updated to v2",
        row.free_analysis?.mistakes?.["10"]?.explanation === "free v2 (regenerated)",
        JSON.stringify(row.free_analysis)
      );
      check(
        "premium_analysis preserved from step 2 (v1)",
        row.premium_analysis?.mistakes?.["10"]?.explanation === "premium v1",
        JSON.stringify(row.premium_analysis)
      );
    }

    console.log("\n=== 4. Premium snapshot update preserves Free snapshot ===");
    {
      const { data, error } = await call({
        p_child_id: childId,
        p_source: "free_play",
        p_game_ref: gameRefA,
        p_free_analysis: null,
        p_premium_analysis: { mistakes: { 10: { explanation: "premium v2 (regenerated)" } }, goodMoves: { 4: { explanation: "gm" } }, biggestLesson: "l2", insights: ["i2"] },
      });
      check("RPC succeeds", !error, error?.message);
      const { data: row } = await admin
        .from("child_game_reviews")
        .select("free_analysis, premium_analysis")
        .eq("child_id", childId)
        .eq("source", "free_play")
        .eq("game_ref", gameRefA)
        .single();
      check(
        "free_analysis preserved from step 2/3 (v2, not erased by this NULL)",
        row.free_analysis?.mistakes?.["10"]?.explanation === "free v2 (regenerated)",
        JSON.stringify(row.free_analysis)
      );
      check(
        "premium_analysis updated to v2",
        row.premium_analysis?.mistakes?.["10"]?.explanation === "premium v2 (regenerated)",
        JSON.stringify(row.premium_analysis)
      );
    }

    console.log("\n=== 5. NULL values never erase existing snapshots (both NULL, no-op merge) ===");
    {
      await call({ p_child_id: childId, p_source: "free_play", p_game_ref: gameRefA, p_free_analysis: null, p_premium_analysis: null });
      const { data: row } = await admin
        .from("child_game_reviews")
        .select("free_analysis, premium_analysis")
        .eq("child_id", childId)
        .eq("source", "free_play")
        .eq("game_ref", gameRefA)
        .single();
      check("free_analysis still present after both-NULL call", row.free_analysis !== null);
      check("premium_analysis still present after both-NULL call", row.premium_analysis !== null);
    }

    console.log("\n=== 6. Unauthorized child rejected ===");
    {
      const fakeChildId = "00000000-0000-0000-0000-000000000000";
      const { error } = await call({
        p_child_id: fakeChildId,
        p_source: "free_play",
        p_game_ref: `test-rpc-unauthorized-${Date.now()}`,
        p_free_analysis: { mistakes: {}, goodMoves: {}, biggestLesson: "x", insights: [] },
      });
      check("RPC rejects a child the caller does not own", !!error, JSON.stringify(error));
      check("error message names the ownership failure", error?.message?.includes("not authorized"), error?.message);
    }

    console.log("\n=== 7. Different game_ref creates a different row ===");
    {
      const { data, error } = await call({
        p_child_id: childId,
        p_source: "free_play",
        p_game_ref: gameRefB,
        p_free_analysis: { mistakes: {}, goodMoves: {}, biggestLesson: "other game", insights: [] },
      });
      check("RPC succeeds for a second game_ref", !error, error?.message);
      check("is_new_row true for the new game_ref", data?.[0]?.is_new_row === true);
      const { count } = await admin
        .from("child_game_reviews")
        .select("*", { count: "exact", head: true })
        .eq("child_id", childId)
        .in("game_ref", [gameRefA, gameRefB]);
      check("two distinct rows now exist (A and B)", count === 2, `count=${count}`);
    }

    console.log("\n=== 8. Historical NULL game_ref rows remain untouched / unaffected ===");
    {
      // Insert two plain historical-style rows directly (as the pre-Phase-7B
      // code path would have) with game_ref left NULL, and confirm the
      // partial index lets both coexist without any conflict — proving the
      // RPC's uniqueness boundary never interferes with historical rows.
      const { error: e1 } = await admin.from("child_game_reviews").insert({
        child_id: childId,
        source: "free_play",
        mistakes: 0,
        blunders: 0,
        inaccuracies: 0,
      });
      const { error: e2 } = await admin.from("child_game_reviews").insert({
        child_id: childId,
        source: "free_play",
        mistakes: 0,
        blunders: 0,
        inaccuracies: 0,
      });
      check("first historical NULL-game_ref insert succeeds", !e1, e1?.message);
      check("second historical NULL-game_ref insert also succeeds (no conflict)", !e2, e2?.message);
      // Clean these two up immediately — they're not tied to createdRefs.
      await admin.from("child_game_reviews").delete().eq("child_id", childId).is("game_ref", null);
    }

    console.log("\n=== 9. Concurrent same-game writes cannot create duplicate rows ===");
    {
      const gameRefC = `test-rpc-${Date.now()}-concurrent`;
      createdRefs.push(gameRefC);
      const results = await Promise.all(
        Array.from({ length: 8 }).map((_, i) =>
          call({
            p_child_id: childId,
            p_source: "free_play",
            p_game_ref: gameRefC,
            p_free_analysis: { mistakes: {}, goodMoves: {}, biggestLesson: `concurrent ${i}`, insights: [] },
          })
        )
      );
      const errors = results.filter((r) => r.error);
      check("all 8 concurrent calls succeed (no errors)", errors.length === 0, JSON.stringify(errors));
      const newRowFlags = results.map((r) => r.data?.[0]?.is_new_row);
      const newRowCount = newRowFlags.filter(Boolean).length;
      check(
        "exactly one of the 8 concurrent calls reports is_new_row=true",
        newRowCount === 1,
        `is_new_row flags: ${JSON.stringify(newRowFlags)}`
      );
      const { count } = await admin
        .from("child_game_reviews")
        .select("*", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("game_ref", gameRefC);
      check("exactly one row exists after 8 concurrent writes", count === 1, `count=${count}`);
    }
  } finally {
    for (const ref of createdRefs) {
      await admin.from("child_game_reviews").delete().eq("child_id", childId).eq("game_ref", ref);
    }
    const { count: remaining } = await admin
      .from("child_game_reviews")
      .select("*", { count: "exact", head: true })
      .eq("child_id", childId);
    console.log(`\nCleanup: ${remaining} row(s) remain for dev-test child after cleanup (expect 0).`);
  }

  console.log(`\n=== RPC TEST SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
  }
}

main();
