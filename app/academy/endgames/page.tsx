import { notFound } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
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

  // Same isPremium pattern app/academy/tactics/page.tsx already uses — the
  // list is a reading page, so a failed/missing session just shows every
  // lesson as locked rather than erroring.
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  let isPremium = false;
  if (user) {
    const { data: parent } = await supabase
      .from("parents")
      .select(PARENT_PREMIUM_COLUMNS)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    isPremium = resolvePremiumState(parent).isPremium;
  }

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
      isPremium={isPremium}
      freeLessonLimit={2}
    />
  );
}
