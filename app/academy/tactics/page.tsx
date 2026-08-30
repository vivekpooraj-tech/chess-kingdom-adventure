import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getAcademyProgressForIds } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { TACTICS_LESSONS } from "@/content/tacticsLessons";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { TacticsCourseClient } from "@/components/academy/TacticsCourseClient";

export default async function TacticsCoursePage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const { data: parent } = await supabase
    .from("parents")
    .select("premium_status")
    .eq("auth_user_id", user.id)
    .single();
  const isPremium = parent?.premium_status === "premium";

  const progressByLessonId = await getAcademyProgressForIds(
    supabase,
    child.id,
    TACTICS_LESSONS.map((l) => l.id)
  );

  return (
    <>
      <Screen maxWidth="compact">
        <TacticsCourseClient isPremium={isPremium} progressByLessonId={progressByLessonId} />
      </Screen>
      <PrimaryNav />
    </>
  );
}
