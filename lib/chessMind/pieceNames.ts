import { PieceSymbol } from "chess.js";

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King",
};

/** Standard relative piece values used across Chess Mind — king excluded
 * since it's never captured/counted as material. */
export const PIECE_VALUE: Record<Exclude<PieceSymbol, "k">, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9,
};
