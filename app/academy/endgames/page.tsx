import { notFound } from "next/navigation";
import { CourseIndex } from "@/components/academy/CourseIndex";
import { getCourse } from "@/lib/academy/courses.server";
import { getCompletedContentIds } from "@/lib/academy/courseProgress.server";

export const metadata = {
  title: "Endgames · Chess Mind",
  description: "King activity, passed pawns, rook endings — the phase that decides games.",
};

export default async function EndgamesPage() {
  const course = getCourse("endgames");
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
      basePath="/academy/endgames"
    />
  );
}
