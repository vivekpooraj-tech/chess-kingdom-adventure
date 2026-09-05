import { TACTICAL_THINKING_LESSONS } from "@/content/tacticalThinkingLessons";
import type { CourseLesson, CourseSummary } from "./courseTypes";

/**
 * Server-only registry of Academy courses.
 *
 * SERVER ONLY. Never import this from a client component — it pulls in every
 * course's full content.
 *
 * Courses are served one lesson at a time through /api/academy/lesson so the
 * browser never downloads a whole curriculum. That is a deliberate departure
 * from the existing tactics course, which imports its ~51KB of lesson content
 * directly into the client bundle; repeating that for each new course would
 * have added a course's worth of bytes to First Load JS every time one was
 * written. New courses added here cost the client nothing.
 */

interface Course {
  summary: CourseSummary;
  lessons: CourseLesson[];
}

const COURSES: Record<string, Course> = {
  "tactical-thinking": {
    summary: {
      id: "tactical-thinking",
      title: "Tactical Thinking",
      emoji: "⚡",
      description: "How to search a position: checks, captures, threats — then their reply.",
      lessonCount: TACTICAL_THINKING_LESSONS.length,
    },
    lessons: [...TACTICAL_THINKING_LESSONS].sort((a, b) => a.order - b.order),
  },
};

export function getCourse(courseId: string): Course | null {
  return COURSES[courseId] ?? null;
}

export function getCourseSummary(courseId: string): CourseSummary | null {
  return COURSES[courseId]?.summary ?? null;
}

export function listCourseSummaries(): CourseSummary[] {
  return Object.values(COURSES).map((c) => c.summary);
}

export function getLesson(courseId: string, lessonId: string): CourseLesson | null {
  return getCourse(courseId)?.lessons.find((l) => l.id === lessonId) ?? null;
}

/**
 * The content id used in child_academy_progress. Namespaced by course so two
 * courses can never collide on a lesson id, and so existing progress rows
 * (which use their own ids) are untouched.
 */
export function lessonContentId(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}
