import { ForParentsLink } from "@/components/nav/ForParentsLink";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
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
  localDateString,
} from "@/lib/supabase/queries";
import { getUnlockedKingdomBonuses } from "@/lib/chessMind/kingdomUnlocks";
import { PARENT_PREMIUM_COLUMNS, type ParentPremiumRow } from "@/lib/premium/entitlement";
import { resolveCapabilities } from "@/lib/entitlement";
import { loadSchoolProgressServer } from "@/lib/school/v2/queries";
import { SCHOOL_ENTITLEMENT_COLUMNS, type SchoolEntitlementRow } from "@/lib/school/v2/access";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { HomeAchievementsPreview } from "./HomeAchievementsPreview";
import { KingdomMapAchievementCount } from "./KingdomMapAchievementCount";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { HomeProfileStrip } from "@/components/home/HomeProfileStrip";
import { HomeHeroSection } from "@/components/home/HomeHeroSection";
import { ActivityTileGrid } from "@/components/home/ActivityTileGrid";
import { HomeTodaySection } from "@/components/home/HomeTodaySection";
import { DestinationCard } from "@/components/home/DestinationCard";
import { ChessMindIcon } from "@/components/nav/icons";
import { StatCardCompact } from "@/components/ui/StatCard";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { WorldScope } from "@/components/layout/WorldScope";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { ClassicHome } from "@/components/home/classic/ClassicHome";
import { AtelierHome } from "@/components/home/atelier/AtelierHome";
import { WorldSectionHeader, WorldText } from "@/components/home/WorldText";
import { TEXT } from "@/lib/designSystem";
import { parseWorldQuery } from "@/lib/world/worlds";
import { getPrimaryAction } from "@/lib/home/getPrimaryAction";
import { getOllieHomeLine } from "@/lib/home/ollieHomeLine";
import { getDailyQuestActivity } from "@/lib/quests/questQueries";
import { selectDailyQuests } from "@/lib/quests/dailyQuests";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { recommendPractice, type PracticeLessonItem } from "@/lib/training/recommendation";
import { getSkill } from "@/lib/analysis/skills";
import { prefersNeutralHomeTone } from "@/lib/learner/experienceLevel";

