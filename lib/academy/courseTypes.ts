/**
 * Shared shape for Academy course lessons.
 *
 * Types only — no data, no chess engine, no `fs` — so a client component can
 * import this for the wire shape without pulling a course's content into the
 * browser bundle. Same pattern as lib/puzzles/tacticsTypes.ts, and for the same
 * reason: content/tacticsLessons.ts is ~51KB and is client-imported by the
 * existing tactics runner, which is exactly the cost this avoids repeating.
 *
 * Deliberately mirrors the structure content/tacticsLessons.ts already uses
 * (LEARN -> SEE -> PRACTICE -> QUIZ -> MASTER) rather than inventing a second
 * lesson model. That flow is the one the existing runner implements and the one
 * this app's teaching is already built around.
 */

export interface LessonExample {
  fen: string;
  caption: string;
}

/**
 * A single-move exercise. Validated on from/to squares rather than SAN, which
 * varies with disambiguation and check suffixes — the same comparison the
 * tactics lesson runner already makes.
 */
export interface LessonExercise {
  fen: string;
  sideToMove: "w" | "b";
  prompt: string;
  solutionFrom: string;
  solutionTo: string;
  successMessage: string;
  failureMessage: string;
  /** The full line in SAN, shown after a correct move so the learner sees how
   *  it finishes rather than only that they were right. */
  line?: string;
}

export interface LessonQuiz {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface CourseLesson {
  id: string;
  order: number;
  title: string;
  /** One line naming the idea, for the course index. */
  concept: string;
  /** The thinking habit this lesson installs — the reason it exists. */
  intro: string;
  explanation: string;
  whatToLookFor: string;
  examples: LessonExample[];
  exercises: LessonExercise[];
  quiz: LessonQuiz;
  takeaway: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  emoji: string;
  description: string;
  lessonCount: number;
}

/** What the lesson API sends: one lesson plus enough context to navigate. */
export interface LessonResponse {
  lesson: CourseLesson | null;
  courseId: string;
  courseTitle: string;
  /** Ordered ids, so the runner can render progress and a next link without
   *  holding the whole course. */
  lessonIds: string[];
  nextLessonId: string | null;
}
