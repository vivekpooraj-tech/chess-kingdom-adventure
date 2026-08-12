import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { ACHIEVEMENTS } from "@/content/achievements";
import { getZoneForDay, isDayFree } from "@/content/kingdomZones";
import { getDailyPuzzle } from "@/content/puzzles";
import { createClient } from "@/lib/supabase/server";
import {
  resolveActiveChild,
  getCompletedDays,
  evaluateAndAwardAchievements,
  getEarnedAchievementKeys,
  getCompletedAcademyContentIds,
  getOpeningEncounters,
  getChessMindTotalSolved,
  getChessMindStatsByModule,
  getChessMindStreak,
  getOnlineWinsCount,
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
import { PlayIcon, AcademyIcon, ChessMindIcon, DiscoverIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const completedDays = await getCompletedDays(supabase, child.id);
  const buddy = BUDDIES.find((b) => b.id === child.buddy_id) ?? BUDDIES[0];

  const { data: parent } = await supabase
    .from("parents")
    .select("premium_status")
    .eq("auth_user_id", user.id)
    .single();
  const isPremium = parent?.premium_status === "premium";

  // Evaluated on every Kingdom Map visit — cheap, idempotent (won't
  // double-award), and this is where a child lands after every lesson
  // completion and every successful premium purchase, so it's the natural
  // single place to catch newly-earned achievements.
  const completedAcademyIds = await getCompletedAcademyContentIds(supabase, child.id);
  const openingEncounters = await getOpeningEncounters(supabase, child.id);
  const chessMindTotalSolved = await getChessMindTotalSolved(supabase, child.id);
  const onlineWinsCount = await getOnlineWinsCount(supabase, child.id);
  const chessMindStatsByModule = await getChessMindStatsByModule(supabase, child.id).catch(() => ({}));
  const kingdomBonuses = getUnlockedKingdomBonuses(chessMindStatsByModule);
  const chessMindStreak = await getChessMindStreak(supabase, child.id).catch(() => 0);
  const justEarnedKeys = await evaluateAndAwardAchievements(
    supabase,
    child.id,
    completedDays,
    isPremium,
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWinsCount
  );
  const earnedKeys = await getEarnedAchievementKeys(supabase, child.id);

  const avatar = AVATARS.find((a) => a.id === child.avatar_id);
  const currentZone = getZoneForDay(Math.min(child.current_day, LESSONS.length));
  const dailyPuzzle = getDailyPuzzle();

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
      <ScreenTimeGate childId={child.id}>
      <main className="min-h-screen flex flex-col items-center gap-6 bg-premium-midnight px-6 pt-8 pb-24">
        <HomeHeader
          displayName={child.display_name}
          avatar={avatar}
          zone={currentZone}
          currentDay={child.current_day}
          totalDays={LESSONS.length}
          streak={chessMindStreak}
        />

        <HeroJourneyCard recommendation={heroRecommendation} />

        <DailyChallengeCard puzzle={dailyPuzzle} />

        {kingdomBonuses.length > 0 && (
          <Link
            href="/chess-mind"
            className="w-full max-w-md rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-4 flex items-center gap-3"
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

        {/* Main destinations — Play / Academy / Chess Mind / Discover. One
            strong CTA per card, not a menu of sub-links (see DestinationCard). */}
        <div className="w-full max-w-md grid grid-cols-2 gap-3">
          <DestinationCard
            href="/play"
            title="Play"
            description="Computer, worldwide, or a friend"
            icon={PlayIcon}
          />
          <DestinationCard
            href="/academy"
            title="Academy"
            description="Journey, Fundamentals, Origins, Openings"
            icon={AcademyIcon}
            accent="emerald"
          />
          <DestinationCard
            href="/chess-mind"
            title="Chess Mind"
            description="Pattern, memory, visualization training"
            icon={ChessMindIcon}
          />
          <DestinationCard
            href="/discover"
            title="Discover"
            description="The pieces and the history of chess"
            icon={DiscoverIcon}
            accent="emerald"
          />
        </div>

        {/* Progress — compact, real numbers, links out to the full Profile
            for anything that needs more than a glance. */}
        <div className="w-full max-w-md">
          <p className={`${TEXT.caption} uppercase tracking-wide mb-2`}>Progress</p>
          <Link
            href="/profile"
            className="grid grid-cols-4 gap-2 rounded-premiumCard bg-premium-navy/70 border border-white/5 p-3 hover:border-premium-gold/20 transition-colors"
          >
            <StatTile value={child.rating.toLocaleString()} label="Rating" />
            <StatTile value={`${earnedKeys.length}/${ACHIEVEMENTS.length}`} label="Achievements" />
            <StatTile value={openingEncounters.length} label="Openings" />
            <StatTile value={chessMindTotalSolved} label="Chess Mind" />
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

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-classic-display text-base text-premium-ivory">{value}</p>
      <p className="font-classic-body text-[9px] text-premium-ivory/50 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
