import { Chess, Square, PieceSymbol } from "chess.js";
import { generateChoices } from "./choices";
import { PIECE_NAME } from "./pieceNames";

export interface RevealQuestion {
  prompt: string;
  choices: string[];
  correctAnswer: string;
}

function allSquares(): Square[] {
  const out: Square[] = [];
  for (const file of "abcdefgh") {
    for (let rank = 1; rank <= 8; rank++) out.push(`${file}${rank}` as Square);
  }
  return out;
}

function randomOtherSquares(exclude: Square, count: number): Square[] {
  const pool = allSquares().filter((s) => s !== exclude);
  const picked: Square[] = [];
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

/** Real questions about a real position — "where was X" / "how many
 * pieces" — derived from the actual FEN, not pre-authored trivia. */
export function generateMemoryQuestion(fen: string): RevealQuestion {
  const game = new Chess(fen);
  const board = game.board();
  const occupied: { square: Square; type: PieceSymbol; color: "w" | "b" }[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell) occupied.push({ square: cell.square as Square, type: cell.type, color: cell.color });
    }
  }

  const roll = Math.random();

  if (roll < 0.5) {
    // "Where was the White/Black King?"
    const color: "w" | "b" = Math.random() < 0.5 ? "w" : "b";
    const king = occupied.find((p) => p.type === "k" && p.color === color)!;
    const distractors = randomOtherSquares(king.square, 3);
    const choices = [king.square, ...distractors].sort(() => Math.random() - 0.5);
    return {
      prompt: `Where was the ${color === "w" ? "White" : "Black"} King?`,
      choices,
      correctAnswer: king.square,
    };
  }

  if (roll < 0.8) {
    // "Which square had a [Piece]?" — for a non-king piece, if any exist.
    const candidates = occupied.filter((p) => p.type !== "k");
    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const distractors = randomOtherSquares(target.square, 3);
      const choices = [target.square, ...distractors].sort(() => Math.random() - 0.5);
      return {
        prompt: `Which square had a ${target.color === "w" ? "White" : "Black"} ${PIECE_NAME[target.type]}?`,
        choices,
        correctAnswer: target.square,
      };
    }
  }

  // "How many White pieces were on the board?"
  const whiteCount = occupied.filter((p) => p.color === "w").length;
  const choices = generateChoices(whiteCount, 4, 2).map(String);
  return {
    prompt: "How many White pieces were on the board?",
    choices,
    correctAnswer: String(whiteCount),
  };
}

/** "Which square did the [Piece] control?" — a real legal-move destination
 * for a real piece in the position, vs. squares it genuinely couldn't reach. */
export function generateVisualizationQuestion(fen: string): RevealQuestion | null {
  const game = new Chess(fen);
  const board = game.board();
  const mover = game.turn();
  const ownPieces: { square: Square; type: PieceSymbol }[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.color === mover && cell.type !== "k") {
        ownPieces.push({ square: cell.square as Square, type: cell.type });
      }
    }
  }

  // Only ask about a piece that actually has at least one legal move.
  const withMoves = ownPieces
    .map((p) => ({ ...p, moves: game.moves({ square: p.square, verbose: true }) }))
    .filter((p) => p.moves.length > 0);
  if (withMoves.length === 0) return null;

  const target = withMoves[Math.floor(Math.random() * withMoves.length)];
  const correctSquare = target.moves[Math.floor(Math.random() * target.moves.length)].to as Square;
  const reachable = new Set(target.moves.map((m) => m.to));
  const wrongPool = allSquares().filter((s) => !reachable.has(s) && s !== target.square);
  const distractors: Square[] = [];
  while (distractors.length < 3 && wrongPool.length > 0) {
    const i = Math.floor(Math.random() * wrongPool.length);
    distractors.push(wrongPool.splice(i, 1)[0]);
  }
  const choices = [correctSquare, ...distractors].sort(() => Math.random() - 0.5);

  return {
    prompt: `Which square could the ${PIECE_NAME[target.type]} on ${target.square} move to?`,
    choices,
    correctAnswer: correctSquare,
  };
}
