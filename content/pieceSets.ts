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

/**
 * THE chess pieces. One standard, familiar Staunton-style set (the widely used
 * Cburnett set — see public/pieces/wikimedia-classic/ATTRIBUTION.md), identical
 * in every World. No character, cartoon or fantasy pieces.
 *
 * Any child whose saved piece_set_id is not in this list — including every set
 * that used to exist — falls back to DEFAULT_PIECE_SET_ID via getPieceSet().
 */
export const PIECE_SETS: PieceSetOption[] = [
  {
    id: "wikimedia-classic",
    name: "Standard",
    emoji: "♔",
    folder: "wikimedia-classic",
    // Cburnett Wikimedia Commons *t45 set. Source SVGs use a 45×45 canvas
    // but artwork only occupied ~65–70% of it; viewBoxes are cropped to path
    // bounds in public/pieces/wikimedia-classic/*.svg. King targets ~85%
    // of square height; other pieces keep Staunton hierarchy below that.
    intrinsicSize: { width: 45, height: 45 },
    opticalScale: { k: 0.85, q: 0.81, b: 0.81, n: 0.78, r: 0.76, p: 0.73 },
  },
];

export const DEFAULT_PIECE_SET_ID = "wikimedia-classic";

export function getPieceSet(id: string | null | undefined): PieceSetOption {
  return (
    PIECE_SETS.find((s) => s.id === id) ??
    PIECE_SETS.find((s) => s.id === DEFAULT_PIECE_SET_ID) ??
    PIECE_SETS[0]
  );
}
