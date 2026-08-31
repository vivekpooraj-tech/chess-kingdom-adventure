import type { PieceSymbol } from "chess.js";
import { PieceSetOption } from "@/lib/types";

// chess.js piece codes -> asset file names (public/pieces/<folder>/{light,dark}/<name>.svg).
export const PIECE_FILE_NAME: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

// Full piece name -> chess.js code (content files use the long form).
export const PIECE_SYMBOL_BY_NAME: Record<string, PieceSymbol> = {
  pawn: "p",
  knight: "n",
  bishop: "b",
  rook: "r",
  queen: "q",
  king: "k",
};

// Independent of board skins — any piece set can pair with any board.
export const PIECE_SETS: PieceSetOption[] = [
  {
    id: "wood-classic",
    name: "Wood Carved",
    emoji: "🪵",
    folder: "wood-classic",
    intrinsicSize: { width: 200, height: 300 },
    // viewBox heights k243 q239 b229 r213 p192 n187 — a turned-wood set,
    // so the pieces sit close in height (the queen is nearly the king).
    opticalScale: { k: 0.92, q: 0.91, b: 0.87, r: 0.82, n: 0.75, p: 0.76 },
  },
  {
    id: "neostaunton-hand",
    name: "NeoStaunton",
    emoji: "♞",
    folder: "neostaunton-hand",
    intrinsicSize: { width: 257, height: 545 },
    // viewBox heights k552 q496 b462 n439 r383 p340 — a full Staunton
    // spread, so the descending scale is pronounced.
    opticalScale: { k: 0.92, q: 0.84, b: 0.79, n: 0.76, r: 0.70, p: 0.62 },
  },
  {
    id: "kingdom-characters",
    name: "Kingdom Characters",
    emoji: "🛡️",
    folder: "kingdom-characters",
    // Every file in this set shares the same "0 0 100 100" viewBox exactly —
    // stylised standing characters drawn to fill their frame. Keep them
    // chunky, but still king > … > pawn so the hierarchy reads.
    intrinsicSize: { width: 100, height: 100 },
    opticalScale: { k: 0.95, q: 0.93, b: 0.89, n: 0.91, r: 0.87, p: 0.82 },
  },
  {
    id: "royal-legends",
    name: "Royal Legends",
    emoji: "⚜️",
    folder: "royal-legends",
    // Raster artwork (an SVG wrapper embedding a cropped PNG per piece).
    // The source draws king/queen/rook/bishop to the same pixel height, so
    // without an explicit scale the rook rendered as tall as the king —
    // these values impose the Staunton hierarchy the raster doesn't carry.
    intrinsicSize: { width: 213, height: 420 },
    opticalScale: { k: 0.92, q: 0.85, b: 0.80, n: 0.77, r: 0.70, p: 0.62 },
  },
];

// NeoStaunton is the signature premium piece style (Phase 10B point 31) —
// explicit id rather than PIECE_SETS[0] so the picker's display order can
// change independently of which set new children start with.
export const DEFAULT_PIECE_SET_ID = "neostaunton-hand";

export function getPieceSet(id: string | null | undefined): PieceSetOption {
  return (
    PIECE_SETS.find((s) => s.id === id) ??
    PIECE_SETS.find((s) => s.id === DEFAULT_PIECE_SET_ID) ??
    PIECE_SETS[0]
  );
}
