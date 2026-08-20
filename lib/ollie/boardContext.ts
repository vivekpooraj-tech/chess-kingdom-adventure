import { Chess } from "chess.js";

/**
 * Turns a real FEN into a short, factual line for the system prompt --
 * every fact here (turn, check/checkmate/stalemate) is computed from the
 * FEN by chess.js itself, never asserted or fabricated. An invalid FEN
 * (or none at all) simply omits the line rather than guessing.
 */
export function buildBoardContextLine(fen?: string): string {
  if (!fen) return "";

  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return "";
  }

  const turnColor = game.turn() === "w" ? "White" : "Black";
  let status = "";
  if (game.isCheckmate()) {
    status = " The game is in checkmate.";
  } else if (game.isStalemate()) {
    status = " The position is a stalemate (a draw).";
  } else if (game.isCheck()) {
    status = ` ${turnColor} is in check.`;
  }

  return `\n\nCurrent board position (FEN: ${fen}). It is ${turnColor}'s turn.${status} This reflects the lesson's puzzle position, not necessarily a live game -- only mention it if the child's question is actually about the board. Never claim a move is legal or illegal beyond what you can work out from this FEN, and never invent piece placements that aren't in it.`;
}
