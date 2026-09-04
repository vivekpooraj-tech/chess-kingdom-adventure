import { Chess, type Color, type PieceSymbol } from "chess.js";
import type { AnalyzedMove } from "./gameAnalysis";
import type { SkillId } from "./skills";

/**
 * Conservative engine-facts → skill mapper.
 *
 * The ONLY inputs are things a chess engine / chess.js already established
 * for this move: the category, the position before and after, whether a
 * forced mate or a winning capture was missed, and the game phase. It
 * never guesses a tactical theme (fork / pin / skewer / discovered attack)
 * because we cannot confidently detect from a single ply *why* a move was
 * bad in that specific way — those skills exist in the taxonomy for the
 * practice router and for the (Phase E) AI explanation, not for this
 * automatic classifier.
 *
 * Everything here degrades to `tactical_awareness` (a real, broad skill:
 * "scan for checks, captures and threats") and, when even that isn't
 * justified, to `advantage_loss` (the neutral bucket). That matches the
 * brief: "Otherwise → Tactical Awareness or a neutral 'Significant
 * Advantage Loss' category. DO NOT invent tactical themes."
 */

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Total non-king pieces on the board — the endgame signal. */
function nonKingPieceCount(fen: string): number {
  try {
    const board = new Chess(fen).board();
    let n = 0;
    for (const row of board) for (const sq of row) if (sq && sq.type !== "k") n++;
    return n;
  } catch {
    return 32;
  }
}

/**
 * Is one of `color`'s pieces of value >= 3 sitting on a square that the
 * other side attacks and `color` does not defend, in the position `fen`?
 * Same "attacked and no recapture" notion used to author
 * content/chessMindPatterns.ts's `hanging` challenges — deliberately simple
 * (it ignores exchange value beyond the >=3 floor), so it is only ever used
 * as a *supporting* signal, never the sole reason for a classification.
 */
function hasHangingPiece(fen: string, color: Color): { square: string; type: PieceSymbol } | null {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return null;
  }
  const opp: Color = color === "w" ? "b" : "w";
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color) continue;
      if (PIECE_VALUE[sq.type] < 3) continue;
      if (game.isAttacked(sq.square, opp) && !game.isAttacked(sq.square, color)) {
        return { square: sq.square, type: sq.type };
      }
    }
  }
  return null;
}

/** The player moved a piece that was, itself, the piece they had just
 * moved on their previous turn — a real "developing the same piece twice"
 * signal, computed only from SAN destination/source squares. */
function movedSamePieceAgain(moves: AnalyzedMove[], index: number): boolean {
  const current = moves[index];
  // Find the player's own previous move.
  for (let i = index - 1; i >= 0; i--) {
    if (moves[i].mover !== current.mover) continue;
    const prevTo = squareFromSan(moves[i].san);
    const curFrom = sourceSquareOfMove(moves, index);
    return !!prevTo && !!curFrom && prevTo === curFrom;
  }
  return false;
}

/** Destination square from a SAN string ("Nf3" → "f3", "exd5" → "d5",
 * "O-O" → null). Good enough for the same-piece-twice heuristic. */
function squareFromSan(san: string): string | null {
  const m = san.replace(/[+#!?]/g, "").match(/([a-h][1-8])(?:=[QRBN])?$/);
  return m ? m[1] : null;
}

/** Reconstructs the from-square of moves[index] by replaying SAN up to it. */
function sourceSquareOfMove(moves: AnalyzedMove[], index: number): string | null {
  try {
    const game = new Chess(moves[index].fenBefore);
    const played = game.move(moves[index].san);
    return played ? played.from : null;
  } catch {
    return null;
  }
}

export interface SkillClassification {
  skill: SkillId;
  /** How sure the automatic mapper is. "low" tells the UI / explain API to
   * lean on neutral phrasing. */
  confidence: "high" | "medium" | "low";
  /** True when this is the deliberate neutral bucket. */
  neutral: boolean;
}

/**
 * Classify a single flagged player mistake. `allMoves` is the full
 * analyzed list (for phase + same-piece-twice context).
 */
export function classifyMistakeSkill(mistake: AnalyzedMove, allMoves: AnalyzedMove[]): SkillClassification {
  const moveNumber = Math.floor(mistake.ply / 2) + 1;
  const isOpening = moveNumber <= 10;
  const isEndgame = nonKingPieceCount(mistake.fenBefore) <= 6;

  // 1. Missed a forced checkmate — the single most confident signal.
  if (mistake.missedMate) {
    return { skill: "tactical_awareness", confidence: "high", neutral: false };
  }

  // 2. The player's move left one of their own pieces hanging that was
  //    safe before → Piece Safety. Requires BOTH: safe before, hanging
  //    after, and the move was theirs.
  const hangingBefore = hasHangingPiece(mistake.fenBefore, mistake.mover);
  const hangingAfter = hasHangingPiece(mistake.fen, mistake.mover);
  if (hangingAfter && !hangingBefore) {
    return { skill: "piece_safety", confidence: "high", neutral: false };
  }

  // 3. A winning capture was available and not taken (engine's best move
  //    was a capture worth clearly more than what actually happened) →
  //    they didn't spot a tactical opportunity.
  if (mistake.missedMaterial) {
    return { skill: "tactical_awareness", confidence: "medium", neutral: false };
  }

  // 4. Endgame mistake with few pieces → Endgame (only when we're
  //    genuinely in an endgame, not just after a big trade in the
  //    middlegame — the <=6 non-king floor is conservative).
  if (isEndgame) {
    return { skill: "endgame", confidence: "medium", neutral: false };
  }

  // 5. Opening-phase mistake.
  if (isOpening) {
    if (movedSamePieceAgain(allMoves, allMoves.indexOf(mistake))) {
      return { skill: "development", confidence: "medium", neutral: false };
    }
    return { skill: "opening_principles", confidence: "low", neutral: false };
  }

  // 6. A blunder with a clear better move the engine found → the player
  //    missed something concrete. Tactical Awareness is the honest broad
  //    label; a specific theme would be a guess.
  if (mistake.bestMove && (mistake.category === "blunder" || mistake.lossCp >= 150)) {
    return { skill: "tactical_awareness", confidence: "low", neutral: false };
  }

  // 7. Nothing specific is justified.
  return { skill: "advantage_loss", confidence: "low", neutral: true };
}

/** The single "biggest learning moment": the flagged mistake most worth a
 * child's attention. Prefers a missed mate, then a missed winning capture,
 * then the largest centipawn swing. Returns null when there are no flagged
 * mistakes. */
export function pickBiggestMoment(flagged: AnalyzedMove[]): AnalyzedMove | null {
  if (flagged.length === 0) return null;
  return [...flagged].sort((a, b) => {
    const rank = (m: AnalyzedMove) => (m.missedMate ? 2 : m.missedMaterial ? 1 : 0);
    const r = rank(b) - rank(a);
    if (r !== 0) return r;
    return b.lossCp - a.lossCp;
  })[0];
}
