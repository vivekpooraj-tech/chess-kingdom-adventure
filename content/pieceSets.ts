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
    // On-board height as a fraction of one square — tuned for ~88–94% king,
    // ~86–92% minors, ~80–88% pawn after each SVG's viewBox padding.
    opticalScale: { k: 0.94, q: 0.92, b: 0.90, r: 0.89, n: 0.88, p: 0.86 },
  },
  {
    id: "neostaunton-hand",
    name: "NeoStaunton",
    emoji: "♞",
    folder: "neostaunton-hand",
    intrinsicSize: { width: 257, height: 545 },
    // viewBox heights k552 q496 b462 n439 r383 p340 — Staunton hierarchy with
    // extra headroom on tall pieces to offset viewBox padding above crowns.
    opticalScale: { k: 1.0, q: 0.95, b: 0.91, n: 0.90, r: 0.89, p: 0.86 },
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
    opticalScale: { k: 0.94, q: 0.92, b: 0.90, r: 0.89, n: 0.89, p: 0.86 },
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
    opticalScale: { k: 1.0, q: 0.94, b: 0.90, n: 0.89, r: 0.88, p: 0.84 },
  },
  {
    id: "wikimedia-classic",
    name: "Classic",
    emoji: "♔",
    folder: "wikimedia-classic",
    // Cburnett Wikimedia Commons *t45 set. Source SVGs use a 45×45 canvas
    // but artwork only occupied ~65–70% of it; viewBoxes are cropped to path
    // bounds in public/pieces/wikimedia-classic/*.svg. Scales match NeoStaunton.
    intrinsicSize: { width: 45, height: 45 },
    opticalScale: { k: 1.0, q: 0.95, b: 0.91, n: 0.90, r: 0.89, p: 0.86 },
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
