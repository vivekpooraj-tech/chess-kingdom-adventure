import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import {
  COURSE_NAME,
  COURSE_TITLE,
  chessSchoolProgress,
  dayOfLabel,
  schoolSummary,
  continueLabel,
  continueHref,
} from "@/lib/school/chessSchool";

/**
 * Chess School on Home — the course header above the 30-day journey.
 *
 * A server component taking plain props, because Home has already fetched
 * current_day and the completed-day list for the journey below it. Rendering
 * from those costs no extra query and no client JS; the progress shown is the
 * same data the lesson cards under it are drawn from, so the two can never
 * disagree.
 *
 * Renders nothing when the course is empty — there is no honest "0 of 0".
 */
export function ChessSchoolCard({
  currentDay,
  completedDays,
  currentLessonTitle,
  neutralTone,
}: {
  currentDay: number;
  completedDays: number[];
  /** Title of the day the learner is on, for a concrete "what's next". */
  currentLessonTitle?: string | null;
  neutralTone: boolean;
}) {
  const progress = chessSchoolProgress({ currentDay, completedDays });
  if (progress.totalDays === 0) return null;

  const summary = schoolSummary(progress, neutralTone);

  return (
    <section
      aria-labelledby="chess-school-heading"
      className="w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy border border-premium-gold/25 p-5 sm:p-6 flex flex-col gap-4 shadow-premiumCard"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
            🏫 {COURSE_NAME}
          </p>
          <h2
            id="chess-school-heading"
            className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug mt-1"
          >
            {COURSE_TITLE}
          </h2>
        </div>
        <span className="font-classic-body text-[11px] text-premium-ivory/55 flex-none tabular-nums border border-white/10 rounded-full px-2.5 py-1">
          {progress.completedCount} / {progress.totalDays}
        </span>
      </div>

      <div>
        <div
          role="progressbar"
          aria-valuenow={progress.completedCount}
          aria-valuemin={0}
          aria-valuemax={progress.totalDays}
          aria-label={`${COURSE_TITLE}: ${progress.completedCount} of ${progress.totalDays} days complete`}
          className="h-2 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-premium-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
        {summary && <p className={`${TEXT.caption} normal-case mt-2`}>{summary}</p>}
      </div>

      {/* The day the learner is actually on, named — "Day 12 of 30" plus the
          lesson's own title, so the next step is concrete rather than a
          generic "continue". Hidden once the course is finished, where a
          "next day" would be a fiction. */}
      {!progress.isComplete && currentLessonTitle && (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-gold">
            {dayOfLabel(progress.currentDay, progress.totalDays)}
          </span>
          <span className="font-classic-body text-sm text-premium-ivory/80 min-w-0 truncate">
            {currentLessonTitle}
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap mt-auto">
        <Link
          href={continueHref(progress)}
          className="font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        >
          {continueLabel(progress)}
        </Link>
        {/* The course overview — what the 30 days actually teach, stage by
            stage. Secondary on purpose: the primary action is always to keep
            learning, not to go and read about learning. */}
        <Link
          href="/chess-school"
          className="font-classic-body text-xs text-premium-ivory/65 underline underline-offset-4 hover:text-premium-gold min-h-[44px] flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded"
        >
          View the course
        </Link>
      </div>
    </section>
  );
}
