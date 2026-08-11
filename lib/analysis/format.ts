import type { Color } from "chess.js";

/** "14." for White's move, "14..." for Black's — standard PGN-style move numbering from a 0-indexed ply. */
export function formatMoveNumber(ply: number, mover: Color): string {
  const moveNumber = Math.floor(ply / 2) + 1;
  return mover === "w" ? `${moveNumber}.` : `${moveNumber}...`;
}
