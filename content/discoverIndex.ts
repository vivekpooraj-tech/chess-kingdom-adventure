/**
 * The Discover sections: one list, read by every world's presentation of /discover (components/discover/DiscoverBody), so the copy,
 * routes and order cannot drift apart between worlds. Only real, existing content gets a link; the rest are listed as coming soon
 * (Phase 10B point 19: "Only show content that actually exists").
 */
export interface DiscoverSection {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Absent for a section that is not built yet. */
  href?: string;
  soon?: boolean;
}

export const DISCOVER_SECTIONS: DiscoverSection[] = [
  {
    id: "history",
    title: "History of Chess",
    emoji: "🏛️",
    description: "From ancient India to the game on your board today.",
    href: "/academy/origins",
  },
  {
    id: "pieces",
    title: "Chess Pieces",
    emoji: "♞",
    description: "How each piece moves, and the story behind its name.",
    href: "/piece-library",
  },
  {
    id: "opening-stories",
    title: "Opening Stories",
    emoji: "📖",
    description: "Where the Italian Game, the Sicilian, and the rest got their names.",
    href: "/academy/openings",
  },
  {
    id: "famous-games",
    title: "Famous Games",
    emoji: "🎞️",
    description: "Legendary games from chess history.",
    soon: true,
  },
  {
    id: "stories",
    title: "Chess Stories",
    emoji: "📚",
    description: "Tales from the world of chess.",
    soon: true,
  },
];
