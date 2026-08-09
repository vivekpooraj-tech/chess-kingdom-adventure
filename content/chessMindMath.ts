/**
 * Positions for the "Chess Mathematics" Chess Mind module. Every count here
 * (legalMoveCount, knightMoveCount) was computed and verified programmatically
 * with chess.js, not estimated by hand — see the generator script used to
 * produce this list. Real chess.js move generation IS the ground truth, so
 * there's no risk of a wrong "correct answer" baked into the content.
 */
export interface MathPosition {
  fen: string;
  legalMoveCount: number;
  knightSquare: string;
  knightMoveCount: number;
}

export const CHESS_MATH_POSITIONS: MathPosition[] = [
  {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    legalMoveCount: 20,
    knightSquare: "b1",
    knightMoveCount: 2,
  },
  {
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    legalMoveCount: 27,
    knightSquare: "f3",
    knightMoveCount: 5,
  },
  {
    fen: "4k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
    legalMoveCount: 13,
    knightSquare: "d5",
    knightMoveCount: 8,
  },
  {
    fen: "4k3/8/8/8/8/8/8/N3K3 w - - 0 1",
    legalMoveCount: 7,
    knightSquare: "a1",
    knightMoveCount: 2,
  },
  {
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5",
    legalMoveCount: 36,
    knightSquare: "c3",
    knightMoveCount: 5,
  },
];
