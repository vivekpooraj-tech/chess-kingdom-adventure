"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { loadCompletedLessonIds } from "@/lib/learner/academyProgressClient";
import { buildLearningPath, pathSummary, type LearningPath } from "@/lib/learner/learningPath";

/**
 * "Where am I, and what comes next?" — the ordered view of the course-tracked
 * part of Learn.
 *
 * A client island, like the other personalized elements here: the Learn page
 * stays a static server page and paints unchanged, and this fills in
 * afterwards without blocking it. It shares the one completed-ids request with
 * the status chips (lib/learner/academyProgressClient.ts), so adding this
 * panel costs no extra round trip.
 *
 * Renders NOTHING for a signed-out visitor, a failed read, or a learner with
 * nothing completed yet and no lessons resolved — the same rule the status
 * chips follow. An honest empty slot beats a confident zero.
 *
 * Only course-tracked sections appear, and deliberately so; see
 * lib/learner/learningPath.ts for why Fundamentals, Origins, Openings and the
 * Kingdom Journey are not stages here.
 */
export function LearningPathPanel({
  lessonIdsByCourse,
}: {
  lessonIdsByCourse: Record<string, string[]>;
}) {
  const [path, setPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCompletedLessonIds().then((completed) => {
      if (cancelled) return;
      setPath(buildLearningPath(completed, lessonIdsByCourse));
    });
    return () => {
      cancelled = true;
    };
  }, [lessonIdsByCourse]);

  if (!path || path.totalLessons === 0) return null;

  return (
    <section
      aria-labelledby="learning-path-heading"
      className="w-full rounded-premiumCard bg-premium-navy/70 border border-white/5 p-5 sm:p-6 flex flex-col gap-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="learning-path-heading"
          className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90"
        >
          Your Learning Path
        </h2>
        <p className="font-classic-body text-[11px] text-premium-ivory/45 flex-none tabular-nums">
          {path.completedLessons} / {path.totalLessons}
        </p>
      </div>

      <div>
        <div
          role="progressbar"
          aria-valuenow={path.completedLessons}
          aria-valuemin={0}
          aria-valuemax={path.totalLessons}
          aria-label={`Learning path: ${path.completedLessons} of ${path.totalLessons} lessons complete`}
          className="h-1.5 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-premium-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${path.percent}%` }}
          />
        </div>
        <p className={`${TEXT.caption} normal-case mt-2`}>{pathSummary(path)}</p>
      </div>

      <ol className="flex flex-col gap-1.5">
        {path.stages.map((stage, i) => (
          <li key={stage.courseId}>
            <Link
              href={stage.href}
              className="flex items-center gap-3 min-h-[56px] rounded-xl px-3 py-2.5 bg-premium-midnight/30 border border-white/5 hover:border-premium-gold/25 active:scale-[0.99] transition-[border-color,transform] duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
            >
              {/* Step marker: a tick when finished, otherwise the step number —
                  the position in the path is the point of this list. */}
              <span
                aria-hidden
                className={`flex-none w-7 h-7 rounded-full flex items-center justify-center font-classic-body text-xs font-semibold border ${
                  stage.state === "complete"
                    ? "bg-premium-gold/15 border-premium-gold/50 text-premium-gold"
                    : stage.state === "current"
                      ? "bg-premium-emerald/20 border-premium-emerald/50 text-premium-ivory"
                      : "bg-transparent border-white/15 text-premium-ivory/40"
                }`}
              >
                {stage.state === "complete" ? "✓" : i + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="font-classic-display text-base text-premium-ivory">{stage.title}</p>
                  {stage.state === "current" && (
                    <span className="font-classic-body text-[10px] font-semibold uppercase tracking-wide text-premium-emerald">
                      You are here
                    </span>
                  )}
                </div>
                <p className={TEXT.caption}>{stage.blurb}</p>
              </div>

              <span
                className={`font-classic-body text-[11px] flex-none tabular-nums ${
                  stage.state === "complete" ? "text-premium-gold" : "text-premium-ivory/45"
                }`}
              >
                {stage.completed} / {stage.total}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
