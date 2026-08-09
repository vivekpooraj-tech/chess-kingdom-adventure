import { Chess, PieceSymbol } from "chess.js";
import { generateChoices } from "./choices";
import { PIECE_NAME, PIECE_VALUE } from "./pieceNames";
import { knightDistance, randomSquare } from "./knightDistance";

export interface MathQuestion {
  prompt: string;
  choices: string[];
  correctAnswer: string;
  /** Present only for questions that reference a real position on the board. */
  fen?: string;
}

const VALUE_PIECES: Exclude<PieceSymbol, "k">[] = ["p", "n", "b", "r", "q"];

/** "What is a Rook worth?" — the four standard values are always the four
 * choices, so there's never an implausible distractor. */
export function generatePieceValueQuestion(): MathQuestion {
  const piece = VALUE_PIECES[Math.floor(Math.random() * VALUE_PIECES.length)];
  const distinctValues = [...new Set(Object.values(PIECE_VALUE))].sort((a, b) => a - b);
  return {
    prompt: `In points, what is a ${PIECE_NAME[piece]} worth?`,
    choices: distinctValues.map(String).sort(() => Math.random() - 0.5),
    correctAnswer: String(PIECE_VALUE[piece]),
  };
}

/** "How many points of material does White have?" — summed live from a real
 * FEN via standard values, not a pre-stored number. */
export function generateMaterialCountQuestion(fen: string): MathQuestion {
  const game = new Chess(fen);
  const color: "w" | "b" = Math.random() < 0.5 ? "w" : "b";
  let total = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.color === color && cell.type !== "k") {
        total += PIECE_VALUE[cell.type as Exclude<PieceSymbol, "k">];
      }
    }
  }
  return {
    prompt: `How many points of material does ${color === "w" ? "White" : "Black"} have on the board?`,
    choices: generateChoices(total, 4, 3).map(String),
    correctAnswer: String(total),
    fen,
  };
}

function isLightSquare(square: string): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  return (file + rank) % 2 === 1;
}

/** Pure board geometry — no game state needed, the color of a square never changes. */
export function generateSquareColorQuestion(): MathQuestion {
  const square = randomSquare();
  const answer = isLightSquare(square) ? "Light" : "Dark";
  return {
    prompt: `Is ${square} a light or dark square?`,
    choices: ["Light", "Dark"],
    correctAnswer: answer,
  };
}

/** "What file is e5 on?" — reading coordinates off the board. */
export function generateCoordinateQuestion(): MathQuestion {
  const square = randomSquare();
  const file = square[0];
  const allFiles = "abcdefgh".split("");
  const distractors = allFiles.filter((f) => f !== file).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [file, ...distractors].sort(() => Math.random() - 0.5);
  return {
    prompt: `What file (letter) is the square ${square} on?`,
    choices,
    correctAnswer: file,
  };
}

/** Minimum knight hops between two squares — pure movement geometry. */
export function generateKnightDistanceQuestion(minDist: number, maxDist: number): MathQuestion {
  const from = randomSquare();
  let to = randomSquare(from);
  let dist = knightDistance(from, to);
  let guard = 0;
  while ((dist < minDist || dist > maxDist) && guard < 200) {
    to = randomSquare(from);
    dist = knightDistance(from, to);
    guard++;
  }
  return {
    prompt: `Minimum Knight moves from ${from} to ${to}?`,
    choices: generateChoices(dist, 4, 2).map(String),
    correctAnswer: String(dist),
  };
}
