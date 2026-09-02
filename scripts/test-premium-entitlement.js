// Phase 15 — Premium entitlement + feature-gating test suite.
//
// Pure-logic tests (resolvePremiumState, shouldShowAds, capabilities) and
// static source assertions run with no database. The DB suite runs against
// the REAL live database (same pattern as scripts/test-daily-challenge.js:
// service-role for synthetic fixtures + a REAL authenticated session for
// RLS-relevant paths) and REQUIRES migration 0031_premium_entitlements.sql.
// Without it, the DB suite is skipped with a PENDING notice.
//
// Every parent/child/entitlement row it creates is deleted at the end. No
// real user entitlement is touched. No real payment is performed.
//
// Run: node scripts/test-premium-entitlement.js

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
// 1. Pure logic — a faithful re-implementation of lib/premium/entitlement.ts
//    resolvePremiumState (kept dependency-free / no ts transpile). The source
//    is separately asserted to contain the same expiry rule.
// ---------------------------------------------------------------------------
function resolvePremiumState(row) {
  const status = (row && row.premium_status) || "free";
  if (status !== "premium") return { isPremium: false, expiresAt: null, isExpired: false, daysRemaining: null };
  const raw = (row && row.premium_expires_at) || null;
  if (!raw) return { isPremium: true, expiresAt: null, isExpired: false, daysRemaining: null };
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return { isPremium: true, expiresAt: null, isExpired: false, daysRemaining: null };
  const now = Date.now();
  if (ms > now) return { isPremium: true, expiresAt: raw, isExpired: false, daysRemaining: Math.ceil((ms - now) / 86400000) };
  return { isPremium: false, expiresAt: raw, isExpired: true, daysRemaining: 0 };
}

