import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getCourse, getLesson } from "@/lib/academy/courses.server";
import type { LessonResponse } from "@/lib/academy/courseTypes";

/**
 * Serve ONE Academy lesson.
 *
 * The whole reason this route exists: course content stays on the server and
 * the browser receives only the lesson it is about to work through. A course is
 * a few tens of KB of prose and positions, and the existing tactics course
 * shows what happens otherwise — it imports all ~51KB into the client bundle.
 *
 * Auth-gated but not premium-gated: this only returns lesson content, and the
 * course index decides what a given child may open. Gating here as well would
 * duplicate that rule in a second place where it could drift.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json(
      { lesson: null, courseId: "", courseTitle: "", lessonIds: [], nextLessonId: null } satisfies LessonResponse,
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const courseId = url.searchParams.get("course") ?? "";
  const lessonId = url.searchParams.get("lesson") ?? "";

  const course = getCourse(courseId);
  if (!course) {
    return NextResponse.json(
      { lesson: null, courseId, courseTitle: "", lessonIds: [], nextLessonId: null } satisfies LessonResponse,
      { status: 404 }
    );
  }

  const lessonIds = course.lessons.map((l) => l.id);
  const lesson = getLesson(courseId, lessonId);
  const index = lessonIds.indexOf(lessonId);
  const nextLessonId = index >= 0 && index < lessonIds.length - 1 ? lessonIds[index + 1] : null;

  return NextResponse.json(
    {
      lesson,
      courseId,
      courseTitle: course.summary.title,
      lessonIds,
      nextLessonId,
    } satisfies LessonResponse,
    { status: lesson ? 200 : 404, headers: { "Cache-Control": "no-store" } }
  );
}
