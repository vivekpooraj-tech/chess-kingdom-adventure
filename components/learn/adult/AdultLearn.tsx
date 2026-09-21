import Link from "next/link";
import { ListItemRow, PrimaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { NextLessonCard } from "@/components/learner/NextLessonCard";
import { CourseStatusChip } from "@/components/learner/CourseStatusChip";
import { LearningPathPanel } from "@/components/learner/LearningPathPanel";
import { COURSE_NAME, COURSE_TITLE, COURSE_TAGLINE } from "@/lib/school/chessSchool";
import type { LearnChessEntry } from "@/components/learn/types";

/**
 * Adult ("Master Training Atelier") Learn composition — "Learn". Same real
 * content/client islands as every other mode; the only structural
 * difference from Classic/Pro is LearningPathPanel rendering ABOVE
 * NextLessonCard (a presentation-order change only — neither component's
 * internal markup or data fetching is touched here).
 */
export function AdultLearn({
  learnChess,
  courseLessonIds,
}: {
  learnChess: LearnChessEntry[];
  courseLessonIds: Record<string, string[]>;
}) {
  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className={TEXT.display}>Learn</h1>
        <p className={`${TEXT.body} mt-2`}>
          Structured lessons, and steady practice for how you think about the game.
        </p>
      </div>

      <LearningPathPanel lessonIdsByCourse={courseLessonIds} />
      <NextLessonCard />

      <Link href="/chess-school" className="w-full block active:scale-[0.98] transition-transform duration-100">
        <PrimaryCard className="learn-school-card flex items-center gap-4 p-5">
          <span className="text-3xl flex-none">🗺️</span>
          <div className="flex-1">
            <p className={`${TEXT.meta} learn-accent-text`}>🏫 {COURSE_NAME}</p>
            <p className="font-classic-display text-lg text-premium-ivory mt-1">{COURSE_TITLE}</p>
            <p className={`${TEXT.caption} normal-case mt-1`}>{COURSE_TAGLINE}</p>
          </div>
        </PrimaryCard>
      </Link>

      <section className="w-full flex flex-col gap-3">
        <p className="learn-section-eyebrow font-classic-body text-xs uppercase tracking-wide">Learn Chess</p>
        <div className="flex flex-col gap-2">
          {learnChess.map((item) => (
            <ListItemRow key={item.id} href={item.href} className="learn-row min-h-[64px]">
              <span className="text-2xl flex-none">{item.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">{item.title}</p>
                <p className={`${TEXT.caption} normal-case`}>{item.description}</p>
              </div>
              {item.courseId && (
                <CourseStatusChip courseId={item.courseId} lessonIds={courseLessonIds[item.courseId] ?? []} />
              )}
              <span className="learn-cta text-lg flex-none">→</span>
            </ListItemRow>
          ))}
        </div>
      </section>

      <section className="w-full flex flex-col gap-3">
        <p className="learn-section-eyebrow font-classic-body text-xs uppercase tracking-wide">
          Train Your Chess Mind
        </p>
        <div className="flex flex-col gap-2">
          {CHESS_MIND_CATEGORIES.map((cat) =>
            !cat.href ? (
              <ListItemRow key={cat.id} className="learn-row min-h-[64px] opacity-50">
                <span className="text-2xl flex-none">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                  <p className={`${TEXT.caption} normal-case`}>{cat.description}</p>
                </div>
                <span className="font-classic-body text-[11px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                  SOON
                </span>
              </ListItemRow>
            ) : (
              <ListItemRow key={cat.id} href={cat.href} className="learn-row min-h-[64px]">
                <span className="text-2xl flex-none">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                  <p className={`${TEXT.caption} normal-case`}>{cat.description}</p>
                </div>
                {cat.id === "tactical" && (
                  <CourseStatusChip
                    courseId="tactical-thinking"
                    lessonIds={courseLessonIds["tactical-thinking"] ?? []}
                  />
                )}
                <span className="learn-cta text-lg flex-none">→</span>
              </ListItemRow>
            )
          )}
        </div>
      </section>
    </div>
  );
}
