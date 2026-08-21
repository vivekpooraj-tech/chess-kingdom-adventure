import type { ActiveChildResolution } from "./queries";

// Shared short-lived cache for resolveActiveChild()'s result -- measured
// (Phase 4 performance audit) costing 175-610ms per call, and every one of
// kingdom-map, more, puzzles, and DailyChallengeCard was independently
// re-running it from scratch on every single navigation, including
// navigations seconds apart for the exact same child. This module works
// identically (and safely) in both runtimes that call it: on the server
// it's one Map per warm Node.js process; in the browser it's one Map per
// tab. Neither can ever see the other's entries, and each entry is keyed
// by the real authenticated user id (never client-suppliable) plus the
// active-child-cookie value at resolution time -- so a different signed-in
// user, or a switched child, can never read a stale/foreign result: they
// simply miss the cache and resolve fresh, exactly as if no cache existed.
//
// Best-effort by design: a server-side cache entry only helps when the
// same warm instance handles both requests (common on Vercel for
// back-to-back navigations, not guaranteed). That's fine -- worst case is
// the same cost as before this change, never worse and never incorrect.
const CACHE_TTL_MS = 20_000;

interface CacheEntry {
  resolution: ActiveChildResolution;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(userId: string, cookieChildId: string | null): string {
  return `${userId}:${cookieChildId ?? ""}`;
}

export function getCachedActiveChild(
  userId: string,
  cookieChildId: string | null
): ActiveChildResolution | null {
  const entry = cache.get(cacheKey(userId, cookieChildId));
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.resolution;
}

export function setCachedActiveChild(
  userId: string,
  cookieChildId: string | null,
  resolution: ActiveChildResolution
): void {
  cache.set(cacheKey(userId, cookieChildId), { resolution, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Called right after the active-child cookie changes so a just-switched child is never served a stale cached resolution. */
export function invalidateActiveChildCache(userId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
}

/**
 * Client-side-only equivalent of invalidateActiveChildCache() for callers
 * that don't have the auth user id on hand (setActiveChildIdClient() is a
 * plain cookie utility used from 8+ places and shouldn't need one just for
 * this). The composite cache key (user id + cookie value) already means a
 * switched child can never read a stale result even without this -- it's
 * belt-and-suspenders for immediacy, not a correctness requirement, and
 * clearing the whole (small, per-tab) cache on the rare "switch child"
 * action costs nothing.
 */
export function clearAllActiveChildCache(): void {
  cache.clear();
}
