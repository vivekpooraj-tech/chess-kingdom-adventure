import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { ACHIEVEMENTS } from "@/content/achievements";
import { getZoneForDay, isDayFree } from "@/content/kingdomZones";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server";
import {
  resolveActiveChild,
  getCompletedDays,
  evaluateAndAwardAchievements,
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
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HeroJourneyCard } from "@/components/home/HeroJourneyCard";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DestinationCard } from "@/components/home/DestinationCard";
import { PlayIcon, AcademyIcon, DiscoverIcon } from "@/components/nav/icons";
import { StatCardCompact } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEXT } from "@/lib/designSystem";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);

  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
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

  // Evaluated on every Kingdom Map visit — cheap, idempotent (won't
  // double-award), and this is where a child lands after every lesson
  // completion and every successful premium purchase, so it's the natural
  // single place to catch newly-earned achievements. This writes new
  // achievement rows, and the read right after it needs to see those new
  // rows, so both stay sequential rather than joining the batch above.
  const { newlyEarned: justEarnedKeys, allEarned: earnedKeys } = await evaluateAndAwardAchievements(
    supabase,
    child.id,
    completedDays,
    isPremium,
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWinsCount
  );

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
      <main className="min-h-screen flex flex-col items-center gap-6 bg-premium-midnight px-6 pt-8 pb-24">
        <div className="text-center max-w-md">
          <h1 className={TEXT.display}>Chess Mind</h1>
          <p className={`${TEXT.body} mt-2`}>What should we do today?</p>
        </div>

        <HomeHeader
          displayName={child.display_name}
          avatar={avatar}
          zone={currentZone}
          currentDay={child.current_day}
          totalDays={LESSONS.length}
          streak={chessMindStreak}
          rating={child.rating}
        />

        <DailyChallengeCard />

        <HeroJourneyCard recommendation={heroRecommendation} />

        {kingdomBonuses.length > 0 && (
          <Link
            href="/learn"
            className="w-full max-w-md rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform duration-100"
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

        {/* Recommended activity — Play / Learn / Discover (Phase 19: Academy
            and Chess Mind are combined into Learn; Discover moved here from
            the primary nav — neither lost its route, see app/learn/page.tsx
            and app/discover/page.tsx, both still fully intact). One strong
            CTA per card, not a menu of sub-links (see DestinationCard). */}
        <div className="w-full max-w-md flex flex-col gap-2">
          <SectionHeader title="Recommended" />
          <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* Stats — compact, real numbers, links out to the full Profile for
            anything that needs more than a glance. */}
        <div className="w-full max-w-md flex flex-col gap-2">
          <SectionHeader title="Your Stats" />
          <Link
            href="/profile"
            className="grid grid-cols-4 gap-2 rounded-premiumCard bg-premium-navy/70 border border-white/5 p-3 hover:border-premium-gold/20 active:scale-[0.98] transition-[border-color,transform] duration-100"
          >
            <StatCardCompact value={onlineWinsCount} label="Online Wins" />
            <StatCardCompact value={`${earnedKeys.length}/${ACHIEVEMENTS.length}`} label="Achievements" />
            <StatCardCompact value={openingEncounters.length} label="Openings" />
            <StatCardCompact value={chessMindTotalSolved} label="Chess Mind" />
          </Link>
        </div>

        <div className="flex items-center gap-3 self-start w-full max-w-md">
          <span className="text-3xl">{buddy.emoji}</span>
          <p className="font-body text-premium-ivory/60 text-sm">
            {buddy.name} is exploring the Kingdom with you!
          </p>
        </div>

        <h2 id="journey" className={`${TEXT.heading} text-center scroll-mt-8`}>
          Your Kingdom Journey {currentZone.emoji}
        </h2>

        <KingdomMapCards
          lessons={LESSONS}
          currentDay={child.current_day}
          completedDays={completedDays}
          isPremium={isPremium}
        />

        <h2 id="achievements" className={`${TEXT.heading} text-center scroll-mt-8`}>
          Achievements
        </h2>
        <AchievementBadges earnedKeys={earnedKeys} justEarnedKeys={justEarnedKeys} />

        <Link
          href="/parent-gate?next=/parent-dashboard"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2 mt-4"
        >
          For Parents
        </Link>
      </main>
      </ScreenTimeGate>
      <PrimaryNav />
    </>
  );
}
