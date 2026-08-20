/**
 * Best-effort, in-memory rate limit -- deliberately simple, not a hard
 * security boundary. On Vercel's serverless runtime each function instance
 * can be cold-started per request (or shared across a burst of requests on
 * the same warm instance), so this map isn't guaranteed to see every
 * request from a given user; it catches the common case (one warm
 * instance handling a burst) without needing a new database table or an
 * external store for a low-traffic, already-authenticated child chat
 * feature. Combined with the request-size caps in validate.ts, this is
 * proportionate defense-in-depth, not the primary abuse control.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const requestTimestamps = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestTimestamps.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestTimestamps.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}
