import { Chess } from "chess.js";

/**
 * Does a move the child just played match what the content asked for?
 *
 * Content writes solutions the way a human would say them — "Nc7+", "e5",
 * "O-O" — and sometimes as coordinates, "e1g1". The board reports SAN. Rather
 * than forcing content authors into one notation and hoping they never slip,
 * both sides are resolved through chess.js against the actual position and
 * compared as the SAN chess.js itself produces.
 *
 * That matters more than it sounds. "Nc7+" and "Nc7" are the same move; so are
 * "a8=Q" and "a7a8q". A string comparison rejects half of them and tells a
 * child who found the right move that they were wrong, which is the single
 * worst thing a teaching app can do.
 */

/** The SAN chess.js produces for a move given in SAN or UCI, or null if the
 *  move is not legal in this position. */
export function canonicalSan(fen: string, move: string): string | null {
  const trimmed = move.trim();
  if (!trimmed) return null;

  try {
    const game = new Chess(fen);
    const played = game.move(trimmed);
    if (played) return played.san;
  } catch {
    /* not SAN — fall through to UCI */
  }

  if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(trimmed)) {
    try {
      const game = new Chess(fen);
      const played = game.move({
        from: trimmed.slice(0, 2),
        to: trimmed.slice(2, 4),
        promotion: (trimmed[4] || "q").toLowerCase(),
      });
      if (played) return played.san;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * True when `played` is one of the moves `accepted` describes.
 *
 * Any accepted move counts. Some positions genuinely have two winning forks,
 * and marking the second one wrong would teach a child that chess has one
 * right answer, which is false and discouraging in the same breath.
 */
export function moveMatches(
  fen: string,
  playedSan: string,
  accepted: readonly string[]
): boolean {
  const played = canonicalSan(fen, playedSan);
  if (!played) return false;
  return accepted.some((a) => canonicalSan(fen, a) === played);
}

/** Every legal move in a position, as SAN. Used by the test suite to prove a
 *  puzzle's accepted list is a subset of what is actually possible. */
export function legalSanMoves(fen: string): readonly string[] {
  try {
    return new Chess(fen).moves();
  } catch {
    return [];
  }
}

/** Whether a FEN loads at all. */
export function isLegalFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}
