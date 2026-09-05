import { PUZZLES, getPuzzleById } from "@/content/puzzles";
import type { ChessPuzzle } from "@/lib/types";

/**
 * Server-only access to the mate pool (content/puzzles.ts).
 *
 * SERVER ONLY. Never import this from a client component.
 *
 * The pool is a ~192KB TypeScript module. It used to be imported directly by
 * the /puzzles client component, which put all 1,000 puzzles into the browser's
 * First Load JS purely so the page could look one of them up. Keeping the
 * import behind this server module lets the bundler drop it from client
 * chunks entirely, while the pool itself and its verification story
 * (scripts/verify-puzzles.js) stay exactly as they were.
 *
 * The selection rules below are the same ones lib/puzzles/selection.ts applied
 * on the client, moved server-side so the pool no longer has to travel with
 * them. Behaviour is deliberately unchanged: widen one filter at a time rather
 * than ever returning nothing.
 */

export function getMatePuzzleById(id: string): ChessPuzzle | null {
  return getPuzzleById(id) ?? null;
}

export interface MateSelectParams {
  /** Ids the child has already solved (puzzle_library_solves). */
  solved?: ReadonlySet<string>;
  /** Recently shown on this device, plus the current puzzle. */
  exclude?: ReadonlySet<string>;
}

/**
 * A random mate puzzle, preferring ones the child has neither solved nor seen
 * recently.
 *
 * Degrades in the same order the client version did:
 *   unsolved-and-fresh -> unsolved -> fresh -> not-excluded -> anything.
 *
 * The final fallback allows a genuine repeat. That is the right outcome for a
 * child who has solved the whole pool: repeating a puzzle is far better than
 * an empty screen, and it keeps selection from becoming fragile exactly when a
 * child has been most active.
 */
export function selectMatePuzzle(params: MateSelectParams = {}): ChessPuzzle | null {
  if (PUZZLES.length === 0) return null;
  const solved = params.solved ?? new Set<string>();
  const exclude = params.exclude ?? new Set<string>();

  const allowed = PUZZLES.filter((p) => !exclude.has(p.id));
  const unsolvedFresh = allowed.filter((p) => !solved.has(p.id));

  const pool =
    unsolvedFresh.length > 0
      ? unsolvedFresh
      : allowed.length > 0
        ? allowed
        : PUZZLES.filter((p) => !solved.has(p.id));

  const final = pool.length > 0 ? pool : PUZZLES;
  return final[Math.floor(Math.random() * final.length)];
}

/** Total pool size — used by the trainer only to show honest counts. */
export function getMatePoolSize(): number {
  return PUZZLES.length;
}
