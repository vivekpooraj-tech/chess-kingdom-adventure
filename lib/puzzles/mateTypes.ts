import type { ChessPuzzle } from "@/lib/types";

/**
 * Wire shape for /api/puzzles/mate.
 *
 * Types only — no data, no `content/puzzles.ts`, no `fs` — so a client
 * component can import this freely.
 *
 * It lives here rather than in the route file for a specific reason. The
 * trainer used to do `import type { MatePuzzleResponse } from ".../route"`,
 * which happens to work because TypeScript erases type-only imports, but it
 * put a client component one keyword away from pulling in the route module —
 * and through it matePool.server.ts and all 1,000 puzzles (~192KB). Deleting
 * the word `type` in a refactor would have silently reintroduced the exact
 * bundle problem this architecture exists to prevent, with nothing to catch
 * it but a bundle-size review.
 *
 * Mirrors lib/puzzles/tacticsTypes.ts, which is the same pattern for the
 * tactics library.
 */
export interface MatePuzzleResponse {
  puzzle: ChessPuzzle | null;
  /** Ids this child has already solved — returned so the trainer can seed its
   *  in-session solved set without a second round-trip. */
  solvedIds: string[];
}