export default async function KingdomMapPage({
  searchParams,
}: {
  searchParams?: { world?: string };
}) {
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
  if (!child.experience_level) redirect("/onboarding/experience");
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const buddy = BUDDIES.find((b) => b.id === child.buddy_id) ?? BUDDIES[0];

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
  ]);
  const parentRow = parent as (ParentPremiumRow & { id?: string }) | null;

  let schoolRow: SchoolEntitlementRow | null = null;
  if (parentRow?.id) {
    try {
      const { data } = await supabase
        .from("school_entitlements")
        .select(SCHOOL_ENTITLEMENT_COLUMNS)
        .eq("parent_id", parentRow.id)
        .maybeSingle();
      schoolRow = (data as SchoolEntitlementRow | null) ?? null;
    } catch {
      schoolRow = null;
    }
  }

  const capabilities = resolveCapabilities(parentRow, schoolRow);
  const isPremium = capabilities.isPremium;
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

  const pinnedWorld = parseWorldQuery(searchParams?.world);

  return (
    <>
      <ScreenTimeGate
        childId={child.id}
        initialLimitMinutes={screenTimeStatus.limitMinutes}
        initialUsedMinutes={screenTimeStatus.usedMinutes}
      >
        <WorldScope world={pinnedWorld}>
        <TabPageShell>
          <WorldBranch
            classic={
              <ClassicHome
                childId={child.id}
                displayName={child.display_name}
                avatar={avatar}
                rating={typeof child.rating === "number" ? child.rating : null}
                streak={chessMindStreak}
                onlineWins={onlineWinsCount}
                isPremium={isPremium}
                primaryAction={primaryAction}
                questSet={questSet}
                neutralTone={neutralTone}
                milestones={kingdomBonuses.map((b) => b.label)}
                ageBand={child.age_band ?? null}
              />
            }
            atelier={
              <>
                <AtelierHome
                  childId={child.id}
                  displayName={child.display_name}
                  rating={typeof child.rating === "number" ? child.rating : null}
                  streak={chessMindStreak}
                  totalSolved={chessMindTotalSolved}
                  statsByModule={chessMindStatsByModule}
                  openingCount={openingEncounters.length}
                  primaryAction={primaryAction}
                  focus={focusLead}
                  questSet={questSet}
                  neutralTone={neutralTone}
                />
                <ForParentsLink ageBand={child.age_band} />
              </>
            }
            other={
          <>
          <header className="world-enter flex w-full flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 text-left">
                <p className="world-kicker">
                  <WorldText
                    enchanted="Enchanted Kingdom"
                    atelier="Master Training Atelier"
                    classic="Classic Pro"
                  />
                </p>
                <h1
                  className={`world-title ${TEXT.display} text-[clamp(1.25rem,1rem+1.2vw,2rem)] leading-[1.1]`}
                >
                  Chess Mind
                </h1>
                <p className={`${TEXT.body} mt-1`}>
                  {neutralTone ? (
                    <WorldText
                      enchanted="Ready to improve?"
                      atelier="Ready to improve?"
                      classic="Ready to play."
                    />
                  ) : (
                    <WorldText
                      enchanted="What should we do today?"
                      atelier="What should we do today?"
                      classic="Your move."
                    />
                  )}
                </p>
              </div>
              <HomeProfileStrip
                displayName={child.display_name}
                avatar={avatar}
                streak={chessMindStreak}
                rating={child.rating}
              />
            </div>
          </header>

          <div className="home-hero-grid world-enter world-enter-delay-1">
            <HomeHeroSection action={primaryAction} buddy={buddy} ollieLine={ollieLine} />
            <ActivityTileGrid />
          </div>

          <HomeTodaySection childId={child.id} set={questSet} neutralTone={neutralTone} />

          <section className="world-enter world-enter-delay-2 flex w-full flex-col gap-2">
            <WorldSectionHeader
              enchanted="Explore"
              atelier="Training Focus"
              classic="The Club"
            />
            <div
              className="auto-grid"
              style={{ "--grid-min": "13.5rem", "--grid-gap": "0.75rem" } as React.CSSProperties}
            >
              <DestinationCard
                href="/chess-mind"
                title="Train Your Mind"
                description="Short daily brain workouts, built for chess"
                icon={ChessMindIcon}
                accent="emerald"
              />
            </div>
            {kingdomBonuses.length > 0 && (
              <Link
                href="/learn"
                className="flex w-full items-center gap-3 rounded-premiumCard border border-premium-gold/30 bg-premium-gold/10 p-4 transition-transform duration-100 active:scale-[0.98]"
              >
                <span className="world-bonus-sparkle text-2xl">✨</span>
                <div className="flex-1">
                  <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-gold">
                    <WorldText
                      enchanted="Chess Mind Bonus"
                      atelier="Training Milestone"
                      classic="Milestone"
                    />
                  </p>
                  <p className="font-classic-body text-sm text-premium-ivory/80">
                    {kingdomBonuses.map((b) => b.label).join(" · ")}
                  </p>
                </div>
              </Link>
            )}
          </section>

          <section className="flex w-full flex-col gap-2">
            <WorldSectionHeader enchanted="Your Progress" atelier="Mastery" classic="Record" />
            <Link
              href="/profile"
              className="grid grid-cols-2 gap-2 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-3 transition-[border-color,transform] duration-100 hover:border-premium-gold/20 active:scale-[0.98] sm:grid-cols-4"
            >
              <StatCardCompact value={onlineWinsCount} label="Online Wins" />
              <Suspense fallback={<StatCardCompact value="…" label="Achievements" />}>
                <KingdomMapAchievementCount {...achievementsProps} />
              </Suspense>
              <StatCardCompact value={openingEncounters.length} label="Openings" />
              <StatCardCompact value={chessMindTotalSolved} label="Chess Mind" />
            </Link>
          </section>

          <Suspense fallback={<SkeletonBlock className="h-28 w-full" />}>
            <HomeAchievementsPreview {...achievementsProps} />
          </Suspense>

          <ForParentsLink ageBand={child.age_band} />
          </>
            }
          />
        </TabPageShell>
        </WorldScope>
      </ScreenTimeGate>
    </>
  );
}
