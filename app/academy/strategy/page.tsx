import { notFound } from "next/navigation";
import { CourseIndex } from "@/components/academy/CourseIndex";
import { getCourse } from "@/lib/academy/courses.server";
import { getCompletedContentIds } from "@/lib/academy/courseProgress.server";

export const metadata = {
  title: "Strategy · Chess Mind",
  description: "How to think when there is no tactic: king safety, outposts, pawn breaks.",
};

export default async function StrategyPage() {
  const course = getCourse("strategy");
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
      basePath="/academy/strategy"
    />
  );
}
