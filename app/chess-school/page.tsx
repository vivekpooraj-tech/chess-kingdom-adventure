import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getCompletedDays } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { LESSONS } from "@/content/lessons";
import { isDayFree } from "@/content/kingdomZones";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { chessSchoolProgress } from "@/lib/school/chessSchool";
import { prefersNeutralHomeTone } from "@/lib/learner/experienceLevel";
import { ChessSchoolModePresentation } from "@/components/chessSchool/ChessSchoolModePresentation";
import { ClassicChessSchool } from "@/components/chessSchool/classic/ClassicChessSchool";
import { AdultChessSchool } from "@/components/chessSchool/adult/AdultChessSchool";
import { KidsChessSchool } from "@/components/chessSchool/kids/KidsChessSchool";
import type { ChessSchoolData } from "@/components/chessSchool/types";

export const metadata = {
  title: "Chess School · Chess Mind",
  description: "Speak Chess in 30 Days — learn chess step by step, one day at a time.",
};

/**
 * Chess School — the course home.
 *
 * Home lists the thirty day cards and answers "what next"; this page answers
 * "what is this course, what am I learning, and how far through am I". It is
 * deliberately the LIGHTEST personalised page in the app: the active child,
 * their completed days and the premium row. Three reads, two of them in
 * parallel. No stats, no quests, no achievements — those live on Home and
 * re-fetching them here would be the redundant work the performance pass
 * removed elsewhere.
 *
 * Every number on this page comes from child_lesson_progress. There is no
 * placeholder progress anywhere on it: when a learner has finished nothing,
 * it says so.
 */
export default async function ChessSchoolPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;

  const parentPromise = Promise.resolve(
    supabase.from("parents").select(PARENT_PREMIUM_COLUMNS).eq("auth_user_id", user.id).single()
  );
  void parentPromise.catch(() => {});

  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;

  const [completedDays, { data: parent }] = await Promise.all([
    getCompletedDays(supabase, child.id),
    parentPromise,
  ]);

  const isPremium = resolvePremiumState(parent).isPremium;
  const progress = chessSchoolProgress({
    currentDay: child.current_day ?? 1,
    completedDays,
  });
  const neutralTone = prefersNeutralHomeTone(child.experience_level, child.age_band);
  const lockedDays = isPremium
    ? []
    : LESSONS.map((l) => l.dayNumber).filter((d) => !isDayFree(d));

  const resumeLesson = LESSONS.find((l) => l.dayNumber === progress.resumeDay);

  const chessSchoolData: ChessSchoolData = {
    progress,
    completedDays,
    lockedDays,
    neutralTone,
    resumeLesson,
  };

  return (
    <TabPageShell maxWidth="wide" contentClassName="chess-school-mode-scope">
      <ChessSchoolModePresentation
        classicPro={<ClassicChessSchool data={chessSchoolData} />}
        adult={<AdultChessSchool data={chessSchoolData} />}
        kids={<KidsChessSchool data={chessSchoolData} />}
      />
    </TabPageShell>
  );
}
