/**
 * Per-device "recently shown" puzzle ids.
 *
 * Split out of lib/puzzles/selection.ts so the browser can track recency
 * WITHOUT importing content/puzzles.ts. That import was the reason the whole
 * 1,000-puzzle pool (~192KB of source) ended up in /puzzles' First Load JS:
 * the page only needed a handful of ids, but pulled the entire library along
 * with the picking logic.
 *
 * Recency stays client-side on purpose. It is a per-device nicety — "don't
 * show me the same position I just closed" — not something worth a database
 * round-trip or a row per view. Solved-puzzle exclusion, which genuinely is
 * per-child and durable, remains server-side from puzzle_library_solves.
 *
 * Ids only, capped, non-sensitive. If storage is unavailable the de-dupe just
 * gets weaker; it never breaks.
 */

const RECENT_KEY = "cm.puzzles.recent";

/**
 * Kept small deliberately. The server widens its own selection when
 * everything is excluded, so this list only needs to prevent back-to-back
 * repeats — it must never be big enough to fight the selector.
 */
const RECENT_MAX = 8;

export function readRecentPuzzleIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(-RECENT_MAX)));
  } catch {
    // private mode / storage disabled — non-fatal
  }
}

/** Record that a puzzle was just shown so it isn't picked again immediately. */
export function rememberPuzzleShown(id: string): void {
  writeRecent([...readRecentPuzzleIds().filter((x) => x !== id), id]);
}
