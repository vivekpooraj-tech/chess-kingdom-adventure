// Grant full Premium access to a dedicated QA account using the existing
// service-role-only grant_premium_entitlement() RPC (migration 0031).
//
// This is NOT a global bypass — it writes a real premium_entitlements row and
// updates parents.premium_status the same way Stripe checkout does, except
// p_provider is "manual" and no payment is involved.
//
// Premium includes Chess School (lib/school/v2/access.ts) and every other
// Premium-gated feature (puzzles, Train Your Mind, Game Review, themes, etc.).
//
// Run:  node scripts/grant-qa-premium-access.js
//       node scripts/grant-qa-premium-access.js --verify-only
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// The account must already exist (signed up at least once) so auth.users and
// parents rows are present.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

/** Hard-coded QA allowlist — only these emails may receive a manual grant. */
const QA_ACCOUNTS = [
  {
    email: "rajyam141502@gmail.com",
    /** Stable idempotency key — re-runs are a no-op once granted. */
    checkoutSessionId: "qa_manual_rajyam141502_gmail_com",
  },
];

/** Long-lived QA entitlement — does not change global PREMIUM_ENTITLEMENT_YEARS. */
const QA_DURATION = "10 years";

const VERIFY_ONLY = process.argv.includes("--verify-only");

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolvePremiumState(row) {
  const status = (row && row.premium_status) || "free";
  if (status !== "premium") {
    return { isPremium: false, expiresAt: null, isExpired: false, daysRemaining: null };
  }
  const raw = (row && row.premium_expires_at) || null;
  if (!raw) {
    return { isPremium: true, expiresAt: null, isExpired: false, daysRemaining: null };
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return { isPremium: true, expiresAt: null, isExpired: false, daysRemaining: null };
  }
  const now = Date.now();
  if (ms > now) {
    return {
      isPremium: true,
      expiresAt: raw,
      isExpired: false,
      daysRemaining: Math.ceil((ms - now) / 86_400_000),
    };
  }
  return { isPremium: false, expiresAt: raw, isExpired: true, daysRemaining: 0 };
}

function resolveSchoolAccess(parentRow) {
  if (resolvePremiumState(parentRow).isPremium) {
    return { hasFullAccess: true, source: "premium" };
  }
  return { hasFullAccess: false, source: "free" };
}

async function findParentByEmail(admin, email) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const user = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (!user) return null;

  const { data: parent, error: parentError } = await admin
    .from("parents")
    .select("id, email, premium_status, premium_expires_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (parentError) throw parentError;
  if (!parent) return { user, parent: null };
  return { user, parent };
}

async function verifyAccount(admin, label, email, expectPremium) {
  const found = await findParentByEmail(admin, email);
  if (!found || !found.parent) {
    console.log(`  FAIL  ${label}: no parent row for ${email}`);
    return false;
  }

  const { data: rpcPremium } = await admin.rpc("parent_is_premium", { p_parent_id: found.parent.id });
  const state = resolvePremiumState(found.parent);
  const school = resolveSchoolAccess(found.parent);

  const ok =
    rpcPremium === expectPremium &&
    state.isPremium === expectPremium &&
    (expectPremium ? school.hasFullAccess && school.source === "premium" : !school.hasFullAccess);

  console.log(
    `  ${ok ? "ok" : "FAIL"}  ${label}: isPremium=${state.isPremium} (rpc=${rpcPremium}), school=${school.source}`
  );
  return ok;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let allOk = true;

  if (!VERIFY_ONLY) {
    console.log("\n=== Granting QA Premium via grant_premium_entitlement (manual) ===\n");
    for (const qa of QA_ACCOUNTS) {
      const found = await findParentByEmail(admin, qa.email);
      if (!found) {
        console.error(
          `No auth user for ${qa.email} — sign up once in the app, then re-run this script.`
        );
        allOk = false;
        continue;
      }
      if (!found.parent) {
        console.error(`Auth user exists for ${qa.email} but no parents row — check on_auth_user_created trigger.`);
        allOk = false;
        continue;
      }

      const before = resolvePremiumState(found.parent);
      if (before.isPremium) {
        console.log(`${qa.email} already Premium (expires ${before.expiresAt ?? "never"}) — skipping grant.`);
        continue;
      }

      const { data: expiresAt, error } = await admin.rpc("grant_premium_entitlement", {
        p_parent_id: found.parent.id,
        p_checkout_session_id: qa.checkoutSessionId,
        p_payment_intent_id: `qa_pi_${qa.checkoutSessionId}`,
        p_amount_minor: 0,
        p_currency: "inr",
        p_provider: "manual",
        p_duration: QA_DURATION,
      });

      if (error) {
        console.error(`grant_premium_entitlement failed for ${qa.email}:`, error.message);
        allOk = false;
        continue;
      }

      console.log(`Granted Premium to ${qa.email} (parent ${found.parent.id}, expires ~${expiresAt}).`);
    }
  }

  console.log("\n=== Verification ===\n");

  for (const qa of QA_ACCOUNTS) {
    const ok = await verifyAccount(admin, `QA ${qa.email}`, qa.email, true);
    if (!ok) allOk = false;
  }

  const freeOk = await verifyAccount(
    admin,
    "Control free account (dev-test)",
    "dev-test@local.chessmind.test",
    false
  );
  if (!freeOk) allOk = false;

  console.log(
    allOk
      ? "\nAll checks passed. Stripe/webhook/auth code unchanged — entitlement is DB-only."
      : "\nSome checks failed — see output above."
  );

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("grant-qa-premium-access failed:", err);
  process.exit(1);
});
