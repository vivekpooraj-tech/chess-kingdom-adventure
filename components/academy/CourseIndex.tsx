import Link from "next/link";
import { PrimaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import type { CourseLesson, CourseSummary } from "@/lib/academy/courseTypes";

/**
 * Course landing page: the lesson list with real progress.
 *
 * Server component — it receives only lesson headers (id/order/title/concept),
 * never the lesson bodies, so a course index costs the client nothing beyond
 * the markup it renders.
 *
 * Progress shown here is derived entirely from completed content ids. There are
 * no invented percentages: a lesson is either done or it is not, and the course
 * header counts those. `completedIds` arriving empty (signed out, or a failed
 * read) degrades to "nothing completed yet", which is honest rather than wrong.
 */

export type LessonHeader = Pick<CourseLesson, "id" | "order" | "title" | "concept">;

export function CourseIndex({
  summary,
  lessons,
  completedIds,
  basePath,
}: {
  summary: CourseSummary;
  lessons: LessonHeader[];
  completedIds: Set<string>;
  basePath: string;
}) {
  const doneCount = lessons.filter((l) => completedIds.has(`${summary.id}:${l.id}`)).length;
  const allDone = doneCount === lessons.length && lessons.length > 0;
  // The first lesson not yet completed — where "Continue" should land.
  const nextLesson = lessons.find((l) => !completedIds.has(`${summary.id}:${l.id}`)) ?? null;

  return (
    <main className="min-h-screen bg-premium-midnight px-5 pt-6 pb-nav-safe">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link
          href="/learn"
          className="flex min-h-[44px] items-center font-body text-sm text-premium-ivory/65 underline underline-offset-2"
        >
          ← Learn
        </Link>

        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl">
              {summary.emoji}
            </span>
            <h1 className="font-classic-display text-2xl text-premium-ivory">{summary.title}</h1>
          </div>
          <p className={TEXT.body}>{summary.description}</p>
          <p className={TEXT.caption}>
            {allDone
              ? `All ${lessons.length} lessons complete`
              : `${doneCount} of ${lessons.length} lessons complete`}
          </p>
        </header>

        {nextLesson && (
          <Link href={`${basePath}/${nextLesson.id}`} className="block">
            <PrimaryCard className="flex flex-col gap-1 border-premium-gold/30">
              <p className={`${TEXT.meta} text-premium-gold`}>
                {doneCount === 0 ? "Start here" : "Continue"}
              </p>
              <p className="font-classic-display text-lg text-premium-ivory">{nextLesson.title}</p>
              <p className={TEXT.body}>{nextLesson.concept}</p>
            </PrimaryCard>
          </Link>
        )}

        <ol className="flex flex-col gap-2">
          {lessons.map((lesson) => {
            const done = completedIds.has(`${summary.id}:${lesson.id}`);
            return (
              <li key={lesson.id}>
                <Link
                  href={`${basePath}/${lesson.id}`}
                  className="flex min-h-[64px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 py-3 transition-colors hover:border-premium-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
                >
                  {/* Completion is shown by a check glyph and a text label, not
                      by colour alone. */}
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border font-classic-body text-xs ${
                      done
                        ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                        : "border-white/20 text-premium-ivory/60"
                    }`}
                  >
                    {done ? "✓" : lesson.order}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-classic-body text-sm text-premium-ivory">
                      {lesson.title}
                    </span>
                    <span className={TEXT.caption}>
                      {done ? "Complete" : lesson.concept}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
