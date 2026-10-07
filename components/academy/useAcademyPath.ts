"use client";

import { useEffect, useState } from "react";
import { loadCompletedLessonIds } from "@/lib/learner/academyProgressClient";
import { buildLearningPath, type LearningPath } from "@/lib/learner/learningPath";

/**
 * The learner's real learning path for the Academy presentations (the same data the Learn page shows). Null until the real
 * completed-lesson set arrives, and stays null for a signed-out visitor or a failed read: presentations then show the
 * fixed structure with NO numbers, never an estimate.
 */
export function useAcademyPath(lessonIdsByCourse: Record<string, string[]>): LearningPath | null {
  const [path, setPath] = useState<LearningPath | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCompletedLessonIds().then((completed) => {
      if (cancelled) return;
      const built = buildLearningPath(completed, lessonIdsByCourse);
      setPath(built.totalLessons > 0 ? built : null);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonIdsByCourse]);
  return path;
}

export interface AcademyCurrent {
  title: string;
  blurb: string;
  href: string;
  /** Real counts, or null while unknown. */
  completed: number | null;
  total: number | null;
  /** "Begin" | "Continue" | "Review" — wording only. */
  verb: "Begin" | "Continue" | "Review";
}

/** The stage the learner is on now (or the last one when everything is complete), from the real path when it is known. */
export function currentStage(path: LearningPath | null, fallback: { title: string; blurb: string; href: string }): AcademyCurrent {
  if (!path) return { ...fallback, completed: null, total: null, verb: "Begin" };
  const i = path.allComplete ? path.stages.length - 1 : Math.max(0, path.stages.findIndex((s) => s.state === "current"));
  const s = path.stages[i];
  return {
    title: s.title,
    blurb: s.blurb,
    href: s.href,
    completed: s.completed,
    total: s.total,
    verb: path.allComplete ? "Review" : path.completedLessons === 0 ? "Begin" : "Continue",
  };
}

/** "Start" | "n of m" | "Mastered" for a course, from the real path; null when unknown (render nothing). */
export function courseLabel(path: LearningPath | null, courseId?: string): { label: string; done: boolean } | null {
  if (!path || !courseId) return null;
  const s = path.stages.find((x) => x.courseId === courseId);
  if (!s) return null;
  const done = s.total > 0 && s.completed >= s.total;
  return { label: s.completed === 0 ? "Start" : done ? "Mastered" : `${s.completed} of ${s.total}`, done };
}
