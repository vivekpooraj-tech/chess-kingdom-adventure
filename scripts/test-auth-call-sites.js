/**
 * V1 P1 fix #2 — auth call-site hardening.
 *
 * The project has a documented pattern (lib/supabase/server.ts's
 * getSessionUser(), lib/supabase/client.ts's getAuthState()/getVerifiedUser())
 * for distinguishing "genuinely signed out" from "transient Supabase/network
 * failure". An overnight audit found 5 call sites that bypassed it with a
 * raw supabase.auth.getUser()/getSession() call instead. This is a pure
 * static-source check (same pattern as scripts/test-phase4-entitlement-
 * gating.js's "Wiring" assertions) confirming each of those 5 sites now uses
 * the wrapper, and that nothing else in the fix accidentally changed.
 *
 *   node scripts/test-auth-call-sites.js
 */
const fs = require("fs");
const path = require("path");

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

// --- A. The 5 confirmed call sites no longer call supabase.auth.getUser() /
// getSession() raw for their primary auth check ----------------------------
{
  const checkout = read("app/api/stripe/checkout/route.ts");
  check("checkout: imports getSessionUser from lib/supabase/server", /import \{ createClient, getSessionUser \} from "@\/lib\/supabase\/server"/.test(checkout));
  check("checkout: uses getSessionUser(supabase) for auth", /const user = await getSessionUser\(supabase\);/.test(checkout));
  check("checkout: no raw destructured supabase.auth.getUser() call remains", !/data: \{ user \},?\s*\} = await supabase\.auth\.getUser\(\)/.test(checkout));
  check("checkout: still 401s an unauthenticated request", /if \(!user\) \{\s*return NextResponse\.json\(\{ error: "Not signed in" \}, \{ status: 401 \}\);/.test(checkout));

  const checkoutSchool = read("app/api/stripe/checkout-school/route.ts");
  check("checkout-school: imports getSessionUser", /getSessionUser \} from "@\/lib\/supabase\/server"/.test(checkoutSchool));
  check("checkout-school: uses getSessionUser(supabase) for auth", /const user = await getSessionUser\(supabase\);/.test(checkoutSchool));
  check("checkout-school: no raw destructured supabase.auth.getUser() call remains", !/data: \{ user \},?\s*\} = await supabase\.auth\.getUser\(\)/.test(checkoutSchool));
  check("checkout-school: still 401s an unauthenticated request", /if \(!user\) \{\s*return NextResponse\.json\(\{ error: "Not signed in" \}, \{ status: 401 \}\);/.test(checkoutSchool));
  check("checkout-school: still never emits a real parent_id metadata key (Premium/School isolation untouched)", !/(?<!school_)\bparent_id:\s*parent\.id/.test(checkoutSchool));

  const explain = read("app/api/game-analysis/explain/route.ts");
  check("game-analysis/explain: imports getSessionUser", /getSessionUser \} from "@\/lib\/supabase\/server"/.test(explain));
  check("game-analysis/explain: uses getSessionUser(supabase) for auth", /const user = await getSessionUser\(supabase\);/.test(explain));
  check("game-analysis/explain: no raw destructured supabase.auth.getUser() call remains", !/data: \{ user \},?\s*\} = await supabase\.auth\.getUser\(\)/.test(explain));
  check("game-analysis/explain: Premium gate (resolvePremiumState) untouched", /resolvePremiumState\(parent\)\.isPremium/.test(explain));

  const validatePromo = read("app/api/stripe/validate-promo/route.ts");
  check("validate-promo: imports getSessionUser", /getSessionUser \} from "@\/lib\/supabase\/server"/.test(validatePromo));
  check("validate-promo: uses getSessionUser(supabase) for auth", /const user = await getSessionUser\(supabase\);/.test(validatePromo));
  check("validate-promo: no raw destructured supabase.auth.getUser() call remains", !/data: \{ user \},?\s*\} = await supabase\.auth\.getUser\(\)/.test(validatePromo));

  const resetPassword = read("app/reset-password/page.tsx");
  check("reset-password: imports getAuthState from lib/supabase/client", /import \{ createClient, getAuthState \} from "@\/lib\/supabase\/client"/.test(resetPassword));
  check("reset-password: uses getAuthState(supabase) instead of a raw getSession() check", /const state = await getAuthState\(supabase\);/.test(resetPassword));
  check("reset-password: no raw supabase.auth.getSession() destructure feeding stage decision", !/const \{ data \} = await supabase\.auth\.getSession\(\);/.test(resetPassword));
  check("reset-password: a network error does not silently look identical to an expired link", /networkError/.test(resetPassword));
  check("reset-password: authed session still reaches the form stage", /state\.status === "authed"[\s\S]{0,40}setStage\("form"\)/.test(resetPassword));
}

// --- B. Protected surfaces: nothing else in these files changed shape -----
{
  const checkout = read("app/api/stripe/checkout/route.ts");
  check("checkout: still mode 'payment' (never a subscription)", /mode:\s*"payment"/.test(checkout) && !/mode:\s*"subscription"/.test(checkout));
  const webhook = read("app/api/stripe/webhook/route.ts");
  check("webhook untouched by this fix (still grant_premium_entitlement)", /grant_premium_entitlement/.test(webhook));
}

console.log(`\n=== AUTH CALL-SITE HARDENING: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(" -", f);
  process.exitCode = 1;
}
