/**
 * The one local test-mode switch for the app (Phase 20) — supersedes the
 * earlier, narrower NEXT_PUBLIC_DEV_BYPASS_PARENT_GATE (which only covered
 * the Parent Gate). Every dev-only affordance — the Parent Gate skip, the
 * "DEV TEST MODE" indicator, the quick-nav menu, the premium UI preview —
 * reads this single computed value instead of re-deriving its own copy of
 * the check, so there's exactly one place this can get wrong.
 *
 * `NODE_ENV` is inlined by Next.js at build time and is hard-set to
 * "production" for `next build`/`next start` — the `&&` below always
 * short-circuits to `false` there, and the whole branch (including
 * anything that only renders when this is true) is dead-code-eliminated
 * from the production bundle, regardless of what
 * NEXT_PUBLIC_LOCAL_TEST_MODE is set to. Confirmed against the actual
 * built output (.next/static, .next/server), not just reasoned about —
 * see the phase report.
 */
export const LOCAL_TEST_MODE =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_LOCAL_TEST_MODE === "true";

/**
 * Identity of the dedicated dev-only test account (Phase 22) — a real
 * Supabase auth user, created once locally by scripts/dev-seed-test-user.js
 * using the service_role key, never a fabricated/in-memory session. Every
 * existing page's own `supabase.auth.getUser()` call (there are ~40 of
 * them, none modified) sees this as an entirely normal signed-in parent —
 * that's the point: it needs zero special-casing anywhere except the one
 * auto-sign-in route below.
 *
 * The password has no real security value — this account can only ever be
 * signed into automatically from app/api/dev/auto-signin/route.ts, which
 * itself refuses to run unless LOCAL_TEST_MODE is true (hard-false in any
 * production build). Keep this in sync with the same two literals in
 * scripts/dev-seed-test-user.js — duplicated there rather than imported
 * because that script runs via plain `node`, outside Next's TS pipeline.
 */
export const DEV_TEST_USER_EMAIL = "dev-test@local.chessmind.test";
export const DEV_TEST_USER_PASSWORD = "dev-test-local-only-not-secret";
