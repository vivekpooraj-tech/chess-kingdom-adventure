export type DiscoverSection =
  | { id: string; title: string; emoji: string; description: string; href: string }
  | { id: string; title: string; emoji: string; description: string; soon: true };

// The single source of truth for Discover's content and destinations,
// shared by all three mode presentations (components/discover/*) so a
// route or "soon" status is only ever defined once, in one place. Only
// real, existing content gets a link — no fake sections (Phase 10B point
// 19: "Only show content that actually exists").
export const SECTIONS: DiscoverSection[] = [
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
