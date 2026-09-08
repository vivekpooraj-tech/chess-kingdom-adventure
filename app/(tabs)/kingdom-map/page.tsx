import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { getZoneForDay } from "@/content/kingdomZones";
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
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { KingdomMapCards } from "./KingdomMapCards";
import { KingdomMapAchievements } from "./KingdomMapAchievements";
import { KingdomMapAchievementCount } from "./KingdomMapAchievementCount";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HeroJourneyCard } from "@/components/home/HeroJourneyCard";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DailyQuestsCard } from "@/components/home/DailyQuestsCard";
import { ChessSchoolCard } from "@/components/school/ChessSchoolCard";
import { DestinationCard } from "@/components/home/DestinationCard";
import { PlayIcon, AcademyIcon, DiscoverIcon } from "@/components/nav/icons";
import { StatCardCompact } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";
import { getHomeLeadRecommendation } from "@/lib/home/getHomeLead";
import { getDailyQuestActivity } from "@/lib/quests/questQueries";
import { selectDailyQuests } from "@/lib/quests/dailyQuests";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { recommendPractice, type PracticeLessonItem } from "@/lib/training/recommendation";
import { getSkill } from "@/lib/analysis/skills";
import {
  prefersNeutralHomeTone,
} from "@/lib/learner/experienceLevel";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);

  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;

  // The premium/parent row keys off the auth user, not the active child, so it
  // does not need to wait for the child to be resolved. Starting it here lets
  // it overlap the (uncached) child-resolution round-trip instead of queueing
  // behind it — this route pays a full cross-region round-trip per query, so
  // every layer removed from the critical path counts. It is still awaited in
  // the batch below, so a genuine failure surfaces exactly as before; the bare
  // .catch() only marks the promise handled so an early redirect below can't
  // turn it into an unhandled rejection. Promise.resolve() both starts the
  // (lazily-executed) query builder now and returns a real promise to guard.
  const parentPromise = Promise.resolve(
    supabase.from("parents").select(PARENT_PREMIUM_COLUMNS).eq("auth_user_id", user.id).single()
  );
  void parentPromise.catch(() => {});

  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.experience_level) redirect("/onboarding/experience");
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
    skillSignals,
    questActivity,
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
    // Joins the existing parallel batch rather than adding a sequential layer.
    // Reviews aren't fetched here: the lead only needs the focus skill, and
    // deriveLearnerProfile derives that from signals alone (reviews only feed
    // the accuracy trend, which this card doesn't show).
    getSkillSignals(supabase, child.id).catch(() => ({})),
    // Three cheap indexed count queries, run as part of this same wave rather
    // than as a new sequential layer. Never rejects — each source degrades to
    // null on its own and is then omitted from the card (see questQueries.ts).
    getDailyQuestActivity(supabase, child.id),
  ]);
  const isPremium = resolvePremiumState(parent).isPremium;
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
  // The lesson the learner is actually on, so Chess School can name it
  // ("Day 12 of 30 · The Knight's Secret Outpost") rather than showing a bare
  // number. Looked up from the already-imported LESSONS — no query.
  const currentLesson = LESSONS.find((l) => l.dayNumber === child.current_day) ?? null;

  // Turn a recurring weakness into a concrete destination, reusing the Game
  // Review's skill-to-lesson mapping so Home, Learn and the review all point
  // at the same lesson for a given skill.
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

  const heroRecommendation = getHomeLeadRecommendation({
    experienceLevel: child.experience_level,
    currentDay: child.current_day,
    isPremium,
    zoneEmoji: currentZone.emoji,
    focus: focusLead,
  });

  const neutralTone = prefersNeutralHomeTone(child.experience_level, child.age_band);

  // Pure and deterministic for (child, date, level) — the same three quests
  // all day, with progress read from the activity tables above. No quest state
  // is stored anywhere; see lib/quests/dailyQuests.ts for why.
  const questSet = selectDailyQuests({
    childId: child.id,
    date: localDateString(),
    experienceLevel: child.experience_level,
    ageBand: child.age_band ?? null,
    activity: questActivity,
  });

  return (
    <>
      <ScreenTimeGate
        childId={child.id}
        initialLimitMinutes={screenTimeStatus.limitMinutes}
        initialUsedMinutes={screenTimeStatus.usedMinutes}
      >
      <TabPageShell>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 text-left">
            <h1 className={TEXT.display}>Chess Mind</h1>
            <p className={`${TEXT.body} mt-2`}>
              {neutralTone ? "Ready to improve?" : "What should we do today?"}
            </p>
          </div>
          <div className="w-full min-w-0 lg:w-80 lg:shrink-0">
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <DailyChallengeCard childId={child.id} />
          <div className="xl:col-span-2">
            <HeroJourneyCard recommendation={heroRecommendation} />
          </div>
        </div>

        <DailyQuestsCard set={questSet} neutralTone={neutralTone} />

        {kingdomBonuses.length > 0 && (
          <Link
            href="/learn"
            className="w-full rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform duration-100"
          >
            <span className="text-2xl">✨</span>
            <div className="flex-1">
              <p className="font-classic-body text-[11px] font-semibold text-premium-gold uppercase tracking-wide">
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
          <div
            className="auto-grid"
            style={{ "--grid-min": "13.5rem", "--grid-gap": "0.75rem" } as React.CSSProperties}
          >
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

        {!neutralTone && (
          <div className="flex items-center gap-3 w-full rounded-premiumCard bg-premium-navy/40 border border-white/5 px-4 py-3">
            <span className="text-3xl">{buddy.emoji}</span>
            <p className="font-body text-premium-ivory/60 text-sm">
              {buddy.name} is exploring the Kingdom with you!
            </p>
          </div>
        )}

        <div
          className="auto-grid items-start"
          style={{ "--grid-min": "22rem", "--grid-gap": "clamp(1.5rem, 4vw, 2.5rem)" } as React.CSSProperties}
        >
          <section className="min-w-0">
            <h2 id="journey" className={`${TEXT.heading} scroll-mt-8 mb-4`}>
              Your Kingdom Journey {currentZone.emoji}
            </h2>
            {/* The course header above the day cards. Drawn from the SAME
                current_day and completedDays the cards below use, so the
                "12 of 30" and the ticks can never disagree — and it costs no
                extra query, since Home already has both. */}
            <div className="mb-4">
              <ChessSchoolCard
                currentDay={child.current_day}
                completedDays={completedDays}
                currentLessonTitle={currentLesson?.title ?? null}
                neutralTone={neutralTone}
              />
            </div>
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
          className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
        >
          For Parents
        </Link>
      </TabPageShell>
      </ScreenTimeGate>
    </>
  );
}
