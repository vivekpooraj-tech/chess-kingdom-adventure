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
