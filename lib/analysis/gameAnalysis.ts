import { Chess, type Color } from "chess.js";
import { stockfish } from "@/lib/chess-engine/stockfishEngine";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";
import {
  centipawnLoss,
  classifyMove,
  evalFromWhitePerspective,
  isMateScore,
  type MoveCategory,
} from "./moveClassification";
import { computeAccuracy, type AccuracyResult } from "./accuracy";
import { classifyMistakeSkill, type SkillClassification } from "./skillMapping";

/** One ply, captured live during play — see app/free-play/page.tsx's
 * handlePositionChange. `fen` is the position AFTER this move. */
export interface PlayedMove {
  ply: number;
  san: string;
  fen: string;
  mover: Color;
}

export interface CompletedGameRecord {
  startFen: string;
  moves: PlayedMove[];
  result: { isCheckmate: boolean; isDraw: boolean; winner: Color | null };
  playerColor: Color;
  opponentLabel: string;
  difficulty: Difficulty;
  startedAt: string;
  endedAt: string;
  openingName: string | null;
}

export interface BestMoveSuggestion {
  san: string;
  evalCp: number;
  isCapture: boolean;
}

export interface AnalyzedMove extends PlayedMove {
  fenBefore: string;
  isPlayerMove: boolean;
  category: MoveCategory;
  lossCp: number;
  /** True if this move delivered checkmate itself. */
  isCheckmate: boolean;
  bestMove?: BestMoveSuggestion;
  missedMate: boolean;
  missedMaterial: boolean;
  /** Set only for the player's flagged mistakes — the conservative skill
   * attribution (see lib/analysis/skillMapping.ts). */
  skill?: SkillClassification;
}

export interface GameAnalysisResult {
  moves: AnalyzedMove[];
  /** Player's mistake/blunder moves, in game order — the "Review Mistakes" list. */
  flaggedMistakes: AnalyzedMove[];
  /** A small number of the player's strongest moves, worth praising. */
  highlightedGoodMoves: AnalyzedMove[];
  /** Player-move counts per category, for the performance summary. */
  counts: Record<MoveCategory, number>;
  /** Chess Mind accuracy (0–100) for the player — see lib/analysis/accuracy.ts. */
  accuracy: AccuracyResult;
}

function uciToMoveDetails(fen: string, uci: string): { san: string; isCapture: boolean } | null {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion: promotion as any });
    if (!move) return null;
    return { san: move.san, isCapture: !!move.captured };
  } catch {
    return null;
  }
}

const MAX_FLAGGED_FOR_DEEP_LOOKUP = 12; // keep analysis time bounded on long, messy games
const GOOD_MOVE_HIGHLIGHT_COUNT = 3;

/**
 * Runs the full post-game analysis pass: one engine evaluation per ply
 * (shared across the "before" and "after" comparison of adjacent moves —
 * see the file-level note below), then a second, targeted best-move
 * lookup only for the player's actual mistakes/blunders (the "prioritize
 * blunders, don't analyze every position unnecessarily" instruction).
 * `onProgress` drives the "Analyzing your game..." loading state.
 */
export async function analyzeGame(
  record: CompletedGameRecord,
  onProgress?: (done: number, total: number) => void
): Promise<GameAnalysisResult> {
  const { startFen, moves, playerColor } = record;

  // fens[0] = starting position; fens[i+1] = position after moves[i].
  // Evaluating each position exactly once here means the "before" eval for
  // move i and the "after" eval for move i-1 are the same lookup, reused —
  // an 80-ply game needs 81 engine calls total, not up to 160.
  const fens = [startFen, ...moves.map((m) => m.fen)];
  const evalsWhite: number[] = [];
  for (let i = 0; i < fens.length; i++) {
    const fen = fens[i];
    const sideToMove: Color = fen.split(" ")[1] === "b" ? "b" : "w";
    const cp = await stockfish.evaluatePosition(fen);
    evalsWhite.push(evalFromWhitePerspective(cp, sideToMove));
    onProgress?.(i + 1, fens.length);
  }

  const analyzed: AnalyzedMove[] = moves.map((m, i) => {
    const evalWhiteBefore = evalsWhite[i];
    const evalWhiteAfter = evalsWhite[i + 1];
    const loss = Math.max(0, centipawnLoss(evalWhiteBefore, evalWhiteAfter, m.mover));
    return {
      ...m,
      fenBefore: fens[i],
      isPlayerMove: m.mover === playerColor,
      category: classifyMove(loss),
      lossCp: loss,
      isCheckmate: record.result.isCheckmate && i === moves.length - 1,
      missedMate: false,
      missedMaterial: false,
    };
  });

  const candidates = analyzed.filter(
    (a) => a.isPlayerMove && (a.category === "mistake" || a.category === "blunder")
  );
  // Worst first (most instructive), capped so a very messy game doesn't
  // stall on dozens of engine searches the child will never read anyway.
  const toLookUp = [...candidates].sort((a, b) => b.lossCp - a.lossCp).slice(0, MAX_FLAGGED_FOR_DEEP_LOOKUP);

  for (const move of toLookUp) {
    try {
      const best = await stockfish.findBestMove(move.fenBefore);
      const details = uciToMoveDetails(move.fenBefore, best.move);
      if (!details) continue;
      move.bestMove = { san: details.san, evalCp: best.evalCp, isCapture: details.isCapture };

      // best.evalCp is from the mover's own perspective (fenBefore's side
      // to move) since findBestMove searches fenBefore directly.
      const moverEvalAfterActual =
        move.mover === "w" ? evalsWhite[move.ply + 1] : -evalsWhite[move.ply + 1];
      move.missedMate = isMateScore(best.evalCp) && best.evalCp > 0 && !(isMateScore(moverEvalAfterActual) && moverEvalAfterActual > 0);
      move.missedMaterial = !move.missedMate && details.isCapture && best.evalCp - moverEvalAfterActual >= 250;
    } catch {
      // Engine hiccup on one move shouldn't take down the whole report —
      // it just won't get a "better move" suggestion.
    }
  }

  const flaggedMistakes = analyzed.filter(
    (a) => a.isPlayerMove && (a.category === "mistake" || a.category === "blunder")
  );

  // Conservative skill attribution — only for the player's flagged
  // mistakes, only from facts already established above. Never invents a
  // tactical theme (see lib/analysis/skillMapping.ts).
  for (const m of flaggedMistakes) {
    m.skill = classifyMistakeSkill(m, analyzed);
  }

  const highlightedGoodMoves = analyzed
    .filter((a) => a.isPlayerMove && a.category === "excellent")
    .sort((a, b) => a.lossCp - b.lossCp)
    .slice(0, GOOD_MOVE_HIGHLIGHT_COUNT);

  const counts: Record<MoveCategory, number> = {
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  for (const a of analyzed) {
    if (a.isPlayerMove) counts[a.category]++;
  }

  const accuracy = computeAccuracy(analyzed);

  return { moves: analyzed, flaggedMistakes, highlightedGoodMoves, counts, accuracy };
}
