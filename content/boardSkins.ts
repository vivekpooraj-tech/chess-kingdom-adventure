import { BoardSkinOption } from "@/lib/types";

// Flat color-pair board skins. "Classic Forest" reproduces the board's
// original hardcoded colors (kingdom-leaf/30, kingdom-forest/70) exactly, so
// existing children (who all get this as their DB default) see no visual
// change.
export const BOARD_SKINS: BoardSkinOption[] = [
  {
    id: "walnut-ivory",
    name: "Walnut & Ivory",
    emoji: "👑",
    lightSquare: "#E8D7B5",
    darkSquare: "#6B4528",
    frameColor: "#3A2417",
    coordinateColor: "#F4E7C5",
  },
  {
    id: "classic-forest",
    name: "Classic Forest",
    emoji: "🌲",
    lightSquare: "rgba(74, 222, 128, 0.3)", // kingdom-leaf/30
    darkSquare: "rgba(22, 128, 60, 0.7)", // kingdom-forest/70
  },
  {
    id: "sunset-desert",
    name: "Sunset Desert",
    emoji: "🏜️",
    lightSquare: "rgba(255, 197, 61, 0.3)", // kingdom-gold/30
    darkSquare: "rgba(255, 159, 28, 0.75)", // kingdom-amber/75
  },
  {
    id: "ocean-ice",
    name: "Ocean Ice",
    emoji: "🧊",
    lightSquare: "rgba(56, 189, 248, 0.3)", // kingdom-sky/30
    darkSquare: "rgba(36, 30, 78, 0.75)", // kingdom-night/75
  },
  {
    id: "candy-castle",
    name: "Candy Castle",
    emoji: "🍬",
    lightSquare: "rgba(255, 107, 107, 0.3)", // kingdom-coral/30
    darkSquare: "rgba(109, 90, 230, 0.65)", // kingdom-royal/65
  },
  {
    id: "wood-classic",
    name: "Wood Classic",
    emoji: "♟️",
    // Approximate flat colors for the picker's checkerboard swatch — the
    // actual board uses the textured image below, not these.
    lightSquare: "#EAD6A8",
    darkSquare: "#4A2E17",
    boardImageUrl: "/boards/wood-classic.svg",
  },
];

// The premium board is the new preferred default for anyone choosing for
// the first time (onboarding, or a fallback when no preference is set).
// Existing children keep whatever they already saved — this only changes
// what NEW selections start from, matching the same DEFAULT_PIECE_SET_ID
// pattern in content/pieceSets.ts.
export const DEFAULT_BOARD_SKIN_ID = "walnut-ivory";

export function getBoardSkin(id: string | null | undefined): BoardSkinOption {
  return (
    BOARD_SKINS.find((s) => s.id === id) ??
    BOARD_SKINS.find((s) => s.id === DEFAULT_BOARD_SKIN_ID) ??
    BOARD_SKINS[0]
  );
}
