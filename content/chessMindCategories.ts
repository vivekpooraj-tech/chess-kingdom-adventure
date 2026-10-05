export interface ChessMindCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Route under /chess-mind — null while the category isn't built yet (see README note below). */
  href: string | null;
}

/**
 * All 8 categories from the product spec, all now playable.
 * Calculation (content/chessMindCalculation.ts) uses curated, chess.js-
 * verified positions rather than live per-generation engine grading —
 * the same "verify once at authoring time" approach every other category
 * here already uses, not procedural generation.
 *
 * Tactical Thinking is an Academy course (/academy/tactical-thinking) rather
 * than a timed drill, because what it teaches is a search procedure — checks,
 * captures, threats — which needs explanation before practice. Reaction is the
 * timed format, served one position at a time from the puzzle library by
 * /api/chess-mind/reaction.
 */
export const CHESS_MIND_CATEGORIES: ChessMindCategory[] = [
  {
    id: "pattern",
    title: "Pattern Recognition",
    emoji: "🎯",
    description: "See tactical patterns faster.",
    href: "/chess-mind/pattern",
  },
  {
    id: "visualization",
    title: "Visualization",
    emoji: "👁️",
    description: "See the board without moving the pieces.",
    href: "/chess-mind/visualization",
  },
  {
    id: "calculation",
    title: "Calculation",
    emoji: "🧮",
    description: "Think several moves ahead.",
    href: "/chess-mind/calculation",
  },
  {
    id: "memory",
    title: "Memory",
    emoji: "🧩",
    description: "Remember positions and changes.",
    href: "/chess-mind/memory",
  },
  {
    id: "spatial",
    title: "Spatial Thinking",
    emoji: "🐴",
    description: "Understand board geometry.",
    href: "/chess-mind/spatial",
  },
  {
    id: "mathematics",
    title: "Chess Mathematics",
    emoji: "🔢",
    description: "Calculate material and exchanges.",
    href: "/chess-mind/mathematics",
  },
  {
    id: "tactical",
    title: "Tactical Thinking",
    emoji: "⚡",
    description: "Checks, captures, and threats — the building blocks of tactics.",
    href: "/academy/tactical-thinking",
  },
  {
    id: "reaction",
    title: "Reaction",
    emoji: "⏱️",
    description: "Recognize threats faster.",
    href: "/chess-mind/reaction",
  },
];

export function getChessMindCategory(id: string): ChessMindCategory | undefined {
  return CHESS_MIND_CATEGORIES.find((c) => c.id === id);
}
