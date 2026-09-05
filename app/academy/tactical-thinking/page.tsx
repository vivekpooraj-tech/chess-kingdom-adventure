import { notFound } from "next/navigation";
import { CourseIndex } from "@/components/academy/CourseIndex";
import { getCourse } from "@/lib/academy/courses.server";
import { getCompletedContentIds } from "@/lib/academy/courseProgress.server";

export const metadata = {
  title: "Tactical Thinking · Chess Mind",
  description: "How to search a position: checks, captures, threats — then their reply.",
};

/**
 * Server component. Passes only lesson headers to <CourseIndex/> — the lesson
 * bodies stay on the server, where the course content lives.
 */
export default async function TacticalThinkingPage() {
  const course = getCourse("tactical-thinking");
  if (!course) notFound();

  const completedIds = await getCompletedContentIds();

  return (
    <CourseIndex
      summary={course.summary}
      lessons={course.lessons.map(({ id, order, title, concept }) => ({
        id,
        order,
        title,
        concept,
      }))}
      completedIds={completedIds}
      basePath="/academy/tactical-thinking"
    />
  );
}
