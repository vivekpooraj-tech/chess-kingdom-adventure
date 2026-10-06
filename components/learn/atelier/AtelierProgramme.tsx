"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadCompletedLessonIds } from "@/lib/learner/academyProgressClient";
import {
  buildLearningPath,
  LEARNING_PATH_STAGES,
  pathSummary,
  type LearningPath,
  type LearningStage,
} from "@/lib/learner/learningPath";
import { useAtelierBranchActive } from "@/components/layout/AtelierBranch";

/**
 * "Current programme" — the Training Academy's lead. It reads the SAME learning path the shared Learn page shows
 * (buildLearningPath over the shared completed-lessons request) and presents it as one programme with a current
 * stage, rather than a list of equal cards.
 *
 * Honesty rules, same as LearningPathPanel: until real data arrives (and for a signed-out visitor or a failed read)
 * it shows the programme's fixed order and NO numbers. Nothing is estimated; a lesson is complete or it is not.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function AtelierProgramme({ lessonIdsByCourse }: { lessonIdsByCourse: Record<string, string[]> }) {
  const active = useAtelierBranchActive();
  const [path, setPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadCompletedLessonIds().then((completed) => {
      if (cancelled) return;
      const built = buildLearningPath(completed, lessonIdsByCourse);
      setPath(built.totalLessons > 0 ? built : null);
    });
    return () => {
      cancelled = true;
    };
  }, [active, lessonIdsByCourse]);

  const stages: Array<Pick<LearningStage, "courseId" | "title" | "blurb" | "href"> & Partial<LearningStage>> =
    path ? path.stages : LEARNING_PATH_STAGES;
  const currentIndex = path
    ? Math.max(0, path.stages.findIndex((s) => s.state === "current"))
    : 0;
  // When every stage is complete there is no "current"; the programme rests on its last stage.
  const resolvedIndex = path && path.allComplete ? path.stages.length - 1 : currentIndex;
  const current = stages[resolvedIndex] ?? stages[0];
  const currentStage = path ? path.stages[resolvedIndex] : null;

  const cta = !path
    ? "Open programme"
    : path.allComplete
      ? "Review programme"
      : path.completedLessons === 0
        ? "Begin programme"
        : "Continue programme";

  return (
    <section className="ta-programme" id="ta-programme" aria-labelledby="ta-programme-title" aria-busy={active && !path}>
      <p className="ta-eyebrow">
        Current programme
        <span className="ta-eyebrow__sep" aria-hidden="true"> · </span>
        <span>Stage {pad(resolvedIndex + 1)} of {pad(stages.length)}</span>
      </p>
      <h2 id="ta-programme-title" className="ta-programme__title">{current.title}</h2>
      <p className="ta-programme__blurb">{current.blurb}</p>

      {currentStage ? (
        <div className="ta-meter-wrap">
          <div
            className="ta-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={currentStage.total}
            aria-valuenow={currentStage.completed}
            aria-label={`${currentStage.title}: ${currentStage.completed} of ${currentStage.total} lessons complete`}
          >
            <i style={{ width: `${currentStage.total > 0 ? (currentStage.completed / currentStage.total) * 100 : 0}%` }} />
          </div>
          <p className="ta-meter__label">
            <span>{currentStage.completed}</span> of {currentStage.total} lessons in this stage
          </p>
        </div>
      ) : null}

      <Link href={current.href} className="ta-cta">
        {cta} <span aria-hidden="true">→</span>
      </Link>

      <ol className="ta-stages" aria-label="Programme stages">
        {stages.map((stage, i) => {
          const state = path ? path.stages[i]?.state : undefined;
          return (
            <li key={stage.courseId} className={`ta-stage${state ? ` is-${state}` : ""}`}>
              <Link href={stage.href} className="ta-stage__link" aria-current={state === "current" ? "step" : undefined}>
                <span className="ta-stage__no" aria-hidden="true">{state === "complete" ? "✓" : pad(i + 1)}</span>
                <span className="ta-stage__name">{stage.title}</span>
                {path && path.stages[i] ? (
                  <span className="ta-stage__count">
                    {path.stages[i].completed} / {path.stages[i].total}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      {path ? <p className="ta-programme__total">{pathSummary(path)}</p> : null}
    </section>
  );
}
