import { BoardSkinOption } from "@/lib/types";

/**
 * THE chessboard. Chess Mind has one standard, familiar board: a green and
 * off-white board in the conventional online-chess style, identical in every
 * World (Enchanted Kingdom, Master Training Atelier, Classic Pro). Worlds change
 * the screen AROUND the board, never the board itself.
 *
 * Any child whose saved board_skin_id is not in this list — including every
 * skin that used to exist — falls back to DEFAULT_BOARD_SKIN_ID via
 * getBoardSkin(), so no stored value can ever resurrect an old look.
 */
export const BOARD_SKINS: BoardSkinOption[] = [
  {
    id: "standard-green",
    name: "Standard",
    emoji: "♟️",
    // Familiar green board: medium green dark squares, warm off-white light
    // squares. Flat colours only — no textures, gradients or frame art.
    lightSquare: "#EEEED2",
    darkSquare: "#769656",
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
