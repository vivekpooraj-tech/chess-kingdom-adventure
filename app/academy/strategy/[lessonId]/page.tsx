import { notFound } from "next/navigation";
import { CourseLessonRunner } from "@/components/academy/CourseLessonRunner";
import { getCourse, getLesson } from "@/lib/academy/courses.server";

export function generateStaticParams() {
  return (getCourse("strategy")?.lessons ?? []).map((l) => ({ lessonId: l.id }));
}

export default function StrategyLessonPage({ params }: { params: { lessonId: string } }) {
  if (!getLesson("strategy", params.lessonId)) notFound();

  return (
    <CourseLessonRunner
      courseId="strategy"
      lessonId={params.lessonId}
      courseHref="/academy/strategy"
    />
  );
}
