import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { courseJourney, type StageProgress } from "@/lib/school/curriculum";
import { getZoneForDay } from "@/content/kingdomZones";
import { LESSONS } from "@/content/lessons";

/**
 * The course, seen as five stages instead of thirty numbered days.
 *
 * Home already lists all 30 day cards (KingdomMapCards). That view answers
 * "what's next"; it cannot answer "what am I learning, and how far through
 * the subject am I" — the question a parent asks and the one that makes a
 * 30-day commitment legible. This is that second view, and it is derived from
 * the same completed-day list, so the two can never disagree.
 *
 * A server component taking plain props: no client JS, no second query.
 * Every number shown is computed from real completions.
 */
function StageRow({
  stage,
  index,
  total,
  locked,
}: {
  stage: StageProgress;
  index: number;
  total: number;
  locked: boolean;
}) {
  const firstDay = stage.days[0];
  const lastDay = stage.days[stage.days.length - 1];
  const lesson = LESSONS.find((l) => l.dayNumber === (stage.nextDay ?? lastDay));

  const body = (
    <div className="flex items-start gap-3 sm:gap-4 w-full">
      {/* Rail: the dot for this stage plus the connector to the next one, so
          the five stages read as one journey rather than five cards. */}
      <div className="flex flex-col items-center flex-none pt-1" aria-hidden="true">
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border ${
            stage.isComplete
              ? "bg-premium-gold text-premium-midnight border-premium-gold"
              : stage.isCurrent
                ? "bg-premium-gold/15 text-premium-gold border-premium-gold/60"
                : "bg-white/5 text-premium-ivory/50 border-white/10"
          }`}
        >
          {stage.isComplete ? "✓" : stage.emoji}
        </span>
        {index < total - 1 && <span className="w-px flex-1 min-h-[2rem] bg-white/10 mt-1" />}
      </div>

      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="font-classic-display text-base text-premium-ivory">{stage.name}</p>
          <span className={`${TEXT.caption} tabular-nums flex-none`}>
            {stage.completedCount}/{stage.days.length} days
          </span>
        </div>

        <p className={`${TEXT.caption} normal-case mt-1`}>{stage.blurb}</p>

        <div
          role="progressbar"
          aria-valuenow={stage.completedCount}
          aria-valuemin={0}
          aria-valuemax={stage.days.length}
          aria-label={`${stage.name}: ${stage.completedCount} of ${stage.days.length} days complete`}
          className="h-1.5 w-full rounded-full bg-premium-ivory/10 overflow-hidden mt-2.5"
        >
          <div
            className="h-full rounded-full bg-premium-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${stage.percentComplete}%` }}
          />
        </div>

        {/* The concrete next thing in this stage — a real lesson, named. Only
            where one exists: a finished stage has no "next". */}
        {stage.nextDay && lesson && (
          <p className={`${TEXT.caption} normal-case mt-2 truncate`}>
            {locked ? "🔒 " : "Next: "}
            <span className="text-premium-ivory/80">
              Day {stage.nextDay} · {lesson.title}
            </span>
          </p>
        )}
        {!stage.nextDay && (
          <p className={`${TEXT.caption} normal-case mt-2 text-premium-gold/80`}>
            Complete — days {firstDay}–{lastDay}
          </p>
        )}
      </div>
    </div>
  );

  // A stage links to its next unfinished day. A finished stage links to its
  // first day so it can be reviewed; there is no dead card either way.
  const href = `/lesson/${stage.nextDay ?? firstDay}`;
  return (
    <li>
      <Link
        href={href}
        className="block rounded-2xl px-2 -mx-2 hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 transition-colors"
      >
        {body}
      </Link>
    </li>
  );
}

export function CourseJourney({
  currentDay,
  completedDays,
  /** Days the learner cannot open yet (premium gating). Display only — the
   *  real gate is enforced server-side in the lesson route, not here. */
  lockedDays = [],
}: {
  currentDay: number;
  completedDays: number[];
  lockedDays?: number[];
}) {
  const stages = courseJourney({ currentDay, completedDays });
  if (stages.length === 0) return null;

  const locked = new Set(lockedDays);

  return (
    <section aria-labelledby="course-journey-heading" className="w-full">
      <h2 id="course-journey-heading" className={`${TEXT.caption} uppercase tracking-wide mb-3`}>
        What you&apos;ll learn
      </h2>
      <ol className="w-full list-none">
        {stages.map((stage, i) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={i}
            total={stages.length}
            locked={stage.nextDay !== null && locked.has(stage.nextDay)}
          />
        ))}
      </ol>
      <p className={`${TEXT.caption} normal-case mt-1`}>
        Your journey runs through {getZoneForDay(1).name} to {getZoneForDay(LESSONS.length).name}.
      </p>
    </section>
  );
}
