import { BoardSkinOption } from "@/lib/types";
import type { WorldId } from "@/lib/world/worlds";

/**
 * The board library. Standard Green is THE default and the universal fallback: a green and off-white
 * board in the conventional online-chess style. The other boards are curated alternatives a child or
 * player can choose in Customize. Worlds (Enchanted Kingdom, Master Training Atelier, Classic Pro)
 * change the screen AROUND the board, never the board itself, and never pick a board for you.
 *
 * Most boards are a pair of flat square colours, so there is no asset that can go missing. Two boards are
 * restored from before the standardisation (commit b42037c) with their original definitions: Walnut & Ivory
 * adds a frame and label colour, and Wood Classic is image-backed (public/boards/wood-classic.svg, restored
 * byte-for-byte from that commit). Sunset Desert, Ocean Ice and Walnut Classic were deliberately dropped from
 * the library: a saved id for any of them is treated like any retired id and shows Standard Green.
 *
 * Any child whose saved board_skin_id is not in this list — including every skin that used to exist —
 * falls back to DEFAULT_BOARD_SKIN_ID via getBoardSkin(), so no stored value can ever resurrect an
 * old look.
 */
export const BOARD_SKINS: BoardSkinOption[] = [
  {
    id: "standard-green",
    name: "Standard Green",
    emoji: "♟️",
    description: "The familiar green and cream board.",
    // Medium green dark squares, warm off-white light squares.
    lightSquare: "#EEEED2",
    darkSquare: "#769656",
  },
  {
    id: "tournament-green",
    name: "Tournament Green",
    emoji: "♟️",
    description: "Deeper green, sharper contrast.",
    // A deeper forest green against a cooler buff: the roll-out tournament board look.
    lightSquare: "#F3F0DA",
    darkSquare: "#4F7A3F",
  },
  {
    id: "slate",
    name: "Slate",
    emoji: "♟️",
    description: "Charcoal and stone, no colour.",
    // Neutral greys on purpose (saturation < 0.1): a modern board with no blue cast.
    lightSquare: "#D2CFC9",
    darkSquare: "#5C5F63",
    worlds: ["atelier", "classic"],
  },

  // ── Restored: boards that existed before the standardisation (commit b42037c). Original ids,
  //    names and definitions. Selectable; neither is the default.
  {
    id: "walnut-ivory",
    name: "Walnut & Ivory",
    emoji: "👑",
    description: "Dark walnut and ivory, with a framed edge.",
    lightSquare: "#E8D7B5",
    darkSquare: "#6B4528",
    frameColor: "#3A2417",
    coordinateColor: "#F4E7C5",
  },
  {
    id: "wood-classic",
    name: "Wood Classic",
    emoji: "♟️",
    description: "A textured wooden board.",
    // Approximate flat colors for swatches — the actual board uses the textured image below, not these.
    lightSquare: "#EAD6A8",
    darkSquare: "#4A2E17",
    boardImageUrl: "/boards/wood-classic.svg",
  },
];

export const DEFAULT_BOARD_SKIN_ID = "standard-green";

/**
 * The board id that is actually in effect for a saved value: the saved id when it is still a
 * supported board, otherwise the default. UI that shows which board is "selected" must compare
 * against THIS, not the raw stored id, so a retired/unknown/missing saved id still shows the
 * Standard board as selected — exactly what the renderer (getBoardSkin) draws. Pure: it never
 * writes the stored preference.
 */
export function effectiveBoardSkinId(id: string | null | undefined): string {
  return getBoardSkin(id).id;
}

export function getBoardSkin(id: string | null | undefined): BoardSkinOption {
  return (
    BOARD_SKINS.find((s) => s.id === id) ??
    BOARD_SKINS.find((s) => s.id === DEFAULT_BOARD_SKIN_ID) ??
    BOARD_SKINS[0]
  );
}

/**
 * Boards offered for a world. The default board is ALWAYS included, whatever a skin's `worlds` says,
 * so no world can ever end up without the standard board. With no world, every board is returned.
 * (Metadata for world-aware filtering; the Customize library currently shows every board in every world.)
 */
export function availableBoardSkins(world?: WorldId | null): BoardSkinOption[] {
  return BOARD_SKINS.filter(
    (s) => s.id === DEFAULT_BOARD_SKIN_ID || !world || !s.worlds || s.worlds.includes(world)
  );
}
