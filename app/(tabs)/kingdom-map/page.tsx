import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { getZoneForDay, isDayFree } from "@/content/kingdomZones";
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
} from "@/lib/supabase/queries";
import { getUnlockedKingdomBonuses } from "@/lib/chessMind/kingdomUnlocks";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { KingdomMapCards } from "./KingdomMapCards";
import { KingdomMapAchievements } from "./KingdomMapAchievements";
import { KingdomMapAchievementCount } from "./KingdomMapAchievementCount";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HeroJourneyCard } from "@/components/home/HeroJourneyCard";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DestinationCard } from "@/components/home/DestinationCard";
import { PlayIcon, AcademyIcon, DiscoverIcon } from "@/components/nav/icons";
import { StatCardCompact } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);

  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const buddy = BUDDIES.find((b) => b.id === child.buddy_id) ?? BUDDIES[0];

  // These reads are all independent of each other — previously awaited one
  // at a time (each paying its own round-trip in sequence), which was the
  // main cost behind Kingdom Map feeling slow to land on. Only the two
  // calls after this block have a real dependency (on these results, and
  // on each other), so they're the only ones still sequential.
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
  ] = await Promise.all([
    getCompletedDays(supabase, child.id),
    supabase.from("parents").select("premium_status").eq("auth_user_id", user.id).single(),
    getCompletedAcademyContentIds(supabase, child.id),
    getOpeningEncounters(supabase, child.id),
    getChessMindTotalSolved(supabase, child.id),
    getOnlineWinsCount(supabase, child.id),
    getChessMindStatsByModule(supabase, child.id).catch(() => ({})),
    getChessMindStreak(supabase, child.id).catch(() => 0),
    getScreenTimeStatus(supabase, user.id, child.id),
  ]);
  const isPremium = parent?.premium_status === "premium";
  const kingdomBonuses = getUnlockedKingdomBonuses(chessMindStatsByModule);

  // Achievement evaluation (a write, then a dependent read -- the most
  // sequential, slowest single step on this page, per the Phase 4
  // performance audit) now streams in via its own Suspense boundaries
  // below instead of blocking the rest of Home behind it. See
  // achievementsData.ts, KingdomMapAchievementCount.tsx, and
  // KingdomMapAchievements.tsx.
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
  const currentZone = getZoneForDay(Math.min(child.current_day, LESSONS.length));

  // The home screen's single top recommendation: the next lesson in the
  // Kingdom Journey while there's one left, otherwise nudge back into
  // practice (puzzles) — a real, deterministic "what should I do next"
  // rather than a canned message.
  const nextLesson = LESSONS.find((l) => l.dayNumber === child.current_day);
  const heroRecommendation = nextLesson
    ? ({
        kind: "lesson" as const,
        dayNumber: nextLesson.dayNumber,
        title: nextLesson.title,
        storyBeat: nextLesson.storyBeat,
        zoneEmoji: currentZone.emoji,
        locked: !isDayFree(nextLesson.dayNumber) && !isPremium,
      } as const)
    : ({ kind: "practice" as const } as const);

  return (
    <>
      <ScreenTimeGate
        childId={child.id}
        initialLimitMinutes={screenTimeStatus.limitMinutes}
        initialUsedMinutes={screenTimeStatus.usedMinutes}
      >
      <TabPageShell>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="text-left">
            <h1 className={TEXT.display}>Chess Mind</h1>
            <p className={`${TEXT.body} mt-2`}>What should we do today?</p>
          </div>
          <div className="w-full lg:max-w-sm flex-none">
            <HomeHeader
              displayName={child.display_name}
              avatar={avatar}
              zone={currentZone}
              currentDay={child.current_day}
              totalDays={LESSONS.length}
              streak={chessMindStreak}
              rating={child.rating}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DailyChallengeCard childId={child.id} />
          <div className="lg:col-span-2">
            <HeroJourneyCard recommendation={heroRecommendation} />
          </div>
        </div>

        {kingdomBonuses.length > 0 && (
          <Link
            href="/learn"
            className="w-full rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform duration-100"
          >
            <span className="text-2xl">✨</span>
            <div className="flex-1">
              <p className="font-classic-body text-[10px] font-semibold text-premium-gold uppercase tracking-wide">
                Chess Mind Bonus
              </p>
              <p className="font-classic-body text-sm text-premium-ivory/80">
                {kingdomBonuses.map((b) => b.label).join(" · ")}
              </p>
            </div>
          </Link>
        )}

        <section className="w-full flex flex-col gap-2">
          <SectionHeader title="Recommended" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <DestinationCard
              href="/play"
              title="Play"
              description="Computer, worldwide, or a friend"
              icon={PlayIcon}
            />
            <DestinationCard
              href="/learn"
              title="Learn"
              description="Fundamentals, Origins, Openings, Chess Mind training"
              icon={AcademyIcon}
              accent="emerald"
            />
            <DestinationCard
              href="/discover"
              title="Discover"
              description="The pieces and the history of chess"
              icon={DiscoverIcon}
              accent="emerald"
            />
          </div>
        </section>

        <section className="w-full flex flex-col gap-2">
          <SectionHeader title="Your Stats" />
          <Link
            href="/profile"
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-premiumCard bg-premium-navy/70 border border-white/5 p-3 hover:border-premium-gold/20 active:scale-[0.98] transition-[border-color,transform] duration-100"
          >
            <StatCardCompact value={onlineWinsCount} label="Online Wins" />
            <Suspense fallback={<StatCardCompact value="…" label="Achievements" />}>
              <KingdomMapAchievementCount {...achievementsProps} />
            </Suspense>
            <StatCardCompact value={openingEncounters.length} label="Openings" />
            <StatCardCompact value={chessMindTotalSolved} label="Chess Mind" />
          </Link>
        </section>

        <div className="flex items-center gap-3 w-full rounded-premiumCard bg-premium-navy/40 border border-white/5 px-4 py-3">
          <span className="text-3xl">{buddy.emoji}</span>
          <p className="font-body text-premium-ivory/60 text-sm">
            {buddy.name} is exploring the Kingdom with you!
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-10">
          <section className="min-w-0">
            <h2 id="journey" className={`${TEXT.heading} scroll-mt-8 mb-4`}>
              Your Kingdom Journey {currentZone.emoji}
            </h2>
            <KingdomMapCards
              lessons={LESSONS}
              currentDay={child.current_day}
              completedDays={completedDays}
              isPremium={isPremium}
            />
          </section>

          <section className="min-w-0">
            <h2 id="achievements" className={`${TEXT.heading} scroll-mt-8 mb-4`}>
              Achievements
            </h2>
            <Suspense fallback={<SkeletonBlock className="w-full h-40" />}>
              <KingdomMapAchievements {...achievementsProps} />
            </Suspense>
          </section>
        </div>

        <Link
          href="/parent-gate?next=/parent-dashboard"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          For Parents
        </Link>
      </TabPageShell>
      </ScreenTimeGate>
    </>
  );
}
