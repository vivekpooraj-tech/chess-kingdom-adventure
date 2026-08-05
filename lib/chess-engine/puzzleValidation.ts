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
 * True if `sanMove` played from `fen` is a sound first move of a mate-in-2:
 * after playing it, EVERY legal opponent reply still leaves a mate-in-1
 * available. Checking against every reply (not just the "expected" one) is
 * what makes this correct regardless of which legal defense the opponent
 * actually plays — see the comment on ChessPuzzle.mateIn in lib/types.ts.
 */
export function isSoundMateIn2FirstMove(fen: string, sanMove: string): boolean {
  const afterMove = new Chess(fen);
  const move = afterMove.move(sanMove);
  if (!move) return false; // illegal move
  if (afterMove.isCheckmate()) return false; // that's mate-in-1, not a mate-in-2 first move
  if (afterMove.isGameOver()) return false; // stalemate/draw — not a valid line

  const replies = afterMove.moves();
  if (replies.length === 0) return false;

  return replies.every((reply) => {
    const afterReply = new Chess(afterMove.fen());
    afterReply.move(reply);
    return hasMateIn1(afterReply.fen());
  });
}
