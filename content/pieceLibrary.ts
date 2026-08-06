import { Piece } from "@/lib/types";
import type { PieceSymbol } from "chess.js";

export interface PieceLibraryEntry {
  piece: Piece;
  symbol: PieceSymbol;
  name: string;
  /** Traditional relative point value — null for the King, which is
   * never traded and isn't assigned a point value (losing it ends the
   * game, so it's worth more than "a number" could capture). */
  value: number | null;
  howItMoves: string;
  role: string;
  funFact: string;
}

export const PIECE_LIBRARY: PieceLibraryEntry[] = [
  {
    piece: "pawn",
    symbol: "p",
    name: "Pawn",
    value: 1,
    howItMoves:
      "Marches straight forward one square at a time (two squares on its very first move), but captures diagonally — one square forward-left or forward-right.",
    role:
      "The most common piece on the board and the foundation of every position — chess players call pawns \"the soul of chess\" because where you place them shapes the whole game. Weak alone, powerful together.",
    funFact:
      "If a pawn marches all the way to the far side of the board, it transforms — promoting into a Queen, Rook, Bishop, or Knight!",
  },
  {
    piece: "knight",
    symbol: "n",
    name: "Knight",
    value: 3,
    howItMoves:
      "Jumps in an L-shape: two squares in one direction, then one square sideways. It's the only piece that can leap clean over other pieces.",
    role:
      "A sneaky, short-range piece that loves crowded, closed positions where other pieces get stuck. Knights are famous for forks — landing on a square that attacks two enemy pieces at once.",
    funFact: "A Knight standing in a corner only attacks 2 squares — but one in the center attacks up to 8!",
  },
  {
    piece: "bishop",
    symbol: "b",
    name: "Bishop",
    value: 3,
    howItMoves:
      "Glides diagonally, any number of squares, in any direction — but it can never leave the color square it started on.",
    role:
      "A long-range attacker that controls whole diagonals. Every player has one \"light-square\" Bishop and one \"dark-square\" Bishop — together, the Bishop pair is famously strong.",
    funFact: "Since a Bishop is stuck on one color forever, it can never checkmate a King alone — it always needs help!",
  },
  {
    piece: "rook",
    symbol: "r",
    name: "Rook",
    value: 5,
    howItMoves:
      "Charges in straight lines — up, down, left, or right — any number of squares, as far as the path is clear.",
    role:
      "A heavyweight piece that dominates open files and ranks, especially in the endgame. Rooks love the 7th rank (or 2nd, for Black) where they can attack enemy pawns.",
    funFact: "Two Rooks working together can checkmate a lone King all by themselves — no Queen needed!",
  },
  {
    piece: "queen",
    symbol: "q",
    name: "Queen",
    value: 9,
    howItMoves:
      "The most powerful piece on the board — moves like a Rook AND a Bishop combined, in a straight line or diagonal, any number of squares.",
    role:
      "Worth almost as much as a Rook, Bishop, and Pawn put together. Losing your Queen usually means losing the game, so she's protected carefully — but unleashed at the right moment, she can end a game fast.",
    funFact: "The Queen wasn't always this powerful — centuries ago, she could only move one square diagonally!",
  },
  {
    piece: "king",
    symbol: "k",
    name: "King",
    value: null,
    howItMoves:
      "Moves just one square in any direction — forward, backward, sideways, or diagonally.",
    role:
      "The whole point of the game! You never actually capture the King — the game ends the moment he's checkmated (in check with no way to escape). Every other piece exists to protect him or attack the enemy King.",
    funFact:
      "Even though he's slow, the King becomes a surprisingly strong fighting piece once most other pieces are traded off in the endgame.",
  },
];

export function getPieceLibraryEntry(piece: Piece): PieceLibraryEntry {
  return PIECE_LIBRARY.find((p) => p.piece === piece) ?? PIECE_LIBRARY[0];
}
