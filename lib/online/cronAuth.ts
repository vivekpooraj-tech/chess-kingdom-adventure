/**
 * Authorization for the internal cron endpoints.
 *
 * Pure and dependency-free so it can be unit tested without Next.js, a server,
 * or a database — the authorization decision on a settlement endpoint is
 * exactly the thing that should not be exercised only by hand.
 */

/**
 * Constant-time string comparison.
 *
 * A plain `===` short-circuits on the first differing byte, which leaks the
 * secret's length and a prefix oracle to anyone who can time the endpoint.
 * Cheap insurance for something reachable from the open internet.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: "unauthorized" | "cron_not_configured" };

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * `secret` must come from a server-only env var (never NEXT_PUBLIC_), so it
 * cannot reach a client bundle.
 *
 * When the secret is unset, every request is refused rather than allowed
 * through. An unconfigured settlement endpoint that runs is far worse than one
 * that does nothing, and "fail open on missing config" is how these endpoints
 * usually end up public.
 */
export function authorizeCron(
  authorizationHeader: string | null,
  secret: string | undefined
): CronAuthResult {
  if (!secret) return { ok: false, status: 503, error: "cron_not_configured" };
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return safeEqual(authorizationHeader.slice("Bearer ".length), secret)
    ? { ok: true }
    : { ok: false, status: 401, error: "unauthorized" };
}
