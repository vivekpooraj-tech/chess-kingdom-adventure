import { PieceSetOption } from "@/lib/types";

// Independent of board skins — any piece set can pair with any board.
export const PIECE_SETS: PieceSetOption[] = [
  {
    id: "classic",
    name: "Classic",
    emoji: "♟️",
    // No folder: uses the original flat-silhouette set directly at
    // public/pieces/{light,dark}/*.svg.
    intrinsicSize: { width: 100, height: 100 },
  },
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
];

export const DEFAULT_PIECE_SET_ID = PIECE_SETS[0].id;

export function getPieceSet(id: string | null | undefined): PieceSetOption {
  return PIECE_SETS.find((s) => s.id === id) ?? PIECE_SETS[0];
}
