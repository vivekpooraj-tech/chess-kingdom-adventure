/**
 * The Academy sections listed on /academy: one list, read by every world's presentation of the page
 * (components/academy), so the copy, routes and order cannot drift apart between worlds.
 *
 * `courseId` marks the sections that have per-lesson completion rows (lib/learner/learningPath.ts); only those can honestly
 * show a "n of m" count. `soon` sections are listed but not linked.
 */
export interface AcademyCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  href?: string;
  courseId?: string;
  soon?: boolean;
}

export const ACADEMY_CATEGORIES: AcademyCategory[] = [
  {
    id: "journey",
    title: "Kingdom Story Map",
    emoji: "🗺️",
    description: "Revisit the story path you played through every Kingdom zone.",
    href: "/home/journey",
  },
  {
    id: "fundamentals",
    title: "Chess Fundamentals",
    emoji: "📐",
    description: "The board, the pieces, and the rules — from scratch.",
    href: "/academy/fundamentals",
  },
  {
    id: "origins",
    title: "Chess Origins",
    emoji: "🏛️",
    description: "How a 1,500-year-old game reached your board today.",
    href: "/academy/origins",
  },
  {
    id: "tactics",
    title: "Tactics",
    emoji: "⚔️",
    description: "Forks, pins, skewers, and the patterns that win material.",
    href: "/academy/tactics",
  },
  {
    id: "strategy",
    title: "Strategy",
    emoji: "🧭",
    description: "Outposts, pawn breaks, king safety, and how to form a plan.",
    href: "/academy/strategy",
    courseId: "strategy",
  },
  {
    id: "endgames",
    title: "Endgames",
    emoji: "🏰",
    description: "King activity, passed pawns, rook endings, and converting a win.",
    href: "/academy/endgames",
    courseId: "endgames",
  },
  {
    id: "openings",
    title: "Chess Openings",
    emoji: "♞",
    description: "28 named openings, principles, and how to choose one.",
    href: "/academy/openings",
  },
];
