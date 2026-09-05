import { notFound } from "next/navigation";
import { CourseLessonRunner } from "@/components/academy/CourseLessonRunner";
import { getCourse, getLesson } from "@/lib/academy/courses.server";

/**
 * Validates the lesson id on the server, then hands off to the client runner,
 * which fetches the lesson body from /api/academy/lesson. The content never
 * passes through this page's payload.
 */
export function generateStaticParams() {
  return (getCourse("tactical-thinking")?.lessons ?? []).map((l) => ({ lessonId: l.id }));
}

export default function TacticalThinkingLessonPage({
  params,
}: {
  params: { lessonId: string };
}) {
  if (!getLesson("tactical-thinking", params.lessonId)) notFound();

  return (
    <CourseLessonRunner
      courseId="tactical-thinking"
      lessonId={params.lessonId}
      courseHref="/academy/tactical-thinking"
    />
  );
}
