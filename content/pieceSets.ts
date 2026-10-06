import type { PieceSymbol } from "chess.js";
import { PieceSetOption } from "@/lib/types";
import type { WorldId } from "@/lib/world/worlds";

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
 * The piece library. Classic is THE default and the universal fallback: the widely used Staunton-style
 * Cburnett set (see public/pieces/wikimedia-classic/ATTRIBUTION.md). Every other set here is real artwork
 * that exists in public/pieces/<folder>/{light,dark}/{king,queen,rook,bishop,knight,pawn}.svg; a set is
 * only registered once its assets are in the repository. Atelier (aurelia) is a current set; Wood Carved,
 * NeoStaunton, Kingdom Characters and Royal Legends are RESTORED from before the standardisation (commit
 * b42037c) with their original ids, names and optical scales, and their artwork restored byte-for-byte.
 *
 * Any child whose saved piece_set_id is not in this list — including every set that used to exist —
 * falls back to DEFAULT_PIECE_SET_ID via getPieceSet().
 */
export const PIECE_SETS: PieceSetOption[] = [
  {
    id: "wikimedia-classic",
    name: "Classic",
    emoji: "♔",
    description: "The familiar Staunton set.",
    folder: "wikimedia-classic",
    // Cburnett Wikimedia Commons *t45 set. Source SVGs use a 45×45 canvas
    // but artwork only occupied ~65–70% of it; viewBoxes are cropped to path
    // bounds in public/pieces/wikimedia-classic/*.svg. King targets ~85%
    // of square height; other pieces keep Staunton hierarchy below that.
    intrinsicSize: { width: 45, height: 45 },
    opticalScale: { k: 0.85, q: 0.81, b: 0.81, n: 0.78, r: 0.76, p: 0.73 },
  },
  {
    id: "aurelia",
    name: "Atelier",
    emoji: "♕",
    description: "Tall, refined, softly shaded.",
    folder: "aurelia",
    // Cropped viewBoxes (public/pieces/aurelia/*/*.svg) share one 1024-unit canvas, so the real height
    // relationships are king 809, queen 748, knight 715, rook 704, bishop 704, pawn 578. The king targets
    // the same ~85% of a square as Classic and every other piece keeps its true proportion to it.
    // Every piece is taller than wide, so the square slot in PieceImage is always height-limited.
    intrinsicSize: { width: 438, height: 809 },
    opticalScale: { k: 0.85, q: 0.785, b: 0.74, n: 0.75, r: 0.74, p: 0.607 },
    worlds: ["atelier"],
  },

  // ── Restored: the sets that existed before the standardisation (commit b42037c). Original ids,
  //    names, folders and optical scales. Selectable; none of them is the default.
  {
    id: "neostaunton-hand",
    name: "NeoStaunton",
    emoji: "♞",
    description: "Slim, hand-drawn Staunton.",
    folder: "neostaunton-hand",
    intrinsicSize: { width: 257, height: 545 },
    // viewBox heights k552 q496 b462 n439 r383 p340 — Staunton hierarchy with
    // extra headroom on tall pieces to offset viewBox padding above crowns.
    opticalScale: { k: 1.0, q: 0.95, b: 0.91, n: 0.90, r: 0.89, p: 0.86 },
  },
  {
    id: "wood-classic",
    name: "Wood Carved",
    emoji: "🪵",
    description: "Carved wooden pieces.",
    folder: "wood-classic",
    intrinsicSize: { width: 200, height: 300 },
    // On-board height as a fraction of one square — tuned for ~88–94% king,
    // ~86–92% minors, ~80–88% pawn after each SVG's viewBox padding.
    opticalScale: { k: 0.94, q: 0.92, b: 0.90, r: 0.89, n: 0.88, p: 0.86 },
  },
  {
    id: "royal-legends",
    name: "Royal Legends",
    emoji: "⚜️",
    description: "Illustrated, richly detailed.",
    folder: "royal-legends",
    // Raster artwork (an SVG wrapper embedding a cropped PNG per piece).
    // The source draws king/queen/rook/bishop to the same pixel height, so
    // without an explicit scale the rook rendered as tall as the king —
    // these values impose the Staunton hierarchy the raster doesn't carry.
    intrinsicSize: { width: 213, height: 420 },
    opticalScale: { k: 1.0, q: 0.94, b: 0.90, n: 0.89, r: 0.88, p: 0.84 },
  },
  {
    id: "kingdom-characters",
    name: "Kingdom Characters",
    emoji: "🛡️",
    description: "Standing characters, not classic pieces.",
    folder: "kingdom-characters",
    // Every file in this set shares the same "0 0 100 100" viewBox exactly —
    // stylised standing characters drawn to fill their frame. Keep them
    // chunky, but still king > … > pawn so the hierarchy reads.
    intrinsicSize: { width: 100, height: 100 },
    opticalScale: { k: 0.94, q: 0.92, b: 0.90, r: 0.89, n: 0.89, p: 0.86 },
    worlds: ["enchanted"],
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

/**
 * The piece-set id actually in effect for a saved value: the saved id when it is still a registered set,
 * otherwise the default. UI that shows which set is "selected" must compare against THIS, not the raw
 * stored id, so a retired/unknown/missing saved id (including the legacy database default) still shows
 * Classic as selected — exactly what the renderer (getPieceSet) draws. Pure: it never writes the preference.
 */
export function effectivePieceSetId(id: string | null | undefined): string {
  return getPieceSet(id).id;
}

/**
 * Piece sets offered for a world. The default set is ALWAYS included, whatever a set's `worlds` says.
 * With no world, every set is returned. (Metadata for world-aware filtering; the Customize library
 * currently shows every set in every world.)
 */
export function availablePieceSets(world?: WorldId | null): PieceSetOption[] {
  return PIECE_SETS.filter(
    (s) => s.id === DEFAULT_PIECE_SET_ID || !world || !s.worlds || s.worlds.includes(world)
  );
}
