/**
 * Geometry for teaching overlays drawn ON TOP of a chess board.
 *
 * WHY THIS IS SEPARATE FROM ChessBoard.
 *
 * components/board/ChessBoard.tsx is 760 lines that own move legality
 * (chess.js), selection, animation, the auto-opponent and game-over
 * detection. It drives Free Play, online games with clocks and rated
 * settlement, lessons and the Academy. Teaching highlights must never be
 * able to affect any of that, so nothing here — and nothing in
 * TeachingOverlay — is wired into it. The overlay is a sibling element
 * positioned over the board, with pointer-events disabled, and it receives
 * square NAMES and an orientation. It never sees the game, cannot select a
 * piece, cannot make a move and cannot change what is legal.
 *
 * The one thing it must get right is where a square is, which is pure
 * arithmetic and is what this module is.
 *
 * Square names are validated rather than trusted: a typo must draw nothing,
 * not draw a marker in the corner of the board where no such square exists.
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

/** Which way the board is facing — matches ChessBoard's playableColor. */
export type BoardOrientation = "w" | "b";

export interface SquarePosition {
  /** Column index 0-7, left to right AS DISPLAYED. */
  col: number;
  /** Row index 0-7, top to bottom AS DISPLAYED. */
  row: number;
  /** Centre of the square as a percentage of board width/height. */
  centerXPercent: number;
  centerYPercent: number;
}

export function isSquareName(value: unknown): boolean {
  if (typeof value !== "string" || value.length !== 2) return false;
  return (FILES as readonly string[]).includes(value[0]) && (RANKS as readonly string[]).includes(value[1]);
}

/**
 * Where a square sits on the rendered board, or null for anything that is
 * not a real square.
 *
 * Mirrors ChessBoard's own layout exactly: files a-h left to right and ranks
 * 8-1 top to bottom for White, both reversed for Black. If that ever changes
 * in ChessBoard, the overlay tests fail here rather than the overlay quietly
 * pointing at the wrong square — which for a teaching aid is the worst
 * possible failure, since a learner has no way to know it is wrong.
 */
export function squarePosition(
  square: string,
  orientation: BoardOrientation = "w"
): SquarePosition | null {
  if (!isSquareName(square)) return null;

  const files = orientation === "b" ? [...FILES].reverse() : [...FILES];
  const ranks = orientation === "b" ? [...RANKS].reverse() : [...RANKS];

  const col = files.indexOf(square[0] as (typeof FILES)[number]);
  const row = ranks.indexOf(square[1] as (typeof RANKS)[number]);
  if (col < 0 || row < 0) return null;

  return {
    col,
    row,
    centerXPercent: (col + 0.5) * 12.5,
    centerYPercent: (row + 0.5) * 12.5,
  };
}

export interface TeachingArrow {
  from: string;
  to: string;
}

export interface ResolvedArrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Turn arrows into drawable line coordinates, dropping any that name a square
 * that does not exist or that start and end in the same place.
 */
export function resolveArrows(
  arrows: readonly TeachingArrow[],
  orientation: BoardOrientation = "w"
): ResolvedArrow[] {
  const out: ResolvedArrow[] = [];
  for (const arrow of arrows ?? []) {
    if (!arrow) continue;
    const from = squarePosition(arrow.from, orientation);
    const to = squarePosition(arrow.to, orientation);
    if (!from || !to) continue;
    if (from.col === to.col && from.row === to.row) continue;
    out.push({
      x1: from.centerXPercent,
      y1: from.centerYPercent,
      x2: to.centerXPercent,
      y2: to.centerYPercent,
    });
  }
  return out;
}

/** Drop unknown squares and duplicates, preserving order. */
export function resolveSquares(
  squares: readonly string[],
  orientation: BoardOrientation = "w"
): { square: string; position: SquarePosition }[] {
  const seen = new Set<string>();
  const out: { square: string; position: SquarePosition }[] = [];
  for (const square of squares ?? []) {
    if (seen.has(square)) continue;
    const position = squarePosition(square, orientation);
    if (!position) continue;
    seen.add(square);
    out.push({ square, position });
  }
  return out;
}
