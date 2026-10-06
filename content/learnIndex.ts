/**
 * The Academy sections listed on the Learn page. One list, read by every presentation of Learn
 * (the shared page and the Atelier Training Academy), so the copy and routes cannot drift apart.
 *
 * `courseId` marks the sections that have per-lesson completion rows (see lib/learner/learningPath.ts).
 */
export interface LearnChessItem {
  id: string;
  title: string;
  emoji: string;
  description: string;
  href: string;
  courseId?: string;
  soon?: boolean;
}

export const LEARN_CHESS: LearnChessItem[] = [
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
    id: "openings",
    title: "Chess Openings",
    emoji: "♞",
    description: "28 named openings, principles, and how to choose one.",
    href: "/academy/openings",
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
];
