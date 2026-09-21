import { TabPageShell } from "@/components/nav/TabPageShell";
import { getCourse } from "@/lib/academy/courses.server";
import { LearnModePresentation } from "@/components/learn/LearnModePresentation";
import { ClassicLearn } from "@/components/learn/classic/ClassicLearn";
import { AdultLearn } from "@/components/learn/adult/AdultLearn";
import { KidsLearn } from "@/components/learn/kids/KidsLearn";
import type { LearnChessEntry } from "@/components/learn/types";

/**
 * Learn (Phase 19) — a single combined index over the existing Academy and
 * Chess Mind sections, which used to be two separate primary nav tabs.
 * Neither underlying section moved or lost content; this page just links
 * straight into their real sub-routes instead of routing through the old
 * /academy and /chess-mind index pages (both of which are still fully
 * intact and still reachable directly, and are still the "back" target for
 * their own children — see e.g. app/academy/fundamentals/page.tsx).
 *
 * Deliberately a static server page — no auth check, no server-side Supabase
 * calls. The "Continue Your Journey" card below links to the Kingdom Journey
 * by anchor rather than re-fetching per-child progress here (that data already
 * lives on Kingdom Map); a second personalized fetch on every visit to this
 * page would be exactly the kind of redundant request the tab-switching
 * performance pass removed elsewhere.
 *
 * That constraint is why the one personalized element, <NextLessonCard/>, is a
 * client island: this shell still renders and paints exactly as before, and
 * the recommendation fills in afterwards without ever blocking it.
 */
const LEARN_CHESS: LearnChessEntry[] = [
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

export default function LearnPage() {
  // Lesson IDS only. getCourse is server-only and this page is a server
  // component, so the course CONTENT never leaves the server — the client
  // island below receives a handful of short strings.
  const courseLessonIds: Record<string, string[]> = {};
  for (const id of ["strategy", "endgames", "tactical-thinking"]) {
    const course = getCourse(id);
    if (course) courseLessonIds[id] = course.lessons.map((l) => l.id);
  }

  return (
    <TabPageShell maxWidth="wide" contentClassName="learn-mode-scope">
      <LearnModePresentation
        classicPro={<ClassicLearn learnChess={LEARN_CHESS} courseLessonIds={courseLessonIds} />}
        adult={<AdultLearn learnChess={LEARN_CHESS} courseLessonIds={courseLessonIds} />}
        kids={<KidsLearn learnChess={LEARN_CHESS} courseLessonIds={courseLessonIds} />}
      />
    </TabPageShell>
  );
}
