import Link from "next/link";
import { backLabel, destinationHref } from "@/lib/navigation/destinations";
import { TEXT } from "@/lib/designSystem";

/**
 * Compact, consistent header for every step of a lesson (Phase 11 point 2).
 * Deliberately small — the board is the hero, this just orients the child.
 */
export function LessonHeader({
  zoneName,
  zoneEmoji,
  dayNumber,
  title,
  stepIndex,
  totalSteps,
  exitHref = destinationHref("LESSONS"),
  courseTotalDays,
}: {
  zoneName?: string;
  zoneEmoji?: string;
  dayNumber: number;
  title: string;
  stepIndex: number;
  totalSteps: number;
  exitHref?: string;
  /**
   * Total days in the Chess School course. When given, the header reads
   * "Day 12 of 30" instead of a bare "Day 12", so every lesson states where
   * it sits in the course — the thing the 30-day journey never said.
   *
   * A PROP rather than an import on purpose: this header is also used by
   * components/academy/CourseIndex.tsx, and importing the course module here
   * would pull the whole lesson dataset into that route's bundle. The lesson
   * page already ships that content, so it passes the number down instead.
   */
  courseTotalDays?: number;
}) {
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div className="w-full max-w-lg flex flex-col gap-1">
      {/* The way out of a lesson: a visible, named parent link (the lesson list it was opened
          from), 44px tall. It replaces a 32px icon-only "Exit lesson" button. */}
      <Link
        href={exitHref}
        aria-label={backLabel("LESSONS")}
        className="-ml-1 inline-flex min-h-[44px] min-w-[44px] items-center self-start rounded px-1 font-classic-body text-sm text-premium-ivory/80 underline underline-offset-2 hover:text-premium-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
      >
        ← {backLabel("LESSONS")}
      </Link>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`${TEXT.meta} text-premium-gold`}>
            {courseTotalDays ? "🏫 Chess School · " : ""}
            {zoneEmoji ? `${zoneEmoji} ` : ""}
            {zoneName ?? "Chess Journey"}
          </p>
          <p className="font-classic-display text-base text-premium-ivory truncate">
            Day {dayNumber}
            {courseTotalDays ? ` of ${courseTotalDays}` : ""} · {title}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-premium-goldMuted to-premium-gold transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className={`${TEXT.caption} flex-none`}>
          {stepIndex + 1} of {totalSteps}
        </span>
      </div>
    </div>
  );
}
