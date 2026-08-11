import type { Color } from "chess.js";

export type MoveCategory = "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

export const CATEGORY_INFO: Record<MoveCategory, { emoji: string; label: string }> = {
  excellent: { emoji: "🟢", label: "Excellent" },
  good: { emoji: "🔵", label: "Good" },
  inaccuracy: { emoji: "⚪", label: "Inaccuracy" },
  mistake: { emoji: "🟡", label: "Mistake" },
  blunder: { emoji: "🔴", label: "Blunder" },
};

/** A mate score is mapped by the engine to ±(100000 - distance) — see
 * EngineResult's doc comment in stockfishEngine.ts. Treated as "huge" here
 * for comparison purposes, never displayed as a raw number to the child. */
const MATE_SCORE_THRESHOLD = 90000;

export function isMateScore(evalCp: number): boolean {
  return Math.abs(evalCp) >= MATE_SCORE_THRESHOLD;
}

/** Converts an engine eval (always "from the perspective of whoever's turn
 * it is in the FEN passed in") to a single consistent "advantage to White"
 * scale, so evaluations of different positions (different sides to move)
 * can be compared directly. */
export function evalFromWhitePerspective(evalCp: number, sideToMove: Color): number {
  return sideToMove === "w" ? evalCp : -evalCp;
}

/**
 * Approximate centipawn loss for the side that just moved: how much worse
 * the position (from their own perspective) became across their move,
 * comparing the engine's assessment of the position right before their
 * move to its assessment right after. This is an approximation of "true"
 * centipawn loss (which compares against the resulting position of the
 * objectively best move specifically) — close enough for classifying
 * moves into broad categories, not tournament-grade analysis. Always >= a
 * large negative swing is clamped to a sane display range by the caller.
 */
export function centipawnLoss(evalWhiteBefore: number, evalWhiteAfter: number, mover: Color): number {
  const delta = evalWhiteAfter - evalWhiteBefore; // positive = White gained
  return mover === "w" ? -delta : delta;
}

/**
 * Thresholds loosely follow common chess-site conventions (lichess/chess.com
 * style centipawn-loss bands), adapted to 5 categories. Deliberately coarse
 * — the point is "don't mark every slightly imperfect move as a mistake,"
 * per the brief.
 */
export function classifyMove(lossCp: number): MoveCategory {
  if (lossCp <= 10) return "excellent";
  if (lossCp <= 50) return "good";
  if (lossCp <= 100) return "inaccuracy";
  if (lossCp <= 300) return "mistake";
  return "blunder";
}
