import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { CourseJourney } from "@/components/school/CourseJourney";
import { GraduationPanel } from "@/components/school/GraduationPanel";
import { COURSE_NAME, COURSE_TITLE, COURSE_TAGLINE, schoolSummary, continueHref, dayOfLabel } from "@/lib/school/chessSchool";
import type { ChessSchoolData } from "@/components/chessSchool/types";

/**
 * Classic/Pro Chess School composition — dense, information-forward.
 * CourseJourney and GraduationPanel are the real, unmodified shared
 * components; every number here comes from the single ChessSchoolData
 * object the page computed once. The "Continue →" label is presentation
 * text only (approved design) — continueHref(progress) is the exact same
 * real destination continueLabel() itself would open.
 */
export function ClassicChessSchool({ data: d }: { data: ChessSchoolData }) {
  const { progress } = d;

  return (
    <div className="w-full flex flex-col gap-4">
      <header className="w-full">
        <p className={`${TEXT.meta} chess-school-accent-text`}>🏫 {COURSE_NAME}</p>
        <h1 className={`${TEXT.display} mt-1`}>{COURSE_TITLE}</h1>
        <p className={`${TEXT.body} mt-1`}>{COURSE_TAGLINE}</p>
      </header>

      <Link
        href="/chess-school/classroom"
        className="chess-school-row w-full rounded-premiumCard border border-premium-gold/35 bg-gradient-to-br from-premium-gold/[0.10] to-transparent p-4 flex items-center justify-between gap-3 hover:border-premium-gold/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
      >
        <div className="min-w-0">
          <p className={`${TEXT.meta} text-premium-gold`}>NEW · THE CLASSROOM</p>
          <p className="font-classic-display text-base text-premium-ivory mt-0.5">From zero to playing real people</p>
          <p className={`${TEXT.caption} normal-case mt-0.5`}>30 sessions with Ollie as your coach. Your own pace, no streaks.</p>
        </div>
        <span aria-hidden="true" className="chess-school-cta text-lg flex-none">→</span>
      </Link>

      <section
        aria-label="Your progress"
        className="chess-school-progress-card w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy border border-premium-gold/25 p-4 flex flex-col gap-3 shadow-premiumCard"
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="font-classic-display text-base text-premium-ivory">
            {progress.isComplete ? "Course complete" : dayOfLabel(progress.resumeDay, progress.totalDays)}
          </p>
          <span className="font-classic-body text-[11px] text-premium-ivory/55 tabular-nums border border-white/10 rounded-full px-2.5 py-1">
            {progress.completedCount} / {progress.totalDays}
          </span>
        </div>

        <div>
          <div
            role="progressbar"
            aria-valuenow={progress.completedCount}
            aria-valuemin={0}
            aria-valuemax={progress.totalDays}
            aria-label={`${progress.completedCount} of ${progress.totalDays} days complete`}
            className="h-1.5 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
          >
            <div
              className="chess-school-bar-fill h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          <p className={`${TEXT.caption} normal-case mt-1.5`}>{schoolSummary(progress, d.neutralTone)}</p>
        </div>

        {!progress.isComplete && d.resumeLesson && (
          <p className={`${TEXT.caption} normal-case`}>
            Up next: <span className="text-premium-ivory/85">{d.resumeLesson.title}</span>
          </p>
        )}

        <Link
          href={continueHref(progress)}
          className="chess-school-continue-cta self-start font-classic-body text-sm font-semibold text-premium-midnight rounded-full px-4 py-2 min-h-[44px] flex items-center active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        >
          Continue →
        </Link>
      </section>

      {progress.isComplete && <GraduationPanel completedDays={d.completedDays} neutralTone={d.neutralTone} />}

      <CourseJourney currentDay={progress.currentDay} completedDays={d.completedDays} lockedDays={d.lockedDays} />

      <Link
        href="/kingdom-map#journey"
        className={`${TEXT.caption} normal-case underline underline-offset-4 hover:text-premium-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded`}
      >
        See all {progress.totalDays} days →
      </Link>
    </div>
  );
}
