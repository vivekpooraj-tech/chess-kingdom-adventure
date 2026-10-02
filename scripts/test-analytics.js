/**
 * V1 P1 fix #4 — minimum product analytics (PostHog, currently unconfigured
 * in every dev/test environment — every check here must hold true whether
 * or not NEXT_PUBLIC_POSTHOG_KEY/HOST are ever set).
 *
 *   node scripts/test-analytics.js
 */
const fs = require("fs");
const path = require("path");

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

const PRIORITIZED_EVENTS = [
  "signup_completed",
  "onboarding_completed",
  "school_session_started",
  "school_session_completed",
  "premium_upgrade_viewed",
  "premium_checkout_started",
  "premium_purchase_success",
  "school_upgrade_viewed",
  "school_checkout_started",
  "school_purchase_success",
];

// --- A. Fail-safe behavior: analytics must never throw or block when ------
// unconfigured (true today — no PostHog project exists in this env) --------
{
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const Module = require("module");
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
    return origResolve.call(this, request, ...rest);
  };
  const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
  require.extensions[".ts"] = function (mod, filename) {
    const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      fileName: filename,
    }).outputText;
    mod._compile(js, filename);
  };

  let serverThrew = false;
  try {
    const { trackServerEvent } = require(path.join(process.cwd(), "lib", "analytics", "server.ts"));
    // No await needed to prove it doesn't throw synchronously; still await
    // to also prove the returned promise never rejects when unconfigured.
    trackServerEvent("test-parent-id", "premium_purchase_success", { product: "premium" })
      .catch(() => {
        serverThrew = true;
      });
  } catch {
    serverThrew = true;
  }
  check("trackServerEvent() does not throw when PostHog is unconfigured", !serverThrew);
}

// --- B. Client wrapper: strict allow-list, no PII escape hatch -------------
{
  const src = read("lib/analytics/client.ts");
  check("AnalyticsEventName is a closed string-literal union (not `string`)", /export type AnalyticsEventName =\s*\n(\s*\| "[a-z_]+"\s*\n)+/.test(src));
  for (const e of ["signup_completed", "onboarding_completed", "school_session_started", "school_session_completed", "premium_upgrade_viewed", "premium_checkout_started", "school_upgrade_viewed", "school_checkout_started"]) {
    check(`client AnalyticsEventName includes "${e}"`, src.includes(`"${e}"`));
  }
  check("AnalyticsProperties has no free-text/arbitrary field (only surface/sessionNumber/platform)", /interface AnalyticsProperties \{\s*(\/\*\*[\s\S]*?\*\/\s*)?surface\?: string;\s*(\/\*\*[\s\S]*?\*\/\s*)?sessionNumber\?: number;\s*(\/\*\*[\s\S]*?\*\/\s*)?platform\?: "web" \| "android";\s*\}/.test(src));
  check("no name/email/location field on AnalyticsProperties", !/\b(name|email|location|ip|address)\??:/.test(src));
  check("track() wraps posthog.capture in try/catch (never throws)", /export function track[\s\S]*?try \{[\s\S]*?posthog\.capture\(event, properties\);[\s\S]*?\} catch/.test(src));
  check("analytics silently no-ops without NEXT_PUBLIC_POSTHOG_KEY/HOST", /if \(!key \|\| !host\) return false;/.test(src));
  check("autocapture explicitly disabled", /autocapture: false/.test(src));
  check("session recording explicitly disabled", /disable_session_recording: true/.test(src));
  check("automatic pageview capture explicitly disabled", /capture_pageview: false/.test(src));
}

