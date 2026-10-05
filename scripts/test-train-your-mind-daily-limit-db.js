/**
 * LIVE-DATABASE counterpart of scripts/test-train-your-mind-daily-limit.js.
 *
 * Runs the same scenarios against the REAL functions of migration 0055
 * (record_train_your_mind_completion / get_train_your_mind_usage). It REQUIRES that migration, so it
 * is meant to be run once, right after the migration has been approved and applied — it reports
 * PENDING (and exits 0) if the migration is not there yet. It was written but NOT run before that
 * approval.
 *
 * Rule under test: 3 completed exercises PER CATEGORY, per child, per day; the eight categories are
 * independent; Premium is unlimited.
 *
 * Fixtures: two temporary children under the repo's existing dev-test parent plus a temporary
 * "stranger" parent/child (service-role, no auth user), all removed at the end — only rows this
 * script created are deleted.
 *
 *   node scripts/test-train-your-mind-daily-limit-db.js
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  const k = t.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = v;
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opt = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL_, SVC, opt);
const authed = createClient(URL_, ANON, opt);
const second = createClient(URL_, ANON, opt); // "another device"
const anon = createClient(URL_, ANON, opt);
const MODULES = ["pattern", "visualization", "calculation", "memory", "spatial", "mathematics", "reaction", "tactical"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DATE = ymd(new Date());

let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok  " + n); } else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL " + n + (d ? " -- " + d : "")); } };
const rec = (c, child, module, key, date = DATE) => c.rpc("record_train_your_mind_completion", { p_child_id: child, p_module_id: module, p_completion_key: key, p_exercise_id: "x:test", p_activity_date: date });
const usageAll = (c, child, date = DATE) => c.rpc("get_train_your_mind_usage", { p_child_id: child, p_activity_date: date });
const first = (r) => (Array.isArray(r.data) ? r.data[0] : r.data);
const usageOf = async (c, child, module, date) => { const r = await usageAll(c, child, date); return (r.data || []).find((x) => x.module_id === module); };
let n = 0; const key = () => `dbtest-${Date.now().toString(36)}-${++n}-${Math.random().toString(36).slice(2, 8)}`;

(async () => {
  const created = { children: [], parents: [] };
  let devParentId = null, premiumBefore = null;
  try {
    const probe = await usageAll(admin, "00000000-0000-0000-0000-000000000000");
    if (probe.error && /does not exist|could not find the function|schema cache/i.test(probe.error.message)) {
      console.log("PENDING: migration 0055 is not applied in this environment. Apply it, then re-run.");
      return;
    }
    const { error: se } = await authed.auth.signInWithPassword({ email: "dev-test@local.chessmind.test", password: "dev-test-local-only-not-secret" });
    check("dev-test parent signs in", !se, se && se.message);
    await second.auth.signInWithPassword({ email: "dev-test@local.chessmind.test", password: "dev-test-local-only-not-secret" });
    const { data: users } = await admin.auth.admin.listUsers();
    const dev = users.users.find((u) => u.email === "dev-test@local.chessmind.test");
    const { data: devParent } = await admin.from("parents").select("id, premium_status, premium_expires_at").eq("auth_user_id", dev.id).single();
    devParentId = devParent.id; premiumBefore = { s: devParent.premium_status, e: devParent.premium_expires_at };
    await admin.from("parents").update({ premium_status: "free", premium_expires_at: null }).eq("id", devParentId);

    const mk = async (parentId) => { const { data, error } = await admin.from("children").insert({ parent_id: parentId }).select("id").single(); if (error) throw error; created.children.push(data.id); return data.id; };
    const kidA = await mk(devParentId), kidB = await mk(devParentId);
    const sp = await admin.from("parents").insert({ auth_user_id: null, email: `tymcat-${Date.now()}@local.chessmind.test`, premium_status: "free" }).select("id").single();
    created.parents.push(sp.data.id);
    const stranger = await mk(sp.data.id);

    console.log("\n== The usage RPC reports all eight categories ==");
    const all0 = await usageAll(authed, kidA);
    check("one row per category (8), each 0/3 with limit 3", (all0.data || []).length === 8 && MODULES.every((m) => (all0.data || []).some((x) => x.module_id === m && x.used_today === 0 && x.remaining === 3 && x.daily_limit === 3 && x.is_premium === false)));

    console.log("\n== Each category: 0/3 -> 1/3 -> 2/3 -> 3/3 -> 4th refused (all eight, independently) ==");
    for (const m of MODULES) {
      const device = MODULES.indexOf(m) % 2 ? second : authed; // alternate devices
      const r1 = first(await rec(authed, kidA, m, key())), r2 = first(await rec(device, kidA, m, key())), r3 = first(await rec(authed, kidA, m, key()));
      const r4 = first(await rec(device, kidA, m, key()));
      check(`${m}: 1/3, 2/3, 3/3 allowed; 4th REJECTED`, r1.allowed && r1.used_today === 1 && r2.allowed && r2.used_today === 2 && r3.allowed && r3.used_today === 3 && r3.remaining === 0 && r4.allowed === false && r4.used_today === 3);
    }
    const allDone = await usageAll(authed, kidA);
    check("every category sits at exactly 3/3 (24 completions in total, never more than 3 in one)", (allDone.data || []).every((x) => x.used_today === 3 && x.remaining === 0));

    console.log("\n== Independence: one category at 3/3 leaves the others open ==");
    for (let i = 0; i < 3; i++) await rec(authed, kidB, "pattern", key());
    check("Pattern at 3/3 does not affect Tactical Thinking or Calculation", (await usageOf(authed, kidB, "tactical")).used_today === 0 && first(await rec(authed, kidB, "tactical", key())).allowed && first(await rec(authed, kidB, "calculation", key())).allowed);
    check("Pattern itself is refused", first(await rec(second, kidB, "pattern", key())).allowed === false);

    console.log("\n== Duplicates, prefetch-style reads, concurrency, siblings ==");
    const k = key();
    const a = first(await rec(authed, kidB, "memory", k)), b = first(await rec(authed, kidB, "memory", k)), c = first(await rec(second, kidB, "memory", k));
    check("the same completion sent 3 times (2 devices) consumes ONE slot", a.allowed && !a.duplicate && b.duplicate && c.duplicate && c.used_today === 1);
    for (let i = 0; i < 10; i++) await usageAll(authed, kidB);
    check("reading usage (serving/prefetching) never consumes a slot", (await usageOf(authed, kidB, "memory")).used_today === 1);
    const par = await Promise.all(Array.from({ length: 6 }, () => rec(authed, kidB, "spatial", key())));
    check("6 concurrent completions in an empty category let exactly THREE through (advisory lock)", par.filter((x) => first(x).allowed).length === 3 && (await usageOf(authed, kidB, "spatial")).used_today === 3);
    check("a sibling is independent (kidB's Pattern is locked, kidA's other counters are untouched)", (await usageOf(authed, kidA, "reaction")).used_today === 3);

    console.log("\n== Days ==");
    const tomorrow = new Date(Date.now() + 86400000); const tmr = ymd(tomorrow);
    const nd = first(await rec(authed, kidA, "pattern", key(), tmr));
    check("a new day (forward) opens a fresh bucket for that category", nd.allowed && nd.used_today === 1);
    const back = first(await rec(authed, kidA, "pattern", key(), DATE));
    check("going back to an earlier date is clamped to the latest bucket (alternating dates mints nothing)", back.used_today === 2 && back.allowed);
    check("a far-future date is clamped, not honoured", !(await usageAll(authed, kidA, "2035-01-01")).error);

    console.log("\n== Authorization, validation, privileges ==");
    const bad = await rec(authed, stranger, "pattern", key());
    check("another family's child is refused", !!bad.error && /not authorized/i.test(bad.error.message));
    check("an invalid module is refused", !!(await rec(authed, kidB, "bogus", key())).error);
    check("a too-short key is refused", !!(await rec(authed, kidB, "pattern", "x")).error);
    check("anonymous callers cannot record or read", !!(await rec(anon, kidB, "pattern", key())).error && !!(await usageAll(anon, kidB)).error);
    const direct = await authed.from("child_train_your_mind_completions").insert({ child_id: kidB, completion_key: key(), activity_date: DATE, module_id: "pattern" });
    check("direct table INSERT by a parent is rejected (RPC-only writes)", !!direct.error);
    check("a parent can read their own child's ledger via RLS but not the stranger's", (await authed.from("child_train_your_mind_completions").select("completion_key").eq("child_id", kidA)).data.length >= 24 && (await authed.from("child_train_your_mind_completions").select("completion_key").eq("child_id", stranger)).data.length === 0);

    console.log("\n== Premium ==");
    await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() + 400 * 86400000).toISOString() }).eq("id", devParentId);
    const prem = [];
    for (let i = 0; i < 8; i++) prem.push(first(await rec(authed, kidA, "reaction", key())));
    check("Premium is unlimited (8 more in a category already at 3/3 while free)", prem.every((x) => x.allowed && x.remaining === null && x.is_premium));
    const pu = await usageOf(authed, kidA, "reaction");
    check("Premium usage reports unlimited", pu.is_premium && pu.remaining === null && pu.daily_limit === null);
  } catch (e) {
    fails.push("CRASH: " + e.message); console.log("CRASH", e.message);
  } finally {
    try {
      for (const id of created.children) await admin.from("child_train_your_mind_completions").delete().eq("child_id", id);
      for (const id of created.children) await admin.from("children").delete().eq("id", id);
      for (const id of created.parents) await admin.from("parents").delete().eq("id", id);
      if (devParentId && premiumBefore) await admin.from("parents").update({ premium_status: premiumBefore.s, premium_expires_at: premiumBefore.e }).eq("id", devParentId);
      console.log("cleanup: temporary children/parents removed, dev-test premium state restored");
    } catch (e) { fails.push("CLEANUP FAILED: " + e.message); }
  }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.join("\n")); process.exit(1); }
})();
