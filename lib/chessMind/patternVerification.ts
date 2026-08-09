import { Chess, Square, PieceSymbol, Color } from "chess.js";

const KNIGHT_OFFSETS: [number, number][] = [
  [1, 2], [2, 1], [-1, 2], [-2, 1],
  [1, -2], [2, -1], [-1, -2], [-2, -1],
];

function fileRank(square: Square): [number, number] {
  return [square.charCodeAt(0) - 97, parseInt(square[1], 10) - 1];
}

function toSquare(file: number, rank: number): Square {
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
}

/**
 * Semantic verification of whatever move the child actually played,
 * rather than string-matching a single pre-chosen "correct" SAN — a
 * different legal move that also genuinely forks two pieces should count
 * as correct too. Mirrors the same technique used to author
 * content/chessMindPatterns.ts in the first place (chess.js's real board
 * state, not a guess).
 */
export function moveWasFork(fenBeforeMove: string, fromSquare: Square, toSq: Square): boolean {
  const game = new Chess(fenBeforeMove);
  const mover = game.turn();
  const piece = game.get(fromSquare);
  if (!piece || piece.type !== "n") return false;
  const [f, r] = fileRank(toSq);
  let attacked = 0;
  for (const [df, dr] of KNIGHT_OFFSETS) {
    const nf = f + df;
    const nr = r + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    const target = game.get(toSquare(nf, nr));
    if (target && target.color !== mover) attacked++;
  }
  return attacked >= 2;
}

export function moveWasHanging(fenBeforeMove: string, fromSquare: Square, toSq: Square): boolean {
  const game = new Chess(fenBeforeMove);
  const targetBefore = game.get(toSq);
  if (!targetBefore) return false; // wasn't a capture
  const moves = game.moves({ square: fromSquare, verbose: true });
  const played = moves.find((m) => m.to === toSq);
  if (!played) return false;
  game.move({ from: fromSquare, to: toSq, promotion: "q" });
  const recaptures = game.moves({ verbose: true }).filter((m) => m.to === toSq);
  return recaptures.length === 0;
}

export function moveWasPinned(fen: string, square: Square): boolean {
  const game = new Chess(fen);
  const defender: Color = game.turn();
  const piece = game.get(square);
  if (!piece || piece.color !== defender) return false;
  if (game.inCheck()) return false;
  game.remove(square);
  return game.inCheck();
}