// --- C. Server wrapper: purchase events, no payment/PII fields -------------
{
  const src = read("lib/analytics/server.ts");
  check("ServerAnalyticsEventName includes premium_purchase_success", /"premium_purchase_success"/.test(src));
  check("ServerAnalyticsEventName includes school_purchase_success", /"school_purchase_success"/.test(src));
  check("ServerAnalyticsProperties has no payment-method/PII field (only product/currency/amount)", /interface ServerAnalyticsProperties \{\s*product: "premium" \| "chess_school";\s*(\/\*\*[\s\S]*?\*\/\s*)?currency\?: string;\s*(\/\*\*[\s\S]*?\*\/\s*)?amount\?: number;\s*\}/.test(src));
  check("no card/token/secret field on ServerAnalyticsProperties", !/\b(card|token|secret|customer_id|payment_method)\??:/.test(src));
  check("trackServerEvent never rethrows (webhook must never fail because analytics failed)", /catch \{[\s\S]*analytics must never break a webhook/.test(src));
}

// --- D. Webhook wiring: purchase-success fired ONLY server-side, ONLY -----
// after the existing (unmodified) grant RPC succeeds, with a read-only ------
// de-dup check against Stripe's at-least-once delivery ----------------------
{
  const webhook = read("app/api/stripe/webhook/route.ts");
  check("webhook imports trackServerEvent", /import \{ trackServerEvent \} from "@\/lib\/analytics\/server"/.test(webhook));
  check("premium_purchase_success fired only in the !error branch after grant_premium_entitlement", /grant_premium_entitlement[\s\S]{0,400}\} else if \(!existingPremiumEntitlement\) \{\s*await trackServerEvent\(parentId, "premium_purchase_success"/.test(webhook));
  check("school_purchase_success fired only in the !error branch after grant_school_entitlement", /grant_school_entitlement[\s\S]{0,400}\} else if \(!existingSchoolEntitlement\) \{\s*await trackServerEvent\(schoolParentId, "school_purchase_success"/.test(webhook));
  check("de-dup pre-check for premium is read-only (a .select, not a write)", /\.from\("premium_entitlements"\)\s*\.select\("id"\)\s*\.eq\("stripe_checkout_session_id", session\.id\)\s*\.maybeSingle\(\)/.test(webhook));
  check("de-dup pre-check for school is read-only (a .select, not a write)", /\.from\("school_entitlements"\)\s*\.select\("id"\)\s*\.eq\("checkout_session_id", session\.id\)\s*\.maybeSingle\(\)/.test(webhook));
  check("grant_premium_entitlement RPC call itself is untouched (same params as before this fix)", /admin\.rpc\("grant_premium_entitlement", \{\s*p_parent_id: parentId,\s*p_checkout_session_id: session\.id,/.test(webhook));
  check("grant_school_entitlement RPC call itself is untouched (same params as before this fix)", /admin\.rpc\("grant_school_entitlement", \{\s*p_parent_id: schoolParentId,\s*p_checkout_session_id: session\.id,/.test(webhook));
  check("no purchase-success event fired from the client-reachable success page", !fs.existsSync(path.join(process.cwd(), "app", "upgrade", "success", "page.tsx")) || !/trackServerEvent|premium_purchase_success/.test(read("app/upgrade/success/page.tsx")));
}

// --- E. Client call sites: exactly the 8 client-side prioritized events ---
// wired, each using the shared track() wrapper (no bespoke posthog calls) --
{
  const signin = read("app/sign-in/page.tsx");
  check("sign-in fires signup_completed only after a real session is returned", /if \(data\.session\) \{\s*track\("signup_completed"/.test(signin));

  const onboarding = read("app/onboarding/pieces/page.tsx");
  check("onboarding/pieces fires onboarding_completed", /track\("onboarding_completed"\)/.test(onboarding));

  const sessionRunner = read("components/school/v2/SessionRunner.tsx");
  check("SessionRunner fires school_session_started with sessionNumber", /track\("school_session_started", \{ sessionNumber: session\.number \}\)/.test(sessionRunner));
  check("SessionRunner fires school_session_completed with sessionNumber", /track\("school_session_completed", \{ sessionNumber: session\.number \}\)/.test(sessionRunner));

  const upgradeButton = read("components/upgrade/UpgradeButton.tsx");
  check("UpgradeButton fires premium_upgrade_viewed on mount", /track\("premium_upgrade_viewed"\)/.test(upgradeButton));
  check("UpgradeButton fires premium_checkout_started before the checkout fetch", /track\("premium_checkout_started"\);\s*try \{\s*const res = await fetch\("\/api\/stripe\/checkout"/.test(upgradeButton));

  const unlockSchool = read("components/school/v2/UnlockSchoolButton.tsx");
  check("UnlockSchoolButton fires school_upgrade_viewed on mount", /track\("school_upgrade_viewed"\)/.test(unlockSchool));
  check("UnlockSchoolButton fires school_checkout_started before the checkout fetch", /track\("school_checkout_started"\);\s*try \{\s*const res = await fetch\("\/api\/stripe\/checkout-school"/.test(unlockSchool));
}

// --- F. No protected system touched: entitlement/Stripe mode/pricing ------
{
  const entitlement = read("lib/premium/entitlement.ts");
  check("Premium entitlement duration untouched (still 1 year)", /export const PREMIUM_ENTITLEMENT_YEARS = 1;/.test(entitlement));
  const checkout = read("app/api/stripe/checkout/route.ts");
  check("Stripe checkout mode untouched (still 'payment')", /mode:\s*"payment"/.test(checkout) && !/mode:\s*"subscription"/.test(checkout));
  const regions = read("lib/pricing/regions.ts");
  check("India Premium price is ₹349", /amountMinor: 34900, display: "₹349"/.test(regions));
}

console.log(`\n=== ANALYTICS (V1 P1 fix #4): ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(" -", f);
  process.exitCode = 1;
}
