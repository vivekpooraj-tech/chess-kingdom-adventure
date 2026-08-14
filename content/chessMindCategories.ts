export interface ChessMindCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Route under /chess-mind — null while the category isn't built yet (see README note below). */
  href: string | null;
}

/**
 * All 8 categories from the product spec. Six are real and playable
 * (pattern, visualization, calculation, memory, spatial, mathematics).
 * Calculation (content/chessMindCalculation.ts) uses curated, chess.js-
 * verified positions rather than live per-generation engine grading —
 * the same "verify once at authoring time" approach every other category
 * here already uses, not procedural generation. Tactical and reaction are
 * still listed — establishing the real shape of the feature — but not yet
 * built: both need the same attack-detection primitives Pattern
 * Recognition uses, applied to a faster timed format. Marked "Soon" rather
 * than stubbed, same convention used everywhere else in this app.
 */
export const CHESS_MIND_CATEGORIES: ChessMindCategory[] = [
  {
    id: "pattern",
    title: "Pattern Recognition",
    emoji: "🎯",
    description: "Spot forks, pins, checks, and hanging pieces on a real board.",
    href: "/chess-mind/pattern",
  },
  {
    id: "visualization",
    title: "Visualization",
    emoji: "👁️",
    description: "See a position, then picture it in your mind.",
    href: "/chess-mind/visualization",
  },
  {
    id: "calculation",
    title: "Calculation",
    emoji: "🧮",
    description: "Find the best move, then look further ahead.",
    href: "/chess-mind/calculation",
  },
  {
    id: "memory",
    title: "Memory",
    emoji: "🧩",
    description: "Remember exactly where every piece was standing.",
    href: "/chess-mind/memory",
  },
  {
    id: "spatial",
    title: "Spatial Thinking",
    emoji: "🐴",
    description: "Knight paths, minimum moves, board geometry.",
    href: "/chess-mind/spatial",
  },
  {
    id: "mathematics",
    title: "Chess Mathematics",
    emoji: "🔢",
    description: "Legal moves, material, and counting the board.",
    href: "/chess-mind/mathematics",
  },
  {
    id: "tactical",
    title: "Tactical Thinking",
    emoji: "⚡",
    description: "Checks, captures, and threats — the building blocks of tactics.",
    href: null,
  },
  {
    id: "reaction",
    title: "Reaction",
    emoji: "⏱️",
    description: "Quick-fire pattern spotting against the clock.",
    href: null,
  },
];

export function getChessMindCategory(id: string): ChessMindCategory | undefined {
  return CHESS_MIND_CATEGORIES.find((c) => c.id === id);
}
