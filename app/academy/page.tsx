import { Screen } from "@/components/layout/Screen";
import { WorldScope } from "@/components/layout/WorldScope";
import { AcademyBody } from "@/components/academy/AcademyBody";
import { getCourse } from "@/lib/academy/courses.server";

/**
 * Academy: the index of every Academy section.
 *
 * The data (content/academyIndex.ts) and the learner's real progress (the learning path) are shared; the composition is
 * per world (components/academy/AcademyBody): Enchanted journey trail, Atelier programme, Classic syllabus.
 * A static server page like Learn: only lesson ids are read here, personal progress fills in on the client.
 */
export default function AcademyPage() {
  const courseLessonIds: Record<string, string[]> = {};
  for (const id of ["strategy", "endgames", "tactical-thinking"]) {
    const course = getCourse(id);
    if (course) courseLessonIds[id] = course.lessons.map((l) => l.id);
  }
  return (
    <WorldScope>
      <Screen maxWidth="wide" topSafeArea="icons">
        <AcademyBody lessonIdsByCourse={courseLessonIds} />
      </Screen>
    </WorldScope>
  );
}
