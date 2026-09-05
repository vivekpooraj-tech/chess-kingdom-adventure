import Link from "next/link";
import { PrimaryCard, ListItemRow } from "@/components/ui/Card";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";
import { NextLessonCard } from "@/components/learner/NextLessonCard";
import { CourseStatusChip } from "@/components/learner/CourseStatusChip";
import { getCourse } from "@/lib/academy/courses.server";

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
const LEARN_CHESS = [
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
  const trainCategories = CHESS_MIND_CATEGORIES;

  // Lesson IDS only. getCourse is server-only and this page is a server
  // component, so the course CONTENT never leaves the server — the client
  // island below receives a handful of short strings.
  const courseLessonIds: Record<string, string[]> = {};
  for (const id of ["strategy", "endgames", "tactical-thinking"]) {
    const course = getCourse(id);
    if (course) courseLessonIds[id] = course.lessons.map((l) => l.id);
  }

  return (
    <TabPageShell maxWidth="wide">
      <div>
        <h1 className={TEXT.display}>Learn</h1>
        <p className={`${TEXT.body} mt-2`}>
          Structured lessons on the game, and training for how you think about it.
        </p>
      </div>

      {/* Client island: the page stays static and paints unchanged, and this
          fills in only when the child has a real recurring weakness with a
          lesson that teaches it. See NextLessonCard. */}
      <NextLessonCard />

      <Link href="/kingdom-map#journey" className="w-full block active:scale-[0.98] transition-transform duration-100">
        <PrimaryCard className="flex items-center gap-4">
          <span className="text-3xl flex-none">🗺️</span>
          <div className="flex-1">
            <p className={`${TEXT.meta} text-premium-gold`}>Kingdom Journey</p>
            <p className="font-classic-display text-lg text-premium-ivory mt-1">
              Story-based lessons and guided chess basics
            </p>
          </div>
        </PrimaryCard>
      </Link>

      <div
        className="auto-grid items-start"
        style={{ "--grid-min": "20rem", "--grid-gap": "clamp(1.25rem, 3vw, 2rem)" } as React.CSSProperties}
      >
        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Learn Chess</p>
          <div className="flex flex-col gap-1.5">
            {LEARN_CHESS.map((item) =>
              "soon" in item ? (
                <ListItemRow key={item.id} className="opacity-50 min-h-[64px]">
                  <span className="text-3xl flex-none">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{item.title}</p>
                    <p className={TEXT.caption}>{item.description}</p>
                  </div>
                  <span className="font-classic-body text-[11px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                    SOON
                  </span>
                </ListItemRow>
              ) : (
                <ListItemRow key={item.id} href={item.href} className="min-h-[64px]">
                  <span className="text-3xl flex-none">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{item.title}</p>
                    <p className={TEXT.caption}>{item.description}</p>
                  </div>
                  {"courseId" in item && item.courseId ? (
                    <CourseStatusChip
                      courseId={item.courseId}
                      lessonIds={courseLessonIds[item.courseId] ?? []}
                    />
                  ) : null}
                  <span className="text-premium-gold text-lg flex-none">→</span>
                </ListItemRow>
              )
            )}
          </div>
        </section>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Train Your Chess Mind</p>
          <div className="flex flex-col gap-1.5">
            {trainCategories.map((cat) =>
              !cat.href ? (
                <ListItemRow key={cat.id} className="opacity-50 min-h-[64px]">
                  <span className="text-3xl flex-none">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                    <p className={TEXT.caption}>{cat.description}</p>
                  </div>
                  <span className="font-classic-body text-[11px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                    SOON
                  </span>
                </ListItemRow>
              ) : (
                <ListItemRow key={cat.id} href={cat.href} className="min-h-[64px]">
                  <span className="text-3xl flex-none">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                    <p className={TEXT.caption}>{cat.description}</p>
                  </div>
                  {cat.id === "tactical" ? (
                    <CourseStatusChip
                      courseId="tactical-thinking"
                      lessonIds={courseLessonIds["tactical-thinking"] ?? []}
                    />
                  ) : null}
                  <span className="text-premium-gold text-lg flex-none">→</span>
                </ListItemRow>
              )
            )}
          </div>
        </section>
      </div>
    </TabPageShell>
  );
}
