import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server";
import {
  resolveActiveChildCached,
  getCompletedDays,
  getCompletedAcademyContentIds,
  getOpeningEncounters,
  getChessMindTotalSolved,
  getChessMindStatsByModule,
  getChessMindStreak,
  getOnlineWinsCount,
  getScreenTimeStatus,
  getSkillSignals,
  getPlayedGames,
  getTournamentParticipations,
  getRecentGameReviews,
  getRatingTimeline,
  localDateString,
} from "@/lib/supabase/queries";
import { getUnlockedKingdomBonuses } from "@/lib/chessMind/kingdomUnlocks";
import { nextRequiredOnboardingStep } from "@/lib/auth/postAuthDestination";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { loadSchoolProgressServer } from "@/lib/school/v2/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { HomeModePresentation } from "@/components/home/HomeModePresentation";
import { ClassicProHome } from "@/components/home/classic/ClassicProHome";
import { AdultHome } from "@/components/home/adult/AdultHome";
import { KidsHome } from "@/components/home/kids/KidsHome";
import { buildImprovementTimeline } from "@/lib/stats/improvementTimeline";
import { getPrimaryAction } from "@/lib/home/getPrimaryAction";
import { getOllieHomeLine } from "@/lib/home/ollieHomeLine";
import { getDailyQuestActivity } from "@/lib/quests/questQueries";
import { selectDailyQuests } from "@/lib/quests/dailyQuests";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { recommendPractice, type PracticeLessonItem } from "@/lib/training/recommendation";
import { getSkill } from "@/lib/analysis/skills";
import { prefersNeutralHomeTone } from "@/lib/learner/experienceLevel";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);

  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;

  const parentPromise = Promise.resolve(
    supabase
      .from("parents")
      .select(`id, ${PARENT_PREMIUM_COLUMNS}`)
      .eq("auth_user_id", user.id)
      .single()
  );
  void parentPromise.catch(() => {});

  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  // Single source of truth for onboarding completeness — see the doc comment
  // on nextRequiredOnboardingStep() in lib/auth/postAuthDestination.ts.
  // Grandfathered users (already have an avatar_id from before name/gender
  // existed as steps) pass straight through even with a null display_name
  // or gender; only genuinely new profiles get routed to the missing step.
  const nextStep = nextRequiredOnboardingStep(child);
  if (nextStep) redirect(nextStep);

  const buddy = BUDDIES.find((b) => b.id === child.buddy_id) ?? BUDDIES[0];
  // Reached here only via the grandfathering path above, where display_name
  // can theoretically still be null — this fallback is a type-safety net,
  // not an expected runtime case for any new profile.
  const displayName = child.display_name ?? "Adventurer";

  const [
    completedDays,
    { data: parent },
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWinsCount,
    chessMindStatsByModule,
    chessMindStreak,
    screenTimeStatus,
    skillSignals,
    questActivity,
    schoolProgress,
    recentGames,
    tournamentParticipations,
    recentReviews,
    ratingTimeline,
  ] = await Promise.all([
    getCompletedDays(supabase, child.id),
    parentPromise,
    getCompletedAcademyContentIds(supabase, child.id),
    getOpeningEncounters(supabase, child.id),
    getChessMindTotalSolved(supabase, child.id),
    getOnlineWinsCount(supabase, child.id),
    getChessMindStatsByModule(supabase, child.id).catch(() => ({})),
    getChessMindStreak(supabase, child.id).catch(() => 0),
    getScreenTimeStatus(supabase, user.id, child.id),
    getSkillSignals(supabase, child.id).catch(() => ({})),
    getDailyQuestActivity(supabase, child.id),
    loadSchoolProgressServer(supabase, child.id),
    getPlayedGames(supabase, child.id, 3).catch(() => []),
    getTournamentParticipations(supabase, child.id).catch(() => []),
    getRecentGameReviews(supabase, child.id, 5).catch(() => []),
    getRatingTimeline(supabase, child.id, 15).catch(() => []),
  ]);
  const isPremium = resolvePremiumState(parent).isPremium;
  const kingdomBonuses = getUnlockedKingdomBonuses(chessMindStatsByModule);

  const achievementsProps = {
    supabase,
    childId: child.id,
    completedDays,
    isPremium,
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWinsCount,
  };

  const avatar = AVATARS.find((a) => a.id === child.avatar_id);

  const learnerProfile = deriveLearnerProfile(skillSignals, []);
  const focusLead = (() => {
    if (!learnerProfile.focusSkill || !learnerProfile.focusSkillWeakCount) return null;
    const practice = recommendPractice({
      skill: learnerProfile.focusSkill,
      experienceLevel: child.experience_level,
      ageBand: child.age_band ?? null,
    });
    const lesson = practice.items.find((i): i is PracticeLessonItem => i.kind === "lesson");
    if (!lesson) return null;
    return {
      skillName: getSkill(learnerProfile.focusSkill).name,
      weakCount: learnerProfile.focusSkillWeakCount,
      href: lesson.href,
    };
  })();

  const primaryAction = getPrimaryAction({
    schoolProgress,
    experienceLevel: child.experience_level,
    focus: focusLead,
  });

  const neutralTone = prefersNeutralHomeTone(child.experience_level, child.age_band);
  const ollieLine = getOllieHomeLine(primaryAction, buddy, neutralTone);

  const questSet = selectDailyQuests({
    childId: child.id,
    date: localDateString(),
    experienceLevel: child.experience_level,
    ageBand: child.age_band ?? null,
    activity: questActivity,
  });

  const improvementTimeline = buildImprovementTimeline(ratingTimeline);

  // Phase 2.1-A: the Classic/Pro composition is built ONCE here (all data/
  // business logic above is unchanged and mode-independent) and handed to
  // HomeModePresentation as all three mode variants. Until the Kids/Adult
  // Stitch designs are implemented, every mode renders this exact element —
  // no duplicate rendering, no duplicate Supabase calls (achievement
  // evaluation is React.cache()-deduped regardless), and Classic/Pro's
  // behavior is unchanged from before this refactor. See
  // components/home/HomeModePresentation.tsx and
  // components/home/classic/ClassicProHome.tsx for why this is safe.
  const classicProHome = (
    <ClassicProHome
      neutralTone={neutralTone}
      displayName={displayName}
      avatar={avatar}
      streak={chessMindStreak}
      rating={child.rating}
      primaryAction={primaryAction}
      buddy={buddy}
      ollieLine={ollieLine}
      childId={child.id}
      questSet={questSet}
      kingdomBonuses={kingdomBonuses}
      onlineWinsCount={onlineWinsCount}
      openingEncountersCount={openingEncounters.length}
      chessMindTotalSolved={chessMindTotalSolved}
      achievementsProps={achievementsProps}
      recentGames={recentGames}
      recentReviews={recentReviews}
      tournamentParticipations={tournamentParticipations}
    />
  );

  // Phase 2.1-C: Adult now gets its own real composition — a genuinely
  // different set of dashboard panels (Opening Repertoire, Recent Reviews,
  // Training Metrics) built from data Home was already fetching or could
  // trivially reach (getOpeningEncounters, getRecentGameReviews,
  // learnerProfile, getRatingTimeline), not ClassicProHome re-skinned.
  // Kids still reuses classicProHome — its own Stitch composition is a
  // later phase.
  const adultHome = (
    <AdultHome
      neutralTone={neutralTone}
      displayName={displayName}
      avatar={avatar}
      streak={chessMindStreak}
      rating={child.rating}
      primaryAction={primaryAction}
      buddy={buddy}
      ollieLine={ollieLine}
      questSet={questSet}
      kingdomBonuses={kingdomBonuses}
      onlineWinsCount={onlineWinsCount}
      openingEncountersCount={openingEncounters.length}
      chessMindTotalSolved={chessMindTotalSolved}
      achievementsProps={achievementsProps}
      openingEncounters={openingEncounters}
      recentReviews={recentReviews}
      learnerProfile={learnerProfile}
      improvementTimeline={improvementTimeline}
    />
  );

  // Phase 2.1-D: Kids now gets its own real composition too — Daily Kingdom
  // Quests, Knight's Royal Chest, and World Discovery Map, all built from
  // data Home already fetches (questSet, the same achievement evaluation
  // every mode shares, and the real static WORLD_LOCATIONS content) rather
  // than ClassicProHome re-skinned. getPrimaryAction()/getOllieHomeLine()
  // are unchanged.
  const kidsHome = (
    <KidsHome
      neutralTone={neutralTone}
      displayName={displayName}
      avatar={avatar}
      streak={chessMindStreak}
      rating={child.rating}
      primaryAction={primaryAction}
      buddy={buddy}
      ollieLine={ollieLine}
      questSet={questSet}
      kingdomBonuses={kingdomBonuses}
      onlineWinsCount={onlineWinsCount}
      openingEncountersCount={openingEncounters.length}
      chessMindTotalSolved={chessMindTotalSolved}
      achievementsProps={achievementsProps}
    />
  );

  return (
    <ScreenTimeGate
      childId={child.id}
      initialLimitMinutes={screenTimeStatus.limitMinutes}
      initialUsedMinutes={screenTimeStatus.usedMinutes}
    >
      <TabPageShell contentClassName="home-mode-scope">
        <HomeModePresentation
          classicPro={classicProHome}
          adult={adultHome}
          kids={kidsHome}
        />
      </TabPageShell>
    </ScreenTimeGate>
  );
}
