import { ListItemRow } from "@/components/ui/Card";
import { PrimaryCard } from "@/components/ui/Card";
import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { NextLessonCard } from "@/components/learner/NextLessonCard";
import { CourseStatusChip } from "@/components/learner/CourseStatusChip";
import { LearningPathPanel } from "@/components/learner/LearningPathPanel";
import { COURSE_NAME, COURSE_TITLE, COURSE_TAGLINE } from "@/lib/school/chessSchool";
import type { LearnChessEntry } from "@/components/learn/types";

/**
 * Classic/Pro Learn composition — "Learn". Compact, high-density rows;
 * NextLessonCard first, LearningPathPanel immediately below it (both
 * unmodified, real client islands — only their ORDER differs by mode, not
 * their internal markup, which this file never touches). All 6 real
 * LEARN_CHESS entries and all 8 real CHESS_MIND_CATEGORIES render — no
 * "+N more", no invented "soon" states.
 */
export function ClassicLearn({
  learnChess,
  courseLessonIds,
}: {
  learnChess: LearnChessEntry[];
  courseLessonIds: Record<string, string[]>;
}) {
  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <h1 className={TEXT.display}>Learn</h1>
        <p className={`${TEXT.body} mt-2`}>Lessons on the game, and training for how you think about it.</p>
      </div>

      <NextLessonCard />
      <LearningPathPanel lessonIdsByCourse={courseLessonIds} />

      <Link href="/chess-school" className="w-full block active:scale-[0.98] transition-transform duration-100">
        <PrimaryCard className="learn-school-card flex items-center gap-3 p-4">
          <span className="text-2xl flex-none">🗺️</span>
          <div className="flex-1">
            <p className={`${TEXT.meta} learn-accent-text`}>🏫 {COURSE_NAME}</p>
            <p className="font-classic-display text-base text-premium-ivory mt-0.5">{COURSE_TITLE}</p>
            <p className={`${TEXT.caption} normal-case mt-0.5`}>{COURSE_TAGLINE}</p>
          </div>
        </PrimaryCard>
      </Link>

      <div
        className="auto-grid items-start"
        style={{ "--grid-min": "20rem", "--grid-gap": "1.25rem" } as React.CSSProperties}
      >
        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Learn Chess</p>
          <div className="flex flex-col gap-1.5">
            {learnChess.map((item) => (
              <ListItemRow key={item.id} href={item.href} className="learn-row min-h-[56px]">
                <span className="text-2xl flex-none">{item.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-sm text-premium-ivory">{item.title}</p>
                  <p className={TEXT.caption}>{item.description}</p>
                </div>
                {item.courseId && (
                  <CourseStatusChip courseId={item.courseId} lessonIds={courseLessonIds[item.courseId] ?? []} />
                )}
                <span className="learn-cta text-lg flex-none">→</span>
              </ListItemRow>
            ))}
          </div>
        </section>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Train Your Chess Mind</p>
          <div className="flex flex-col gap-1.5">
            {CHESS_MIND_CATEGORIES.map((cat) =>
              !cat.href ? (
                <ListItemRow key={cat.id} className="learn-row min-h-[56px] opacity-50">
                  <span className="text-2xl flex-none">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-sm text-premium-ivory">{cat.title}</p>
                    <p className={TEXT.caption}>{cat.description}</p>
                  </div>
                  <span className="font-classic-body text-[11px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                    SOON
                  </span>
                </ListItemRow>
              ) : (
                <ListItemRow key={cat.id} href={cat.href} className="learn-row min-h-[56px]">
                  <span className="text-2xl flex-none">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-sm text-premium-ivory">{cat.title}</p>
                    <p className={TEXT.caption}>{cat.description}</p>
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
    </div>
  );
}
