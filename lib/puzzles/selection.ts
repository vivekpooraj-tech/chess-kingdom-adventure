import { PUZZLES } from "@/content/puzzles";
import type { ChessPuzzle } from "@/lib/types";

/**
 * Fresh-puzzle selection for the bare /puzzles ("free practice") view.
 *
 * The Puzzles tab used to open `PUZZLES[0]` every single time — so signing
 * in and tapping Puzzles always dumped you back on the same position, and
 * "Next" walked the array in fixed order. This picks a genuinely random
 * puzzle from the pool while skipping the handful shown most recently on
 * this device, so a session feels varied and a puzzle never repeats
 * back-to-back.
 *
 * Scope: this is ONLY for free practice. The Daily Challenge opens a
 * specific puzzle via `?id=` and is untouched by any of this.
 *
 * Persistence: a short list of recent puzzle ids in localStorage. Ids
 * only, capped well below the pool size, per-device, non-sensitive. If
 * storage is unavailable the de-dupe just gets weaker, never breaks.
 */

const RECENT_KEY = "cm.puzzles.recent";

// Never let the recent list grow large enough to exclude the whole pool —
// keep a comfortable margin of eligible puzzles at all times.
const RECENT_MAX = Math.max(1, Math.min(8, PUZZLES.length - 4));

function readRecent(): string[] {
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

/** Record that a puzzle was just shown so it isn't picked again for a while. */
export function rememberPuzzleShown(id: string): void {
  writeRecent([...readRecent().filter((x) => x !== id), id]);
}

/**
 * A random puzzle from the pool, avoiding the recently-shown ones, anything
 * in `exclude` (e.g. the current puzzle), and — when the caller supplies it
 * — puzzles the child has already solved (`solved`, from
 * puzzle_library_solves; see lib/supabase/queries.ts getSolvedPuzzleIds).
 *
 * Degrades gracefully, widening the pool one filter at a time rather than
 * ever returning nothing: unsolved-and-fresh -> unsolved -> fresh ->
 * not-excluded -> the whole library. With an empty `solved` set this is
 * exactly the previous recent-then-exclude behavior.
 */
export function pickRandomPuzzle(
  exclude: readonly string[] = [],
  solved: ReadonlySet<string> = new Set()
): ChessPuzzle {
  const recent = new Set(readRecent());
  const excludeSet = new Set(exclude);
  const allowed = PUZZLES.filter((p) => !excludeSet.has(p.id));

  const unsolvedFresh = allowed.filter((p) => !recent.has(p.id) && !solved.has(p.id));
  const unsolved = allowed.filter((p) => !solved.has(p.id));
  const fresh = allowed.filter((p) => !recent.has(p.id));
  const pool =
    unsolvedFresh.length > 0
      ? unsolvedFresh
      : unsolved.length > 0
        ? unsolved
        : fresh.length > 0
          ? fresh
          : allowed.length > 0
            ? allowed
            : PUZZLES;

  return pool[Math.floor(Math.random() * pool.length)];
}
