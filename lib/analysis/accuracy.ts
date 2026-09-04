import type { AnalyzedMove } from "./gameAnalysis";

/**
 * Chess Mind accuracy score (0–100) for the player.
 *
 * Not "1 − blunders / moves". Each of the player's moves gets a per-move
 * accuracy from its centipawn loss via a smooth exponential curve, and the
 * game score is the mean of those. Properties this gives us:
 *
 *   - deterministic: same game → same number, always.
 *   - bounded: every term is clamped to [0, 100], so the mean is too.
 *     Never NaN / Infinity (a mate-score loss of ~100000 just maps to 0).
 *   - short games behave sensibly: two clean moves → ~100, not a divide
 *     that blows up or a "0 mistakes so 100%" special case.
 *   - one big blunder in an otherwise clean game lands around 85–90, the
 *     same ballpark a mainstream chess site would show — a single bad move
 *     shouldn't read as "you played terribly".
 *   - a game that is all blunders lands near 10, not 0, because "you kept
 *     finding *a* move" is still worth acknowledging to a child. The floor
 *     comes from the curve, not a hard clamp.
 *
 * DECAY_CP is the centipawn loss at which a move scores ~37 (1/e). Tuned so
 * the 5-category bands in moveClassification.ts read intuitively:
 *   excellent (≤10cp) → ~92–100, good (≤50) → ~68–92,
 *   inaccuracy (≤100) → ~46–68, mistake (≤300) → ~10–46, blunder → <10.
 */
const DECAY_CP = 130;

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Per-move accuracy for a single centipawn-loss value. Exported for tests
 * and for any per-move display later. */
export function moveAccuracyFromLoss(lossCp: number): number {
  const loss = Number.isFinite(lossCp) && lossCp > 0 ? lossCp : 0;
  return clamp01to100(100 * Math.exp(-loss / DECAY_CP));
}

export interface AccuracyResult {
  /** 0–100, rounded. */
  score: number;
  /** How many of the player's own moves fed the score. */
  movesConsidered: number;
}

/**
 * Computes the player's accuracy from the analyzed move list. Only the
 * player's own moves count (the opponent's blunders are not the child's
 * accomplishment). The very first move out of book is included — its loss
 * is tiny for any reasonable move, so it doesn't distort anything, and
 * excluding "opening moves" would need a book we don't have.
 */
export function computeAccuracy(moves: AnalyzedMove[]): AccuracyResult {
  const playerMoves = moves.filter((m) => m.isPlayerMove);
  if (playerMoves.length === 0) {
    // No player moves analyzed at all (e.g. a 1-ply game where the player
    // is Black and the opponent got mated first). Nothing went wrong.
    return { score: 100, movesConsidered: 0 };
  }
  const sum = playerMoves.reduce((acc, m) => acc + moveAccuracyFromLoss(m.lossCp), 0);
  return {
    score: Math.round(clamp01to100(sum / playerMoves.length)),
    movesConsidered: playerMoves.length,
  };
}

/** A one-word band for the score, for a friendly label next to the number. */
export function accuracyBand(score: number): "Excellent" | "Strong" | "Solid" | "Developing" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Solid";
  return "Developing";
}