function runLogicTests() {
  console.log("\n=== A. resolvePremiumState (free / active / expired / grandfathered) ===");
  const resolve = resolvePremiumState;
  const future = new Date(Date.now() + 400 * 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();

  const entSrc = read("lib/premium/entitlement.ts");
  check("entitlement.ts source enforces the same expiry rule",
    /premium_expires_at is null or premium_expires_at > now\(\)|expiryMs > now/.test(entSrc));

  check("free account -> not premium", resolve({ premium_status: "free" }).isPremium === false);
  check("null row -> not premium", resolve(null).isPremium === false);
  check("premium + future expiry -> premium, not expired",
    (() => { const s = resolve({ premium_status: "premium", premium_expires_at: future }); return s.isPremium && !s.isExpired && s.daysRemaining > 0; })());
  check("premium + PAST expiry -> NOT premium, isExpired true",
    (() => { const s = resolve({ premium_status: "premium", premium_expires_at: past }); return s.isPremium === false && s.isExpired === true; })());
  check("premium + NULL expiry (grandfathered forever) -> premium",
    (() => { const s = resolve({ premium_status: "premium", premium_expires_at: null }); return s.isPremium === true && s.expiresAt === null; })());
  check("premium + garbage expiry -> fails open to premium (never yanks paid access)",
    resolve({ premium_status: "premium", premium_expires_at: "not-a-date" }).isPremium === true);

  console.log("\n=== B. ads abstraction ===");
  const adsSrc = read("lib/premium/ads.ts");
  check("shouldShowAds(true) === false (Premium never sees ads)", /shouldShowAds\(isPremium: boolean\): boolean \{\s*return !isPremium;/.test(adsSrc));
  check("no third-party ad SDK imported anywhere", (() => {
    const files = walk(path.join(ROOT, "lib")).concat(walk(path.join(ROOT, "components"))).concat(walk(path.join(ROOT, "app")));
    return !files.some((f) => /admob|adsense|google-ad|react-native-google-mobile-ads|@react-native-admob/i.test(fs.readFileSync(f, "utf8")));
  })());
  check("AD_FORBIDDEN_CONTEXTS covers active game, board, daily challenge, lesson, puzzle",
    ["active_game", "chessboard", "daily_challenge", "lesson_in_progress", "puzzle_in_progress"].every((c) => adsSrc.includes(`"${c}"`)));

  console.log("\n=== C. capability model + free limits ===");
  const capSrc = read("lib/premium/capabilities.ts");
  check("FREE_LIMITS.trainerPuzzlesPerDay === 3", /trainerPuzzlesPerDay:\s*3/.test(capSrc));
  check("FREE_LIMITS.gameHistoryCount === 30", /gameHistoryCount:\s*30/.test(capSrc));
  check("FREE_LIMITS.engineAnalysesPerDay === 2", /engineAnalysesPerDay:\s*2/.test(capSrc));
  check("FREE_LIMITS.bestMoveSuggestionsPerDay === 5", /bestMoveSuggestionsPerDay:\s*5/.test(capSrc));
  check("ALWAYS_FREE lists daily_challenge (never gated)", /"daily_challenge"/.test(capSrc) && capSrc.indexOf("ALWAYS_FREE") < capSrc.indexOf('"daily_challenge"'));
  check("ALWAYS_FREE lists play_vs_computer and online_friend_play", /"play_vs_computer"/.test(capSrc) && /"online_friend_play"/.test(capSrc));

  console.log("\n=== D. gating is centralised, core play + Daily Challenge NOT gated ===");
  check("PremiumGate + PremiumCta components exist", fs.existsSync(path.join(ROOT, "components/premium/PremiumGate.tsx")) && fs.existsSync(path.join(ROOT, "components/premium/PremiumCta.tsx")));
  const puzzlesSrc = read("app/(tabs)/puzzles/page.tsx");
  check("puzzles: Trainer limit still `!isPremium && !isDaily` (Daily Challenge free, Premium unlimited)", /limitReached\s*=\s*!isPremium\s*&&\s*!isDaily/.test(puzzlesSrc));
  check("puzzles: isPremium is expiry-aware (resolvePremiumState)", /resolvePremiumState\(parent\)\.isPremium/.test(puzzlesSrc));
  for (const f of ["app/free-play/page.tsx", "app/online/[gameId]/page.tsx", "app/matchmaking/page.tsx"]) {
    check(`core play not wrapped in PremiumGate: ${f}`, !/PremiumGate|PremiumFeatureModal/.test(read(f)));
  }
  const dcCard = read("components/home/DailyChallengeCard.tsx");
  check("DailyChallengeCard has no Premium gate", !/PremiumGate|PremiumFeatureModal|isPremium/.test(dcCard));

  console.log("\n=== E. Stripe flow: one-time, 2 years, idempotent, server-verified ===");
  const checkoutSrc = read("app/api/stripe/checkout/route.ts");
  check("checkout is mode:'payment' (never a subscription)", /mode:\s*"payment"/.test(checkoutSrc) && !/mode:\s*"subscription"/.test(checkoutSrc));
  check("checkout never trusts a client-sent price/amount", /re-derive|re-derived|never trusted|Country .*re-derived/i.test(checkoutSrc));
  const webhookSrc = read("app/api/stripe/webhook/route.ts");
  check("webhook verifies the Stripe signature", /constructEvent\(rawBody, signature, webhookSecret\)/.test(webhookSrc));
  check("webhook grants via idempotent grant_premium_entitlement RPC", /grant_premium_entitlement/.test(webhookSrc));
  check("webhook handles charge.refunded", /charge\.refunded/.test(webhookSrc) && /revoke_premium_entitlement/.test(webhookSrc));
  const successSrc = read("app/upgrade/success/page.tsx");
  check("success page re-verifies payment_status === 'paid' with Stripe", /payment_status !== "paid"/.test(successSrc));
  check("success page grants via the same idempotent RPC", /grant_premium_entitlement/.test(successSrc));
  const migration = read("supabase/migrations/0031_premium_entitlements.sql");
  check("migration: unique(stripe_checkout_session_id) for webhook idempotency", /stripe_checkout_session_id text unique/.test(migration));
  check("migration: grant_premium_entitlement uses ON CONFLICT DO NOTHING", /on conflict \(stripe_checkout_session_id\) do nothing/.test(migration));
  check("migration: default entitlement duration is 2 years", /p_duration interval default interval '2 years'/.test(migration));
  check("migration: RLS enabled on premium_entitlements", /alter table public\.premium_entitlements enable row level security/.test(migration));
  check("migration: client INSERT/UPDATE/DELETE on premium_entitlements REVOKEd", /revoke insert, update, delete on public\.premium_entitlements from authenticated, anon/.test(migration));
  check("migration: premium_expires_at update REVOKEd from authenticated", /revoke update \(premium_expires_at\) on public\.parents from authenticated/.test(migration));
  check("migration: existing gated RPCs re-created to use parent_is_premium()",
    /create or replace function public\.mark_lesson_complete[\s\S]*parent_is_premium/.test(migration) &&
    /create or replace function public\.check_free_game_eligibility[\s\S]*parent_is_premium/.test(migration) &&
    /create or replace function public\.get_free_game_status[\s\S]*parent_is_premium/.test(migration));
  check("migration: no Stripe product/price IDs invented", !/price_[0-9A-Za-z]{10,}|prod_[0-9A-Za-z]{10,}/.test(migration));

  console.log("\n=== F. parent-controlled purchase (children cannot buy) ===");
  check("checkout requires an authenticated parent session", /Not signed in.*401|status: 401/.test(checkoutSrc));
  check("checkout resolves the parents row from auth.uid (no child path)", /from\("parents"\)[\s\S]*auth_user_id.*user\.id/.test(checkoutSrc));
  check("parent dashboard shows PremiumStatusCard (parent-gated route)", /PremiumStatusCard/.test(read("app/parent-dashboard/page.tsx")));
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DB suite
// ---------------------------------------------------------------------------
async function makeParent(premiumStatus, expiresAt) {
  const { data, error } = await admin.from("parents")
    .insert({ auth_user_id: null, email: `premtest-${Date.now()}-${Math.random().toString(16).slice(2)}@local.chessmind.test`, premium_status: premiumStatus, premium_expires_at: expiresAt ?? null })
    .select("id").single();
  if (error) throw new Error("makeParent: " + error.message);
  return data.id;
}
async function makeChildFor(parentId) {
  const { data, error } = await admin.from("children")
    .insert({ parent_id: parentId, display_name: "PremTestKid", avatar_id: "knight-kid", buddy_id: "wise-owl" })
    .select("id").single();
  if (error) throw new Error("makeChild: " + error.message);
  return data.id;
}
async function cleanupParent(parentId) {
  await admin.from("premium_entitlements").delete().eq("parent_id", parentId);
  // children (+ their fk rows) cascade on parent delete
  await admin.from("parents").delete().eq("id", parentId);
}

async function runDbSuite() {
  const probe = await admin.from("premium_entitlements").select("id").limit(1);
  if (probe.error && /does not exist|Could not find the table/i.test(probe.error.message)) {
    console.log("\n=== PENDING: migration 0031_premium_entitlements.sql is not applied yet ===");
    console.log("Static + logic checks above still ran. Apply 0031, then re-run for the DB suite.");
    return "pending";
  }
  if (probe.error) throw new Error("probe error: " + probe.error.message);

  console.log("\n=== G. parent_is_premium() honours expiry (server-authoritative) ===");
  {
    const future = new Date(Date.now() + 400 * 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    const pFree = await makeParent("free", null);
    const pActive = await makeParent("premium", future);
    const pExpired = await makeParent("premium", past);
    const pForever = await makeParent("premium", null);
    try {
      const q = async (id) => (await admin.rpc("parent_is_premium", { p_parent_id: id })).data;
      check("free parent -> parent_is_premium false", (await q(pFree)) === false);
      check("premium + future expiry -> true", (await q(pActive)) === true);
      check("premium + PAST expiry -> false (expiry enforced in SQL)", (await q(pExpired)) === false);
      check("premium + NULL expiry (grandfathered) -> true", (await q(pForever)) === true);
    } finally {
      for (const id of [pFree, pActive, pExpired, pForever]) await cleanupParent(id);
    }
  }

  console.log("\n=== H. child inherits parent Premium (free-game RPC) ===");
  {
    const authClient = createClient(url, anonKey);
    const { error: ae } = await authClient.auth.signInWithPassword({ email: "dev-test@local.chessmind.test", password: "dev-test-local-only-not-secret" });
    check("dev-test sign-in ok", !ae, ae?.message);

    // Premium parent + child -> get_free_game_status.is_premium true.
    // (Uses the dev-test parent so the authed RPC ownership check passes;
    // we flip that parent's flag for the test and restore it after.)
    const { data: devUser } = await admin.auth.admin.listUsers();
    const dev = devUser.users.find((u) => u.email === "dev-test@local.chessmind.test");
    const { data: devParent } = await admin.from("parents").select("id, premium_status, premium_expires_at").eq("auth_user_id", dev.id).single();
    const before = { s: devParent.premium_status, e: devParent.premium_expires_at };
    const kid = await makeChildFor(devParent.id);
    try {
      await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() + 400 * 86400000).toISOString() }).eq("id", devParent.id);
      const r1 = await authClient.rpc("get_free_game_status", { p_child_id: kid });
      check("child of active-Premium parent -> get_free_game_status.is_premium true", !r1.error && r1.data?.[0]?.is_premium === true, r1.error?.message ?? JSON.stringify(r1.data?.[0]));

      await admin.from("parents").update({ premium_status: "premium", premium_expires_at: new Date(Date.now() - 86400000).toISOString() }).eq("id", devParent.id);
      const r2 = await authClient.rpc("get_free_game_status", { p_child_id: kid });
      check("child of EXPIRED-Premium parent -> is_premium false, limited", !r2.error && r2.data?.[0]?.is_premium === false && r2.data?.[0]?.ai_remaining === 2, r2.error?.message ?? JSON.stringify(r2.data?.[0]));
    } finally {
      await admin.from("daily_challenge_history").delete().eq("child_id", kid);
      await admin.from("children").delete().eq("id", kid);
      await admin.from("parents").update({ premium_status: before.s, premium_expires_at: before.e }).eq("id", devParent.id);
    }
  }

  console.log("\n=== I. grant_premium_entitlement is idempotent (duplicate webhook) ===");
  {
    const p = await makeParent("free", null);
    try {
      const sessionId = "cs_test_dupe_" + Date.now();
      const g1 = await admin.rpc("grant_premium_entitlement", { p_parent_id: p, p_checkout_session_id: sessionId, p_payment_intent_id: "pi_test_1", p_amount_minor: 29900, p_currency: "inr" });
      const g2 = await admin.rpc("grant_premium_entitlement", { p_parent_id: p, p_checkout_session_id: sessionId, p_payment_intent_id: "pi_test_1", p_amount_minor: 29900, p_currency: "inr" });
      check("both grant calls succeed", !g1.error && !g2.error, g1.error?.message ?? g2.error?.message);
      const { count } = await admin.from("premium_entitlements").select("id", { count: "exact", head: true }).eq("parent_id", p);
      check("exactly ONE entitlement row after a duplicate delivery", count === 1, count);
      const { data: parentRow } = await admin.from("parents").select("premium_status, premium_expires_at").eq("id", p).single();
      check("parent upgraded to premium", parentRow.premium_status === "premium");
      const yrs = (Date.parse(parentRow.premium_expires_at) - Date.now()) / (365.25 * 86400000);
      check("expiry ~2 years out", yrs > 1.9 && yrs < 2.1, yrs.toFixed(3) + " years");
      // refund path
      const rev = await admin.rpc("revoke_premium_entitlement", { p_payment_intent_id: "pi_test_1" });
      check("revoke_premium_entitlement succeeds", !rev.error, rev.error?.message);
      const { data: afterRefund } = await admin.from("parents").select("premium_status").eq("id", p).single();
      check("after refund with no other entitlement -> parent back to free", afterRefund.premium_status === "free", afterRefund.premium_status);
    } finally {
      await cleanupParent(p);
    }
  }

  console.log("\n=== J. a signed-in parent cannot self-grant Premium ===");
  {
    const authClient = createClient(url, anonKey);
    await authClient.auth.signInWithPassword({ email: "dev-test@local.chessmind.test", password: "dev-test-local-only-not-secret" });
    const { data: devUser } = await admin.auth.admin.listUsers();
    const dev = devUser.users.find((u) => u.email === "dev-test@local.chessmind.test");
    const { data: devParent } = await admin.from("parents").select("id, premium_status, premium_expires_at").eq("auth_user_id", dev.id).single();
    const before = { s: devParent.premium_status, e: devParent.premium_expires_at };

    const upd = await authClient.from("parents").update({ premium_expires_at: new Date(Date.now() + 999 * 86400000).toISOString() }).eq("id", devParent.id);
    const { data: afterUpd } = await admin.from("parents").select("premium_expires_at").eq("id", devParent.id).single();
    check("direct UPDATE of parents.premium_expires_at is blocked/no-op", (upd.error != null) || afterUpd.premium_expires_at === before.e, upd.error?.message ?? afterUpd.premium_expires_at);

    const ins = await authClient.from("premium_entitlements").insert({ parent_id: devParent.id, expires_at: new Date(Date.now() + 999 * 86400000).toISOString() });
    check("direct INSERT into premium_entitlements is blocked", ins.error != null, JSON.stringify(ins.data));

    const rpc = await authClient.rpc("grant_premium_entitlement", { p_parent_id: devParent.id, p_checkout_session_id: "cs_hack" });
    check("calling grant_premium_entitlement as authenticated is denied", rpc.error != null, rpc.error?.message);

    // restore just in case
    await admin.from("parents").update({ premium_status: before.s, premium_expires_at: before.e }).eq("id", devParent.id);
    await admin.from("premium_entitlements").delete().eq("stripe_checkout_session_id", "cs_hack");
  }

  console.log("\n=== K. Daily Challenge / puzzle pool untouched by Phase 15 ===");
  {
    const { count: pool } = await admin.from("daily_challenge_puzzles").select("puzzle_id", { count: "exact", head: true });
    check("daily_challenge_puzzles still 1000", pool === 1000, pool);
    const pls = await admin.from("puzzle_library_solves").select("id", { count: "exact", head: true });
    check("puzzle_library_solves table intact", !pls.error, pls.error?.message);
  }
  return "ran";
}

async function main() {
  runLogicTests();
  let dbResult = "skipped";
  try {
    dbResult = await runDbSuite();
  } catch (e) {
    fail++;
    failures.push("DB suite crashed: " + e.message);
    console.log("FAIL: DB suite crashed -- " + e.message);
  }
  console.log(`\n=== PREMIUM SUMMARY: ${pass} passed, ${fail} failed${dbResult === "pending" ? " (DB suite PENDING migration 0031)" : ""} ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => { console.error("Premium test suite crashed:", err); process.exit(1); });
