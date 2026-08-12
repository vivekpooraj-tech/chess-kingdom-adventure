import { Chess } from "chess.js";

/** True if the side to move has at least one legal move that delivers
 * checkmate immediately. */
export function hasMateIn1(fen: string): boolean {
  const game = new Chess(fen);
  if (game.isGameOver()) return false;
  return game.moves().some((move) => {
    const g2 = new Chess(fen);
    g2.move(move);
    return g2.isCheckmate();
  });
}

/**
 * True if `sanMove` played from `fen` is a sound first move of a forced
 * mate in exactly `n` moves: after playing it, EVERY legal opponent reply
 * still leaves a forced mate in `n - 1` available (checked recursively, via
 * hasMateInN below). Checking against every reply — not just one
 * hand-picked "expected" line — is what makes this a genuine forced mate:
 * the puzzle stays correct no matter which legal defense the opponent (or a
 * curious kid poking at replies) actually plays. n=1 is the base case:
 * `sanMove` itself must be checkmate, no opponent reply involved.
 */
export function isSoundMateInNFirstMove(fen: string, sanMove: string, n: number): boolean {
  if (n < 1) return false;
  const afterMove = new Chess(fen);
  const move = afterMove.move(sanMove);
  if (!move) return false; // illegal move

  if (n === 1) return afterMove.isCheckmate();

  // A checkmate here would be a *faster* mate than the n we're checking for
  // — not a sound continuation of an n-move line — and a draw/stalemate
  // obviously isn't either.
  if (afterMove.isGameOver()) return false;

  const replies = afterMove.moves();
  if (replies.length === 0) return false;

  return replies.every((reply) => {
    const afterReply = new Chess(afterMove.fen());
    afterReply.move(reply);
    return hasMateInN(afterReply.fen(), n - 1);
  });
}

/** True if the side to move has SOME sound first move leading to a forced
 * mate in exactly `n` moves (see isSoundMateInNFirstMove). Used both to
 * verify authored puzzle content (does this position really have the
 * advertised mate?) and, recursively, by isSoundMateInNFirstMove itself to
 * check deeper plies. */
export function hasMateInN(fen: string, n: number): boolean {
  if (n < 1) return false;
  const game = new Chess(fen);
  if (game.isGameOver()) return false;
  return game.moves().some((sanMove) => isSoundMateInNFirstMove(fen, sanMove, n));
}

/**
 * The minimal N (1..maxDepth) for which a forced mate exists from this
 * position, or null if none exists within maxDepth. A puzzle advertised as
 * "mate in 3" must have exactMateDepth(puzzle.fen) === 3 — if a faster mate
 * (mate-in-1 or mate-in-2) is also available, the position is mislabeled
 * (it has an easier mate than advertised) and should not be used at that
 * depth. Puzzle-content verification only — not called during normal play.
 */
export function exactMateDepth(fen: string, maxDepth = 3): number | null {
  for (let n = 1; n <= maxDepth; n++) {
    if (hasMateInN(fen, n)) return n;
  }
  return null;
}

/** Backward-compatible alias — mate-in-2 is just the n=2 case. */
export function isSoundMateIn2FirstMove(fen: string, sanMove: string): boolean {
  return isSoundMateInNFirstMove(fen, sanMove, 2);
}
