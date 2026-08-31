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
 * A random puzzle from the pool, avoiding the recently-shown ones and
 * anything in `exclude` (e.g. the current puzzle). Degrades gracefully:
 * if the filters would leave nothing, it drops the recent filter, then
 * the exclude filter, rather than returning nothing.
 */
export function pickRandomPuzzle(exclude: readonly string[] = []): ChessPuzzle {
  const recent = new Set(readRecent());
  const excludeSet = new Set(exclude);

  const withoutRecent = PUZZLES.filter((p) => !recent.has(p.id) && !excludeSet.has(p.id));
  const withoutExclude = PUZZLES.filter((p) => !excludeSet.has(p.id));
  const pool =
    withoutRecent.length > 0 ? withoutRecent : withoutExclude.length > 0 ? withoutExclude : PUZZLES;

  return pool[Math.floor(Math.random() * pool.length)];
}
