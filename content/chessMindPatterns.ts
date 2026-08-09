/**
 * Pattern Recognition positions. Every one of these was constructed with
 * chess.js's board-editing API (.put/.remove) and programmatically
 * verified to actually exhibit the claimed pattern — not asserted by eye.
 * See the generator/verification script used to build this list:
 *   - fork: the move is a legal knight move, and from its landing square
 *     the knight's real attack pattern covers 2+ enemy pieces.
 *   - pin: removing the "pinned" piece exposes its own king to check that
 *     wasn't there before (chess.js .remove() + .inCheck()).
 *   - hanging: the move is a legal capture, and after it there is no
 *     legal recapture on that square.
 *   - check / checkmate: chess.js .isCheck()/.isCheckmate() after the move.
 */
export type PatternType = "fork" | "pin" | "hanging" | "check" | "checkmate";

export interface PatternChallenge {
  id: string;
  type: PatternType;
  fen: string;
  prompt: string;
  /** The move to play, for fork/hanging/check/checkmate (compared against
   * the move the child actually makes on the board). Unused for pin. */
  correctSan?: string;
  /** The square to identify, for pin only. */
  targetSquare?: string;
  /** Multiple-choice options for pin identification (includes targetSquare). */
  pinChoices?: string[];
  explanation: string;
}

export const PATTERN_CHALLENGES: PatternChallenge[] = [
  {
    id: "fork-1",
    type: "fork",
    fen: "8/4k3/8/r3N3/8/8/8/7K w - - 0 1",
    prompt: "White to move. Find the Knight fork!",
    correctSan: "Nc6+",
    explanation: "Nc6+ attacks the King on e7 AND the Rook on a5 at the same time — a fork. The King must move, and then White wins the Rook.",
  },
  {
    id: "fork-2",
    type: "fork",
    fen: "4q1k1/5p2/8/7N/8/8/8/K7 w - - 0 1",
    prompt: "White to move. Find the Knight fork!",
    correctSan: "Nf6+",
    explanation: "Nf6+ attacks the King on g8 AND the Queen on e8 at the same time. After the King moves, White captures the Queen.",
  },
  {
    id: "pin-1",
    type: "pin",
    fen: "4k3/4r3/8/8/8/8/8/K3R3 b - - 0 1",
    prompt: "Black to move. Which piece is pinned?",
    targetSquare: "e7",
    pinChoices: ["e7", "e8", "a1"],
    explanation: "The Rook on e7 is pinned — if it moved off the e-file, White's Rook on e1 would deliver check to the King on e8.",
  },
  {
    id: "pin-2",
    type: "pin",
    fen: "6k1/5n2/8/8/8/1B6/8/K7 b - - 0 1",
    prompt: "Black to move. Which piece is pinned?",
    targetSquare: "f7",
    pinChoices: ["f7", "g8", "b3"],
    explanation: "The Knight on f7 is pinned along the b3-g8 diagonal — moving it would expose the King on g8 to the Bishop on b3.",
  },
  {
    id: "hanging-1",
    type: "hanging",
    fen: "7k/3n4/8/8/8/8/8/K2Q4 w - - 0 1",
    prompt: "White to move. Capture the hanging piece!",
    correctSan: "Qxd7",
    explanation: "The Knight on d7 has no defenders — Qxd7 wins it for free.",
  },
  {
    id: "hanging-2",
    type: "hanging",
    fen: "7k/4b3/8/3N4/8/8/8/K7 w - - 0 1",
    prompt: "White to move. Capture the hanging piece!",
    correctSan: "Nxe7",
    explanation: "The Bishop on e7 has no defenders — Nxe7 wins it for free.",
  },
  {
    id: "check-1",
    type: "check",
    fen: "4k3/8/8/8/8/8/8/K6R w - - 0 1",
    prompt: "White to move. Give check!",
    correctSan: "Rh8+",
    explanation: "Rh8+ lines up with the King along the 8th rank — check!",
  },
  {
    id: "checkmate-1",
    type: "checkmate",
    fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    prompt: "White to move. Find checkmate!",
    correctSan: "Re8#",
    explanation: "Re8# — the King's own pawns on f7, g7, and h7 block every escape square. That's checkmate.",
  },
  {
    id: "checkmate-2",
    type: "checkmate",
    fen: "6k1/5ppp/8/8/8/8/8/KQ6 w - - 0 1",
    prompt: "White to move. Find checkmate!",
    correctSan: "Qb8#",
    explanation: "Qb8# delivers check along the 8th rank, and the King's own pawns block every escape square. Checkmate.",
  },
];
