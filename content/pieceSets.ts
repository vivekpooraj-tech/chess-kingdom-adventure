import { PieceSetOption } from "@/lib/types";

// Independent of board skins — any piece set can pair with any board.
export const PIECE_SETS: PieceSetOption[] = [
  {
    id: "wood-classic",
    name: "Wood Carved",
    emoji: "🪵",
    folder: "wood-classic",
    intrinsicSize: { width: 200, height: 300 },
  },
  {
    id: "aurelia",
    name: "Aurelia",
    emoji: "👑",
    folder: "aurelia",
    intrinsicSize: { width: 1024, height: 1024 },
  },
  {
    id: "neostaunton-hand",
    name: "NeoStaunton",
    emoji: "♞",
    folder: "neostaunton-hand",
    intrinsicSize: { width: 257, height: 545 },
  },
  {
    id: "kingdom-characters",
    name: "Kingdom Characters",
    emoji: "🛡️",
    folder: "kingdom-characters",
    // Every file in this set shares the same "0 0 100 100" viewBox exactly.
    intrinsicSize: { width: 100, height: 100 },
  },
  {
    id: "royal-legends",
    name: "Royal Legends",
    emoji: "⚜️",
    folder: "royal-legends",
    // Raster artwork (an SVG wrapper embedding a cropped PNG per piece,
    // not vector paths) — sliced from a single supplied illustration,
    // background-cleaned, and tightly cropped per piece the same way the
    // other sets' viewBoxes were in Phase 13. Heavier files than the
    // vector sets (~100-200KB each vs a few KB) since there's no vector
    // source to draw from.
    intrinsicSize: { width: 231, height: 449 },
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
