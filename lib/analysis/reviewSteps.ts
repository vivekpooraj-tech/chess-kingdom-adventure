import type { Color } from "chess.js";
import type { CompletedGameRecord, AnalyzedMove } from "./gameAnalysis";

export interface ReviewStep {
  /** The ply whose pre-move position this step shows. */
  ply: number;
  /** Position BEFORE this ply's move — read directly from the already-
   * stored per-ply FEN history (record.startFen / record.moves[i].fen),
   * never reconstructed by replaying moves into a live game instance. */
  fenBefore: string;
  san: string;
  mover: Color;
  isMistakeStep: boolean;
}

const MAX_LOOKBACK = 3;

/**
 * Builds the "go back up to 3 moves before the mistake" step sequence,
 * oldest first, ending with the mistake itself. Purely reads from the
 * already-computed, immutable game record/analysis — never mutates them,
 * never creates a new game, never touches the live ChessBoard the game was
 * actually played on (see the file this is used from,
 * components/game/analysis/MistakeReviewStepper.tsx, for the read-only
 * board it feeds).
 */
export function buildReviewSteps(record: CompletedGameRecord, mistake: AnalyzedMove): ReviewStep[] {
  const startPly = Math.max(0, mistake.ply - MAX_LOOKBACK);
  const steps: ReviewStep[] = [];
  for (let ply = startPly; ply <= mistake.ply; ply++) {
    const fenBefore = ply === 0 ? record.startFen : record.moves[ply - 1].fen;
    const move = record.moves[ply];
    steps.push({
      ply,
      fenBefore,
      san: move.san,
      mover: move.mover,
      isMistakeStep: ply === mistake.ply,
    });
  }
  return steps;
}
