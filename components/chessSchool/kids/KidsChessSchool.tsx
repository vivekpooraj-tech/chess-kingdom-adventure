import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { CourseJourney } from "@/components/school/CourseJourney";
import { GraduationPanel } from "@/components/school/GraduationPanel";
import { COURSE_NAME, COURSE_TITLE, COURSE_TAGLINE, schoolSummary, continueHref, dayOfLabel } from "@/lib/school/chessSchool";
import type { ChessSchoolData } from "@/components/chessSchool/types";

/**
 * Kids ("Enchanted Kingdom") Chess School composition — friendly framing of
 * the exact same real numbers. CourseJourney and GraduationPanel are the
 * real, unmodified shared components — no crowns/stars/XP are added around
 * them. The "Keep Going! →" label is presentation text only (approved
 * design); continueHref(progress) is the exact same real destination
 * continueLabel() itself would open. Premium locking stays a plain
 * subscription fact ("🔒 With Premium"), not a new unlock mechanic.
 */
export function KidsChessSchool({ data: d }: { data: ChessSchoolData }) {
  const { progress } = d;

  return (
    <div className="w-full flex flex-col gap-6">
      <header className="w-full">
        <p className={`${TEXT.meta} chess-school-accent-text`}>🏫 {COURSE_NAME}</p>
        <h1 className={`${TEXT.display} mt-1`}>{COURSE_TITLE}</h1>
        <p className={`${TEXT.body} mt-2`}>{COURSE_TAGLINE}</p>
      </header>

      <section
        aria-label="Your progress"
        className="chess-school-progress-card w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy border border-premium-gold/25 p-5 flex flex-col gap-4 shadow-premiumCard"
      >
        <p className="font-classic-display text-lg text-premium-ivory">
          {progress.isComplete
            ? "You finished the course!"
            : `You're on ${dayOfLabel(progress.resumeDay, progress.totalDays)}!`}
        </p>

        <div>
          <div
            role="progressbar"
            aria-valuenow={progress.completedCount}
            aria-valuemin={0}
            aria-valuemax={progress.totalDays}
            aria-label={`${progress.completedCount} of ${progress.totalDays} days complete`}
            className="h-2.5 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
          >
            <div
              className="chess-school-bar-fill h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          <p className={`${TEXT.caption} normal-case mt-2`}>{schoolSummary(progress, d.neutralTone)}</p>
        </div>

        {!progress.isComplete && d.resumeLesson && (
          <p className={`${TEXT.caption} normal-case`}>
            Next up: <span className="text-premium-ivory/85">{d.resumeLesson.title}</span>
          </p>
        )}

        <Link
          href={continueHref(progress)}
          className="chess-school-continue-cta self-start font-classic-body text-sm font-bold text-premium-midnight rounded-full px-6 py-3 min-h-[52px] flex items-center active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        >
          Keep Going! →
        </Link>
      </section>

      <Link
        href="/chess-school/classroom"
        className="chess-school-row w-full rounded-premiumCard border border-premium-gold/35 bg-gradient-to-br from-premium-gold/[0.10] to-transparent p-5 flex items-center gap-3 min-h-[64px] hover:border-premium-gold/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
      >
        <div className="min-w-0 flex-1">
          <p className={`${TEXT.meta} text-premium-gold`}>NEW · THE CLASSROOM</p>
          <p className="font-classic-display text-lg text-premium-ivory mt-1">From zero to playing real people</p>
          <p className={`${TEXT.caption} normal-case mt-1`}>30 sessions with Ollie as your coach. Your own pace, no streaks.</p>
        </div>
        <span aria-hidden="true" className="chess-school-cta text-xl flex-none">→</span>
      </Link>

      {progress.isComplete && <GraduationPanel completedDays={d.completedDays} neutralTone={d.neutralTone} />}

      <section className="w-full flex flex-col gap-3">
        <p className="chess-school-section-eyebrow font-classic-body text-xs font-semibold uppercase tracking-wide">
          Your Journey
        </p>
        <CourseJourney currentDay={progress.currentDay} completedDays={d.completedDays} lockedDays={d.lockedDays} />
      </section>

      <Link
        href="/kingdom-map#journey"
        className={`${TEXT.caption} normal-case underline underline-offset-4 hover:text-premium-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded`}
      >
        See all {progress.totalDays} days →
      </Link>
    </div>
  );
}
