/**
 * Shape of a puzzle from the curated Lichess tactics library.
 *
 * Deliberately a DIFFERENT type from `ChessPuzzle` (lib/types.ts) rather than
 * an extension of it. The existing pool is mate-only and stores no solution —
 * correctness is proven at runtime by lib/chess-engine/puzzleValidation.ts,
 * where any move that mates is accepted. These puzzles are the opposite: a
 * specific forced line, verified once at build time, checked at runtime by
 * comparing against the stored moves. Collapsing the two into one type would
 * hide that difference and invite a runtime that validates the wrong way.
 *
 * Types only — no data, no `fs`, no library import — so this is safe for a
 * client component to import for the response shape. The library itself is
 * server-only (see tacticsLibrary.server.ts).
 */

/** Chess Mind SkillId, as assigned from the puzzle's Lichess themes. */
export type TacticsSkill =
  | "forks"
  | "pins"
  | "skewers"
  | "discovered_attacks"
  | "piece_safety"
  | "king_safety"
  | "tactical_awareness"
  | "calculation"
  | "endgame"
  | "checks";

export type TacticsTier = "beginner" | "intermediate" | "advanced";

/** Runtime companion to TacticsSkill — every value the type allows, in a
 *  fixed display order, so a theme browser can enumerate them without a
 *  hardcoded duplicate list drifting from the type. */
export const TACTICS_SKILLS: readonly TacticsSkill[] = [
  "forks",
  "pins",
  "skewers",
  "discovered_attacks",
  "piece_safety",
  "king_safety",
  "checks",
  "tactical_awareness",
  "calculation",
  "endgame",
];

export const TACTICS_TIERS: readonly TacticsTier[] = ["beginner", "intermediate", "advanced"];

export interface TacticsPuzzle {
  /** Namespaced (`lc-<lichessId>`) so it can never collide with an id from
   *  content/puzzles.ts — both share the puzzle_library_solves table. */
  id: string;
  /** The position the CHILD sees: the opponent's blunder is already applied
   *  at build time, so the runtime never has to know about it. */
  fen: string;
  /** Whose turn it is in `fen` — i.e. the side the child plays. */
  sideToMove: "w" | "b";
  /**
   * The forced line in UCI, alternating from the child's perspective:
   * index 0 is the child's move, index 1 the opponent's scripted reply,
   * index 2 the child's next move, and so on. Even indices are the child's.
   */
  solution: string[];
  /** Same line in SAN, for readable feedback. */
  solutionSan: string[];
  skill: TacticsSkill;
  tier: TacticsTier;
  /** Lichess puzzle rating (500-2199 in this library). */
  rating: number;
  /** Raw Lichess theme tags — never invented. */
  themes: string[];
  lichessId: string;
  gameUrl: string | null;
}

/** What the API sends to the browser. */
export interface TacticsPuzzleResponse {
  puzzle: TacticsPuzzle | null;
  /** Why this puzzle was chosen, when it was a personalized pick. Null when
   *  the choice was just a balanced default — the UI must not claim a reason
   *  that does not exist. */
  reason: { skill: TacticsSkill; skillName: string; weakCount: number } | null;
}

/** True when it is the child's turn within a solution line (even indices). */
export function isChildMoveIndex(i: number): boolean {
  return i % 2 === 0;
}
