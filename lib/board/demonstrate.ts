/**
 * "Would you like me to show you?" — turning a lesson topic into squares.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: every square Ollie highlights comes
 * from chess.js, in the real position on screen. Nothing here composes a
 * demonstration from prose, from the lesson text, or from what a piece
 * "usually" does. If chess.js says a move is not available in this position,
 * Ollie cannot point at it — which is the whole difference between a teaching
 * aid and a confidently wrong one.
 *
 * It also never MAKES a move. It returns squares for TeachingOverlay to draw
 * over the board; the learner still plays the move themselves, on the real
 * board, under the real rules.
 *
 * Pure, and safe on any input: an unparseable FEN, a piece that is not in the
 * position, or a piece with no legal moves all return null, and the caller
 * then offers no demonstration rather than an empty one.
 */
import { Chess, type PieceSymbol, type Square } from "chess.js";

const PIECE_SYMBOLS: Record<string, PieceSymbol> = {
  pawn: "p",
  knight: "n",
  bishop: "b",
  rook: "r",
  queen: "q",
  king: "k",
  p: "p",
  n: "n",
  b: "b",
  r: "r",
  q: "q",
  k: "k",
};

export interface Demonstration {
  /** The square the piece being demonstrated is standing on. */
  from: Square;
  /** Every square it can legally move to in THIS position. */
  targets: Square[];
  /** "knight", "rook", ... — for the sentence Ollie says alongside. */
  pieceName: string;
}

export function pieceSymbolFor(name: string): PieceSymbol | null {
  return PIECE_SYMBOLS[String(name ?? "").toLowerCase()] ?? null;
}

/**
 * Find a piece of `pieceName` belonging to the side to move, and list where
 * it can legally go.
 *
 * When several of the same piece are on the board, the one with the most
 * legal moves is chosen — it demonstrates the piece's movement most clearly,
 * and the choice is deterministic (ties break by square name) so the same
 * position always produces the same demonstration.
 */
export function demonstratePiece(fen: string, pieceName: string): Demonstration | null {
  const symbol = pieceSymbolFor(pieceName);
  if (!symbol) return null;

  // chess.js treats an empty/undefined FEN as "the starting position", which
  // would let a missing prop silently demonstrate a position that is NOT the
  // one on screen. A demonstration must describe the board the learner is
  // looking at or it must not happen at all.
  if (typeof fen !== "string" || fen.trim().length === 0) return null;

  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return null;
  }

  const turn = game.turn();
  let best: Demonstration | null = null;

  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell || cell.type !== symbol || cell.color !== turn) continue;
      let moves: { to: Square }[] = [];
      try {
        moves = game.moves({ square: cell.square, verbose: true }) as { to: Square }[];
      } catch {
        continue;
      }
      if (moves.length === 0) continue;

      const targets = Array.from(new Set(moves.map((m) => m.to))).sort();
      if (
        !best ||
        targets.length > best.targets.length ||
        (targets.length === best.targets.length && cell.square < best.from)
      ) {
        best = { from: cell.square, targets, pieceName: String(pieceName).toLowerCase() };
      }
    }
  }

  return best;
}

/**
 * The sentence Ollie says next to the highlights.
 *
 * States the real count, because the learner can see the real squares and a
 * mismatch between the two would be immediately, obviously wrong.
 */
export function describeDemonstration(demo: Demonstration, childTone: boolean): string {
  const count = demo.targets.length;
  const squares = count === 1 ? "one square" : `${count} squares`;
  return childTone
    ? `Look! The ${demo.pieceName} on ${demo.from} can go to ${squares} — I've lit them up. Try one!`
    : `The ${demo.pieceName} on ${demo.from} has ${count} legal ${count === 1 ? "move" : "moves"} here, highlighted on the board.`;
}
