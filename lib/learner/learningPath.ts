/**
 * The Learn page's visible learning path.
 *
 * Learn already answered "what exists" (a library of sections) and "what is
 * worth my time today" (NextLessonCard's weakness-driven pick). What it never
 * showed was ORDER: which of these builds on which, how far through the whole
 * thing you are, and where you currently stand. That is what this computes.
 *
 * SCOPE — and the honesty limit on it. Only the three COURSE-tracked sections
 * appear here, because they are the only ones with per-lesson completion rows
 * to count (child_academy_progress, via /api/academy/progress, keyed
 * `courseId:lessonId`). Fundamentals, Origins and Openings are real sections
 * and are NOT represented as path stages, because this module has no honest
 * per-lesson completion signal for them and a stage that could never fill
 * would misreport the learner's progress. The Kingdom Journey is likewise
 * absent: its progress is a day counter owned by Home, not lesson rows.
 *
 * Nothing here estimates, weights or infers. A lesson is complete or it is not.
 *
 * Pure — no I/O, no fetch, no clock. The completed-id set is passed in.
 */

export type StageState = "complete" | "current" | "upcoming";

export interface LearningStageDef {
  courseId: string;
  title: string;
  /** Why this stage sits where it does — shown as the stage's one-line note. */
  blurb: string;
  href: string;
}

export interface LearningStage extends LearningStageDef {
  completed: number;
  total: number;
  state: StageState;
}

export interface LearningPath {
  stages: LearningStage[];
  completedLessons: number;
  totalLessons: number;
  /** 0-100, rounded. 0 when there is nothing to count. */
  percent: number;
  allComplete: boolean;
  /** The stage marked "current", or null when everything is complete. */
  currentCourseId: string | null;
}

/**
 * Order is pedagogical, not arbitrary: see tactics before you plan around
 * them, and know where a game is going before you steer it there. It is fixed
 * rather than personalized — a path that reorders itself is not a path.
 */
export const LEARNING_PATH_STAGES: LearningStageDef[] = [
  {
    courseId: "tactical-thinking",
    title: "Tactical Thinking",
    blurb: "Seeing what a position offers before you move.",
    href: "/academy/tactical-thinking",
  },
  {
    courseId: "strategy",
    title: "Strategy",
    blurb: "Forming a plan once nothing is hanging.",
    href: "/academy/strategy",
  },
  {
    courseId: "endgames",
    title: "Endgames",
    blurb: "Converting an advantage when the board empties.",
    href: "/academy/endgames",
  },
];

/**
 * Build the path.
 *
 * `lessonIdsByCourse` carries ids only (the Learn page resolves them
 * server-side and passes them down, so no course CONTENT reaches the browser).
 * A course with no known lesson ids is dropped rather than shown as 0 of 0.
 *
 * "Current" is the FIRST stage that is not yet complete — so the marker moves
 * forward as work lands and never points backwards at something already
 * finished. Exactly one stage is ever current; when every stage is complete
 * there is none, and `allComplete` says so instead.
 */
export function buildLearningPath(
  completed: ReadonlySet<string>,
  lessonIdsByCourse: Record<string, readonly string[]>
): LearningPath {
  const counted = LEARNING_PATH_STAGES.map((def) => {
    const ids = lessonIdsByCourse[def.courseId] ?? [];
    return {
      def,
      total: ids.length,
      completed: ids.filter((id) => completed.has(`${def.courseId}:${id}`)).length,
    };
  }).filter((s) => s.total > 0);

  const firstIncomplete = counted.find((s) => s.completed < s.total);

  const stages: LearningStage[] = counted.map((s) => ({
    ...s.def,
    completed: s.completed,
    total: s.total,
    state:
      s.completed >= s.total
        ? "complete"
        : s.def.courseId === firstIncomplete?.def.courseId
          ? "current"
          : "upcoming",
  }));

  const completedLessons = stages.reduce((n, s) => n + s.completed, 0);
  const totalLessons = stages.reduce((n, s) => n + s.total, 0);

  return {
    stages,
    completedLessons,
    totalLessons,
    percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    allComplete: totalLessons > 0 && completedLessons >= totalLessons,
    currentCourseId: firstIncomplete?.def.courseId ?? null,
  };
}

/** The one line above the path. States progress; never nags about the rest. */
export function pathSummary(path: LearningPath): string {
  if (path.totalLessons === 0) return "";
  if (path.allComplete) return `All ${path.totalLessons} lessons complete.`;
  if (path.completedLessons === 0) return `${path.totalLessons} lessons ahead of you.`;
  return `${path.completedLessons} of ${path.totalLessons} lessons complete.`;
}
