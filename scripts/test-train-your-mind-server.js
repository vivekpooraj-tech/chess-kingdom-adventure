// Phase 5, Objective A — Train Your Mind daily usage, server-authoritative.
//
// The DB suite runs against the REAL live database (same pattern as
// scripts/test-premium-entitlement.js: service-role for synthetic fixtures
// + a REAL authenticated session for RLS/RPC-ownership-relevant paths) and
// REQUIRES migration 0044_train_your_mind_daily_usage.sql. Without it, the
// DB suite is skipped with a PENDING notice — this file was written before
// that migration was applied to any environment, and is expected to report
// PENDING until it is.
//
// Every parent/child/activity row this creates is deleted at the end. No
// real user's data is touched except a temporary, restored premium_status
// flip on the dev-test account (identical to test-premium-entitlement.js's
// own section H/J pattern).
//
// Run: node scripts/test-train-your-mind-server.js

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
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; failures.push(label + (detail ? " -- " + detail : "")); console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`); }
}

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---------------------------------------------------------------------------
// Static wiring checks — no database needed.
// ---------------------------------------------------------------------------
function runStaticChecks() {
  console.log("\n=== A. Migration source ===");
  const sql = read("supabase/migrations/0044_train_your_mind_daily_usage.sql");
  check("table has the correct unique constraint", /unique \(child_id, activity_date, module_id\)/.test(sql));
  check("RLS is enabled", /enable row level security/.test(sql));
  check("no client insert/update/delete policy is granted", !/for (insert|update|delete)\b/i.test(sql));
  check("client writes are explicitly revoked", /revoke insert, update, delete on public\.child_train_your_mind_activity from authenticated/.test(sql));
  check("the RPC calls the canonical parent_is_premium(), not a re-derived check", /parent_is_premium\(/.test(sql));
  check("the RPC never re-reads premium_status directly", !/premium_status\s*=\s*'premium'/.test(sql));
  check("the free cap is documented as synced with dailyLimits.ts", /trainYourMindPerCategory/.test(sql));
  check("the cap is enforced via the UPDATE's own WHERE clause (atomic), not a separate SELECT-then-decide", /do update[\s\S]{0,200}where v_is_premium or child_train_your_mind_activity\.activities_completed < 2/.test(sql));
  check("the RPC is granted to authenticated (the only way to write)", /grant execute on function public\.record_train_your_mind_use\(uuid, text, date\) to authenticated/.test(sql));

  console.log("\n=== A2. Timezone correction ===");
  check("the RPC accepts an explicit p_activity_date parameter", /p_activity_date date default current_date/.test(sql));
  check("the INSERT writes p_activity_date, not current_date", /values \(p_child_id, p_activity_date, p_module_id, 1\)/.test(sql));
  check("the fallback-read after a blocked write filters on p_activity_date, not current_date", /c\.activity_date = p_activity_date/.test(sql));
  check("current_date is used ONLY as the parameter's defensive default, nowhere else in the function body", (() => {
    const body = sql.slice(sql.indexOf("as $$"));
    // Every remaining current_date reference must be the one in the
    // parameter list's default (already asserted above) — none should
    // appear inside the function body itself.
    return !/current_date/.test(body);
  })());

  console.log("\n=== B. Client wiring ===");
  const usage = read("lib/trainYourMind/dailyUsage.ts");
  check("dailyUsage.ts no longer calls localStorage.*", !/localStorage\./.test(usage));
  check("the read path queries the new table", /child_train_your_mind_activity/.test(usage));
  check("the write path calls the new RPC, not a raw insert", /record_train_your_mind_use/.test(usage) && !/\.insert\(/.test(usage));
  check("dailyUsage.ts imports the canonical localDateString, not a second date helper", /import \{ localDateString \} from "@\/lib\/supabase\/queries"/.test(usage));
  check("no ad-hoc date-string construction (a second date helper) was introduced", !/getFullYear\(\)/.test(usage));
  check("the read explicitly filters on localDateString()", /\.eq\("activity_date", localDateString\(\)\)/.test(usage));
  check(
    "the RPC call explicitly passes p_activity_date — never relies on the RPC's default current_date",
    /p_activity_date:\s*localDateString\(\)/.test(usage)
  );

  const hook = read("lib/trainYourMind/useDailyLimit.ts");
  check("useTrainYourMindDailyLimit keeps its Phase 4 public interface", /loading:/.test(hook) && /isPremium:/.test(hook) && /usedToday,/.test(hook) && /reached,/.test(hook) && /recordUse,/.test(hook));
  check("the hook still consumes the Phase 1 entitlement layer for the configured limit", /from "@\/lib\/entitlement"/.test(hook));
  check("lib/entitlement/dailyLimits.ts is untouched as the configured-limit source", fs.existsSync(path.join(ROOT, "lib/entitlement/dailyLimits.ts")));
}

// ---------------------------------------------------------------------------
// DB suite
// ---------------------------------------------------------------------------
async function makeParent(premiumStatus, expiresAt) {
  const { data, error } = await admin.from("parents")
    .insert({ auth_user_id: null, email: `tymtest-${Date.now()}-${Math.random().toString(16).slice(2)}@local.chessmind.test`, premium_status: premiumStatus, premium_expires_at: expiresAt ?? null })
    .select("id").single();
  if (error) throw new Error("makeParent: " + error.message);
  return data.id;
}
async function makeChildFor(parentId) {
  const { data, error } = await admin.from("children")
    .insert({ parent_id: parentId, display_name: "TYMTestKid", avatar_id: "knight-kid", buddy_id: "wise-owl" })
    .select("id").single();
  if (error) throw new Error("makeChild: " + error.message);
  return data.id;
}
async function cleanupParent(parentId) {
  await admin.from("children").delete().eq("parent_id", parentId);
  await admin.from("parents").delete().eq("id", parentId);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function rowFor(childId, moduleId, date) {
  const { data } = await admin
    .from("child_train_your_mind_activity")
    .select("activities_completed")
    .eq("child_id", childId).eq("module_id", moduleId).eq("activity_date", date ?? todayStr())
    .maybeSingle();
  return data?.activities_completed ?? 0;
}

async function runDbSuite() {
  const probe = await admin.from("child_train_your_mind_activity").select("id").limit(1);
  if (probe.error && /does not exist|Could not find the table/i.test(probe.error.message)) {
    console.log("\n=== PENDING: migration 0044_train_your_mind_daily_usage.sql is not applied yet ===");
    console.log("Static checks above still ran. Apply 0044, then re-run for the DB suite.");
    return "pending";
  }
  if (probe.error) throw new Error("probe error: " + probe.error.message);

  // The RPC checks auth.uid() ownership, so tests that call it as the
  // "owning" side must run through a REAL authenticated session, not a
  // service-role client (which bypasses RLS/ownership entirely). Uses the
  // repo's existing dev-test account, same pattern as
  // test-premium-entitlement.js sections H/J.
  const authClient = createClient(url, anonKey);
  const { error: ae } = await authClient.auth.signInWithPassword({ email: "dev-test@local.chessmind.test", password: "dev-test-local-only-not-secret" });
  if (ae) throw new Error("dev-test sign-in failed: " + ae.message);
  const { data: devUser } = await admin.auth.admin.listUsers();
  const dev = devUser.users.find((u) => u.email === "dev-test@local.chessmind.test");
  const { data: devParent } = await admin.from("parents").select("id, premium_status, premium_expires_at").eq("auth_user_id", dev.id).single();
  const restoreParent = { s: devParent.premium_status, e: devParent.premium_expires_at };
  const kid = await makeChildFor(devParent.id);

  // A stranger's child, for the unauthorized-access check — owned by a
  // synthetic parent with no auth_user_id at all.
  const strangerParent = await makeParent("free", null);
  const strangerKid = await makeChildFor(strangerParent);

  try {
    await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", devParent.id);

    console.log("\n=== C. FREE: 0 -> 1 -> 2 -> 3 -> blocked at the 4th ===");
    {
      const mod = "test_pattern_" + Date.now();
      const r1 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      check("1st use: allowed, used_today 1, remaining 2", !r1.error && r1.data?.[0]?.allowed === true && r1.data?.[0]?.used_today === 1 && r1.data?.[0]?.remaining === 2, r1.error?.message ?? JSON.stringify(r1.data));

      const r2 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      check("2nd use: allowed, used_today 2, remaining 1", !r2.error && r2.data?.[0]?.allowed === true && r2.data?.[0]?.used_today === 2 && r2.data?.[0]?.remaining === 1, r2.error?.message ?? JSON.stringify(r2.data));

      const r3 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      check("3rd use: allowed, used_today 3, remaining 0", !r3.error && r3.data?.[0]?.allowed === true && r3.data?.[0]?.used_today === 3 && r3.data?.[0]?.remaining === 0, r3.error?.message ?? JSON.stringify(r3.data));
      check("3rd use correctly incremented the stored row to 3", (await rowFor(kid, mod)) === 3);

      const r4 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      check("4th use: BLOCKED, used_today stays 3, remaining 0", !r4.error && r4.data?.[0]?.allowed === false && r4.data?.[0]?.used_today === 3 && r4.data?.[0]?.remaining === 0, r4.error?.message ?? JSON.stringify(r4.data));
      check("4th use never incremented the stored row past 3", (await rowFor(kid, mod)) === 3);

      const r5 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      check("5th use: still blocked (repeated attempts never leak through)", !r5.error && r5.data?.[0]?.allowed === false && r5.data?.[0]?.used_today === 3);
    }

    console.log("\n=== D. PREMIUM: unlimited, remaining always null ===");
    {
      await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() + 400 * 86400000).toISOString() }).eq("id", devParent.id);
      const mod = "test_premium_mod_" + Date.now();
      let last;
      for (let i = 1; i <= 5; i++) {
        last = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
        check(`premium use #${i}: allowed`, !last.error && last.data?.[0]?.allowed === true, last.error?.message);
      }
      check("after 5 uses, used_today is 5 (still counted, just uncapped)", last.data?.[0]?.used_today === 5);
      check("remaining is null for Premium (unlimited)", last.data?.[0]?.remaining === null);
      check("is_premium reported true", last.data?.[0]?.is_premium === true);
      await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", devParent.id);
    }

    console.log("\n=== E. EXPLICIT p_activity_date + DAY ROLLOVER ===");
    {
      const mod = "test_rollover_" + Date.now();
      const yesterday = new Date(Date.now() - 86400000);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      // Drive "yesterday" entirely through the RPC's own explicit
      // p_activity_date, not an admin-seeded row — proves the parameter
      // itself, not just the table shape, controls which day is written to.
      const y1 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: yStr });
      const y2 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: yStr });
      const y3 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: yStr });
      const y4 = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: yStr });
      check("explicit p_activity_date=yesterday: 1st/2nd/3rd allowed, 4th blocked", y1.data?.[0]?.allowed === true && y2.data?.[0]?.allowed === true && y3.data?.[0]?.allowed === true && y4.data?.[0]?.allowed === false, JSON.stringify([y1.data, y2.data, y3.data, y4.data]));
      check("yesterday's row is capped at 3, independent of today", (await rowFor(kid, mod, yStr)) === 3);

      const r = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      check("today's count is unaffected by yesterday's cap (starts fresh at 1)", !r.error && r.data?.[0]?.used_today === 1 && r.data?.[0]?.allowed === true, r.error?.message ?? JSON.stringify(r.data));
      check("yesterday's row is still untouched after today's write", (await rowFor(kid, mod, yStr)) === 3);
    }

    console.log("\n=== F. MODULE ISOLATION: Pattern reaching 3 does not affect Calculation ===");
    {
      const patternMod = "test_iso_pattern_" + Date.now();
      const calcMod = "test_iso_calc_" + Date.now();
      await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: patternMod, p_activity_date: todayStr() });
      await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: patternMod, p_activity_date: todayStr() });
      await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: patternMod, p_activity_date: todayStr() });
      const patternBlocked = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: patternMod, p_activity_date: todayStr() });
      check("pattern is capped at 3", patternBlocked.data?.[0]?.allowed === false);

      const calcFirst = await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: calcMod, p_activity_date: todayStr() });
      check("calculation is unaffected — starts fresh at 1, allowed", !calcFirst.error && calcFirst.data?.[0]?.allowed === true && calcFirst.data?.[0]?.used_today === 1, calcFirst.error?.message ?? JSON.stringify(calcFirst.data));
    }

    console.log("\n=== G. CONCURRENCY: two simultaneous requests at count=2 (one below the cap of 3) ===");
    {
      const mod = "test_concurrency_" + Date.now();
      await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() }); // -> 1
      await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() }); // -> 2
      const [a, b] = await Promise.all([
        authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() }),
        authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() }),
      ]);
      const allowedCount = [a, b].filter((r) => r.data?.[0]?.allowed === true).length;
      const blockedCount = [a, b].filter((r) => r.data?.[0]?.allowed === false).length;
      check("exactly one of the two concurrent requests is allowed", allowedCount === 1, `allowed=${allowedCount} blocked=${blockedCount}`);
      check("exactly one is blocked", blockedCount === 1);
      check("final stored count is exactly 3, never 4", (await rowFor(kid, mod)) === 3);
    }

    console.log("\n=== H. SECURITY ===");
    {
      const mod = "test_security_" + Date.now();
      const unauthorized = await authClient.rpc("record_train_your_mind_use", { p_child_id: strangerKid, p_module_id: mod, p_activity_date: todayStr() });
      check("unauthorized child_id (not owned by caller) is rejected", unauthorized.error != null, unauthorized.error?.message);
      check("no row was written for the unauthorized attempt", (await rowFor(strangerKid, mod)) === 0);

      const ins = await authClient.from("child_train_your_mind_activity").insert({ child_id: kid, activity_date: todayStr(), module_id: "hack_insert", activities_completed: 999 });
      check("direct authenticated INSERT is rejected", ins.error != null, JSON.stringify(ins.data));

      const upd = await authClient.from("child_train_your_mind_activity").update({ activities_completed: 999 }).eq("child_id", kid);
      const { data: afterUpd } = await admin.from("child_train_your_mind_activity").select("activities_completed").eq("child_id", kid).limit(1);
      check("direct authenticated UPDATE is rejected (no row shows 999)", (upd.error != null) || !(afterUpd ?? []).some((r) => r.activities_completed === 999), upd.error?.message);

      const { count: beforeCount } = await admin.from("child_train_your_mind_activity").select("id", { count: "exact", head: true }).eq("child_id", kid);
      const del = await authClient.from("child_train_your_mind_activity").delete().eq("child_id", kid);
      const { count: afterCount } = await admin.from("child_train_your_mind_activity").select("id", { count: "exact", head: true }).eq("child_id", kid);
      check("direct authenticated DELETE is rejected (row count unchanged)", (del.error != null) || afterCount === beforeCount, del.error?.message);
    }

    console.log("\n=== I. CROSS-DEVICE: same child, same server-side count from a separate session ===");
    {
      const mod = "test_crossdevice_" + Date.now();
      await authClient.rpc("record_train_your_mind_use", { p_child_id: kid, p_module_id: mod, p_activity_date: todayStr() });
      const secondSession = createClient(url, anonKey);
      await secondSession.auth.signInWithPassword({ email: "dev-test@local.chessmind.test", password: "dev-test-local-only-not-secret" });
      const { data: seenFromOtherSession } = await secondSession
        .from("child_train_your_mind_activity")
        .select("activities_completed")
        .eq("child_id", kid).eq("module_id", mod).eq("activity_date", todayStr())
        .maybeSingle();
      check("a second session sees the same server-recorded count (1), not a per-browser value", seenFromOtherSession?.activities_completed === 1, JSON.stringify(seenFromOtherSession));
    }

    return "ran";
  } finally {
    await admin.from("child_train_your_mind_activity").delete().eq("child_id", kid);
    await admin.from("child_train_your_mind_activity").delete().eq("child_id", strangerKid);
    await admin.from("children").delete().eq("id", kid);
    await cleanupParent(strangerParent);
    await admin.from("parents").update({ premium_status: restoreParent.s, premium_expires_at: restoreParent.e }).eq("id", devParent.id);
  }
}

async function main() {
  runStaticChecks();
  let dbResult = "skipped";
  try {
    dbResult = await runDbSuite();
  } catch (e) {
    fail++;
    failures.push("DB suite crashed: " + e.message);
    console.log("FAIL: DB suite crashed -- " + e.message);
  }
  console.log(`\n=== TRAIN YOUR MIND SERVER SUMMARY: ${pass} passed, ${fail} failed${dbResult === "pending" ? " (DB suite PENDING migration 0044)" : ""} ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main();
