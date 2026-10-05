import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getCourse, getLesson, isLessonFree } from "@/lib/academy/courses.server";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import type { LessonResponse } from "@/lib/academy/courseTypes";
import { cookies } from "next/headers";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached } from "@/lib/supabase/queries";
import { readServeGate } from "@/lib/trainYourMind/dailyLimitServer";

/** Tactical Thinking is one of the eight Train Your Chess Mind categories, so it has its own
 *  free daily limit: 3 completed exercises per child per day. */
const TRAIN_YOUR_MIND_COURSE = "tactical-thinking";

/**
 * Serve ONE Academy lesson.
 *
 * The whole reason this route exists: course content stays on the server and
 * the browser receives only the lesson it is about to work through. A course is
 * a few tens of KB of prose and positions, and the existing tactics course
 * shows what happens otherwise — it imports all ~51KB into the client bundle.
 *
 * Auth-gated, and now (Phase 4) premium-gated for courses with a free lesson
 * limit (isLessonFree(), backed by the same courses.server.ts registry the
 * course index reads its lock icons from — one source of truth, not two
 * independently-hardcoded checks). A locked lesson never leaves the server:
 * the response omits `lesson` entirely and sends only a value-forward
 * preview, so opening dev tools and hitting this endpoint directly can't be
 * used to read gated content.
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

  if (courseId === TRAIN_YOUR_MIND_COURSE) {
    const { data: parentRow } = await supabase
      .from("parents")
      .select(PARENT_PREMIUM_COLUMNS)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!resolvePremiumState(parentRow).isPremium) {
      const resolution = await resolveActiveChildCached(supabase, user.id, cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null);
      const gate = resolution.child ? await readServeGate(supabase, resolution.child.id, "tactical", url.searchParams.get("d")) : null;
      if (gate && !gate.allowed) {
        return NextResponse.json(
          {
            lesson: null,
            courseId,
            courseTitle: course.summary.title,
            lessonIds: course.lessons.map((l) => l.id),
            nextLessonId: null,
            dailyLimit: { used: gate.used, limit: gate.limit },
          } satisfies LessonResponse,
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  }

  const lessonIds = course.lessons.map((l) => l.id);
  const lesson = getLesson(courseId, lessonId);
  const index = lessonIds.indexOf(lessonId);
  const nextLessonId = index >= 0 && index < lessonIds.length - 1 ? lessonIds[index + 1] : null;

  if (lesson && !isLessonFree(courseId, lesson.order)) {
    const { data: parent } = await supabase
      .from("parents")
      .select(PARENT_PREMIUM_COLUMNS)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const isPremium = resolvePremiumState(parent).isPremium;
    if (!isPremium) {
      return NextResponse.json(
        {
          lesson: null,
          courseId,
          courseTitle: course.summary.title,
          lessonIds,
          nextLessonId,
          locked: true,
          lockedPreview: { title: lesson.title, concept: lesson.concept, intro: lesson.intro },
        } satisfies LessonResponse,
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

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
