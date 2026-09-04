import { Chess, type Color } from "chess.js";
import type { CompletedGameRecord, PlayedMove } from "./gameAnalysis";

export const STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Rebuilds the per-ply {ply, san, fen, mover} history the Game Review
 * needs from a plain SAN list.
 *
 * Free Play captures this live (moveLogRef in app/free-play/page.tsx).
 * Online games only persist the SAN list (online_games.moves, migration
 * 0013) — no per-move FEN — so this replays the SAN through chess.js to
 * recover each position. Deterministic, and if a move ever fails to
 * parse (it never should for a real finished game) the replay stops
 * there rather than throwing, so review still works on whatever prefix
 * was valid.
 */
export function reconstructMoves(sanMoves: string[], startFen: string = STANDARD_START_FEN): PlayedMove[] {
  const game = new Chess(startFen);
  const out: PlayedMove[] = [];
  for (let i = 0; i < sanMoves.length; i++) {
    const mover: Color = game.turn();
    let ok = false;
    try {
      ok = !!game.move(sanMoves[i]);
    } catch {
      ok = false;
    }
    if (!ok) break;
    out.push({ ply: i, san: sanMoves[i], fen: game.fen(), mover });
  }
  return out;
}

export interface OnlineGameRecordInput {
  sanMoves: string[];
  playerColor: Color;
  winner: "w" | "b" | "draw" | null;
  opponentLabel: string;
  openingName: string | null;
  startedAt: string;
  endedAt: string;
}

/** Adapts a finished online game into the exact CompletedGameRecord shape
 * PostGameAnalysis already consumes — no second review implementation. */
export function buildOnlineGameRecord(input: OnlineGameRecordInput): CompletedGameRecord {
  const moves = reconstructMoves(input.sanMoves);
  const last = moves[moves.length - 1];
  const isDraw = input.winner === "draw";
  const winner: Color | null = input.winner === "w" || input.winner === "b" ? input.winner : null;
  // A finished game whose final move is checkmate ends in checkmate; a
  // resignation / timeout / agreed draw does not. chess.js can tell us
  // from the reconstructed final position.
  let isCheckmate = false;
  if (last) {
    try {
      isCheckmate = new Chess(last.fen).isCheckmate();
    } catch {
      isCheckmate = false;
    }
  }
  return {
    startFen: STANDARD_START_FEN,
    moves,
    result: { isCheckmate, isDraw, winner },
    playerColor: input.playerColor,
    opponentLabel: input.opponentLabel,
    // CompletedGameRecord.difficulty is a Free-Play concept; "medium" is a
    // neutral placeholder that never affects analysis (analyzeGame ignores
    // it — it drives nothing in the engine pass).
    difficulty: "medium",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    openingName: input.openingName,
  };
}
