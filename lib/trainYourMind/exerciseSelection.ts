import { RECENT_MAX_AGE_MS, RECENT_WINDOW_COUNT } from "./historyConfig";

/**
 * Pure exercise selector for Train Your Chess Mind. No I/O, no React — takes
 * the candidate pool and the child's persisted history and picks one.
 *
 * Algorithm:
 *   1. "Recent" = the child's newest RECENT_WINDOW_COUNT history entries that
 *      are also younger than RECENT_MAX_AGE_MS.
 *   2. Prefer a uniformly random candidate that is NOT recent (and is not an
 *      id in `avoidIds`, e.g. the exercise currently on screen).
 *   3. If every candidate is recent (small pool), do NOT fail and do NOT
 *      invent content: pick the least-recently-seen candidate (never-seen
 *      counts as oldest), random among ties, still avoiding `avoidIds` when
 *      another choice exists.
 */

export interface HistoryEntry {
  exerciseId: string;
  /** Epoch ms of the last time this child was shown the exercise. */
  lastSeenAt: number;
}

export interface SelectOptions {
  now?: number;
  windowCount?: number;
  maxAgeMs?: number;
  /** Ids to avoid when any alternative exists (e.g. the current exercise). */
  avoidIds?: readonly string[];
  rng?: () => number;
}

export interface Selection<T> {
  item: T;
  /** "unseen" = outside the recent window; "least-recent" = pool exhausted. */
  reason: "unseen" | "least-recent";
}

export function recentIdSet(history: readonly HistoryEntry[], opts: SelectOptions = {}): Set<string> {
  const now = opts.now ?? Date.now();
  const windowCount = opts.windowCount ?? RECENT_WINDOW_COUNT;
  const maxAge = opts.maxAgeMs ?? RECENT_MAX_AGE_MS;
  return new Set(
    [...history]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, windowCount)
      .filter((h) => now - h.lastSeenAt <= maxAge)
      .map((h) => h.exerciseId)
  );
}

export function selectExercise<T>(
  candidates: readonly T[],
  getId: (item: T) => string,
  history: readonly HistoryEntry[],
  opts: SelectOptions = {}
): Selection<T> | null {
  if (candidates.length === 0) return null;
  const rng = opts.rng ?? Math.random;
  const pickOne = (arr: readonly T[]): T => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

  const recent = recentIdSet(history, opts);
  const avoid = new Set(opts.avoidIds ?? []);

  const unseen = candidates.filter((c) => !recent.has(getId(c)) && !avoid.has(getId(c)));
  if (unseen.length > 0) return { item: pickOne(unseen), reason: "unseen" };

  // Pool exhausted: least-recently-seen wins.
  const lastSeen = new Map<string, number>();
  for (const h of history) lastSeen.set(h.exerciseId, Math.max(lastSeen.get(h.exerciseId) ?? 0, h.lastSeenAt));
  const age = (c: T) => lastSeen.get(getId(c)) ?? 0; // never seen / forgotten = oldest

  const pool = candidates.filter((c) => !avoid.has(getId(c)));
  const usable = pool.length > 0 ? pool : candidates;
  const oldest = Math.min(...usable.map(age));
  return { item: pickOne(usable.filter((c) => age(c) === oldest)), reason: "least-recent" };
}

/**
 * Generator-based drills: draw `count` random rounds, de-duplicate by id, then
 * select. `generate` may return null (a generator that cannot build a question
 * for a given position); nulls are skipped.
 */
export function selectGenerated<T>(
  generate: () => T | null | undefined,
  getId: (item: T) => string,
  history: readonly HistoryEntry[],
  count: number,
  opts: SelectOptions = {}
): Selection<T> | null {
  const byId = new Map<string, T>();
  for (let i = 0; i < count; i++) {
    const item = generate();
    if (item) byId.set(getId(item), item);
  }
  return selectExercise([...byId.values()], getId, history, opts);
}
