import { notFound } from "next/navigation";
import { CourseLessonRunner } from "@/components/academy/CourseLessonRunner";
import { getCourse, getLesson } from "@/lib/academy/courses.server";

export function generateStaticParams() {
  return (getCourse("endgames")?.lessons ?? []).map((l) => ({ lessonId: l.id }));
}

export default function EndgameLessonPage({ params }: { params: { lessonId: string } }) {
  if (!getLesson("endgames", params.lessonId)) notFound();

  return (
    <CourseLessonRunner
      courseId="endgames"
      lessonId={params.lessonId}
      courseHref="/academy/endgames"
    />
  );
}
