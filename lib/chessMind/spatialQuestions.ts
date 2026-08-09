import { Chess, Square, PieceSymbol } from "chess.js";
import { generateChoices } from "./choices";
import { PIECE_NAME } from "./pieceNames";

export interface SpatialQuestion {
  prompt: string;
  choices: string[];
  correctAnswer: string;
}

// Knight is covered by Chess Mathematics' knight-distance questions and
// pawns move too situationally (captures/en passant/double-step) to make a
// clean "which squares can it reach" quiz — Spatial Thinking sticks to the
// four piece types with clear, board-spanning movement patterns.
const SPATIAL_PIECES: Exclude<PieceSymbol, "k" | "p" | "n">[] = ["b", "r", "q"];

function allSquares(): Square[] {
  const out: Square[] = [];
  for (const file of "abcdefgh") {
    for (let rank = 1; rank <= 8; rank++) out.push(`${file}${rank}` as Square);
  }
  return out;
}

function moversWithMoves(fen: string, includeKing: boolean) {
  const game = new Chess(fen);
  const mover = game.turn();
  const board = game.board();
  const types: PieceSymbol[] = includeKing ? [...SPATIAL_PIECES, "k"] : [...SPATIAL_PIECES];
  const pieces: { square: Square; type: PieceSymbol }[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.color === mover && types.includes(cell.type)) {
        pieces.push({ square: cell.square as Square, type: cell.type });
      }
    }
  }
  return pieces
    .map((p) => ({ ...p, moves: game.moves({ square: p.square, verbose: true }) }))
    .filter((p) => p.moves.length > 0);
}

/** "How many squares can the Bishop on c1 move to?" — a real count from the
 * real position, for any sliding piece (or the King), not just the Knight. */
export function generateReachCountQuestion(fen: string): SpatialQuestion | null {
  const candidates = moversWithMoves(fen, true);
  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const count = target.moves.length;
  return {
    prompt: `How many squares can the ${PIECE_NAME[target.type]} on ${target.square} move to from here?`,
    choices: generateChoices(count, 4, 3).map(String),
    correctAnswer: String(count),
  };
}

/** "Which square can the Rook on a1 NOT reach?" — three genuinely reachable
 * squares plus one genuinely unreachable one, the odd one out. */
export function generateOddOneOutQuestion(fen: string): SpatialQuestion | null {
  const candidates = moversWithMoves(fen, false).filter((p) => p.moves.length >= 3);
  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const reachable = target.moves.map((m) => m.to as Square).sort(() => Math.random() - 0.5).slice(0, 3);
  const reachableSet = new Set(target.moves.map((m) => m.to));
  const unreachablePool = allSquares().filter((s) => s !== target.square && !reachableSet.has(s));
  if (unreachablePool.length === 0) return null;
  const unreachable = unreachablePool[Math.floor(Math.random() * unreachablePool.length)];
  const choices = [...reachable, unreachable].sort(() => Math.random() - 0.5);
  return {
    prompt: `Which square can the ${PIECE_NAME[target.type]} on ${target.square} NOT move to?`,
    choices,
    correctAnswer: unreachable,
  };
}

/** "Can the Queen on d1 reach d8 in one move?" — a genuine Yes/No drawn from
 * real legal moves, not a guessable pattern. */
export function generateCanReachQuestion(fen: string): SpatialQuestion | null {
  const candidates = moversWithMoves(fen, true);
  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const reachableSet = new Set(target.moves.map((m) => m.to));
  const askYes = Math.random() < 0.5;
  let square: Square;
  if (askYes) {
    square = target.moves[Math.floor(Math.random() * target.moves.length)].to as Square;
  } else {
    const pool = allSquares().filter((s) => s !== target.square && !reachableSet.has(s));
    if (pool.length === 0) return null;
    square = pool[Math.floor(Math.random() * pool.length)];
  }
  return {
    prompt: `Can the ${PIECE_NAME[target.type]} on ${target.square} reach ${square} in one move?`,
    choices: ["Yes", "No"],
    correctAnswer: askYes ? "Yes" : "No",
  };
}
