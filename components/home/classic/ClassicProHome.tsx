import Link from "next/link";
import { Suspense } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningEncounterDetail, PlayedGameRow, RecentReviewRow } from "@/lib/supabase/queries";
import type { AvatarOption, BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";
import type { DailyQuestSet } from "@/lib/quests/dailyQuests";
import type { UnlockedBonus } from "@/lib/chessMind/kingdomUnlocks";
import { HomeAchievementsPreview } from "@/app/(tabs)/kingdom-map/HomeAchievementsPreview";
import { KingdomMapAchievementCount } from "@/app/(tabs)/kingdom-map/KingdomMapAchievementCount";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { HomeProfileStrip } from "@/components/home/HomeProfileStrip";
import { HomeHeroSection } from "@/components/home/HomeHeroSection";
import { ActivityTileGrid } from "@/components/home/ActivityTileGrid";
import { DestinationCard } from "@/components/home/DestinationCard";
import { RecentGamesPreview } from "@/components/home/classic/RecentGamesPreview";
import { TournamentsPreview } from "@/components/home/classic/TournamentsPreview";
import { TacticalPuzzlePanel } from "@/components/home/classic/TacticalPuzzlePanel";
import { DailyQuestsCard } from "@/components/home/DailyQuestsCard";
import { ChessMindIcon } from "@/components/nav/icons";
import { StatCardCompact } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEXT } from "@/lib/designSystem";

type TournamentParticipation = {
  tournamentId: string;
  tournamentName: string;
  status: string;
  points: number;
  allPoints: number[];
  endedAt: string | null;
};

/**
 * The Classic/Pro Home composition (Phase 2.1-B — the real "Play &
 * Matchmaking" Stitch redesign). page.tsx still owns 100% of the data
 * fetching, auth/redirect checks, and business-logic computation
 * (getPrimaryAction, getOllieHomeLine, selectDailyQuests, achievement
 * evaluation via the Suspense boundaries below, getPlayedGames,
 * getTournamentParticipations) — this component only receives the results
 * as props and composes them into the Stitch section layout. No query, no
 * redirect, no mutation lives here.
 *
 * Structural changes from the pre-2.1-B layout (see the Phase 2.1-B report
 * for the full Stitch-section mapping):
 *   - Recent Games + Tournaments are NEW Home sections, reusing
 *     getPlayedGames()/getTournamentParticipations() (already used by
 *     /games and /stats) rather than new queries.
 *   - Play/Puzzles/World/Learn quick access (ActivityTileGrid, unchanged)
 *     moved directly under the hero, matching Stitch's compact multi-tile
 *     row placement.
 *   - Everything else (Today, Discover, Progress, Achievements, For
 *     Parents) is the same component, same data, same position relative
 *     to the new sections — none of it was removed.
 *
 * This is deliberately the ONLY populated file under components/home/classic/
 * — no components/home/kids/ or components/home/adult/ exist yet, because
 * their Home compositions don't exist yet either.
 */
export function ClassicProHome({
  neutralTone,
  displayName,
  avatar,
  streak,
  rating,
  primaryAction,
  buddy,
  ollieLine,
  childId,
  questSet,
  kingdomBonuses,
  onlineWinsCount,
  openingEncountersCount,
  chessMindTotalSolved,
  achievementsProps,
  recentGames,
  recentReviews,
  tournamentParticipations,
}: {
  neutralTone: boolean;
  displayName: string;
  avatar: AvatarOption | undefined;
  streak: number;
  rating?: number;
  primaryAction: PrimaryAction;
  buddy: BuddyOption;
  ollieLine: string;
  childId: string;
  questSet: DailyQuestSet;
  kingdomBonuses: UnlockedBonus[];
  onlineWinsCount: number;
  openingEncountersCount: number;
  chessMindTotalSolved: number;
  achievementsProps: {
    supabase: SupabaseClient;
    childId: string;
    completedDays: number[];
    isPremium: boolean;
    completedAcademyIds: string[];
    openingEncounters: OpeningEncounterDetail[];
    chessMindTotalSolved: number;
    onlineWinsCount: number;
  };
  recentGames: PlayedGameRow[];
  recentReviews: RecentReviewRow[];
  tournamentParticipations: TournamentParticipation[];
}) {
  return (
    <>
      <header className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 text-left">
            <h1 className={`${TEXT.display} text-[clamp(1.25rem,1rem+1.2vw,2rem)] leading-[1.1]`}>
              Chess Mind
            </h1>
            <p className={`${TEXT.body} mt-1`}>
              {neutralTone ? "Ready to improve?" : "What should we do today?"}
            </p>
          </div>
          <HomeProfileStrip displayName={displayName} avatar={avatar} streak={streak} rating={rating} />
        </div>
      </header>

      {/*
        MAIN DASHBOARD (Phase 2.1-B.1) — hero full-width, then a genuine
        two-column grid at desktop (lg+) rather than another stacked card:
        left/main column groups "what you've been playing" (Recent Games +
        Tactical Puzzle Zone), right/side column groups "your competitive
        record" (Tournaments + Progress). Collapses to a single sensible
        column at tablet/mobile widths (no raw grid-collapse — see the
        explicit grid-cols-1 base + lg:grid-cols-3 step). Every section
        here already existed before this phase; only the layout and the
        cp-* presentation classes (see app/modes.css, gated to true
        classic-pro only) are new.
      */}
      <div className="cp-dashboard flex w-full flex-col gap-3 lg:gap-4">
        <div className="home-hero-grid">
          <HomeHeroSection
            action={primaryAction}
            buddy={buddy}
            ollieLine={ollieLine}
            neutralTone={neutralTone}
          />
          <ActivityTileGrid />
        </div>

        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <RecentGamesPreview games={recentGames} reviews={recentReviews} />
            <TacticalPuzzlePanel childId={childId} />
          </div>
          <div className="flex flex-col gap-3">
            <TournamentsPreview participations={tournamentParticipations} />
            <div className="cp-panel home-surface-card flex flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
              <div className="flex flex-col gap-0.5">
                <p className="cp-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
                  Performance
                </p>
                <Link href="/profile" className={TEXT.heading}>
                  Your Progress
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatCardCompact value={onlineWinsCount} label="Online Wins" />
                <Suspense fallback={<StatCardCompact value="…" label="Achievements" />}>
                  <KingdomMapAchievementCount {...achievementsProps} />
                </Suspense>
                <StatCardCompact value={openingEncountersCount} label="Openings" />
                <StatCardCompact value={chessMindTotalSolved} label="Chess Mind" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
        SECONDARY ZONE — sections that stay real and reachable but are
        deliberately de-emphasised for Classic/Pro (Stitch's reference
        doesn't show them at all for this mode): Discover, Daily Quests
        (Daily Challenge itself moved up into the Tactical Puzzle Zone
        above — see TacticalPuzzlePanel), Achievements, For Parents. Same
        components, same data, same routes as before this phase; only
        position and the dimmed .cp-secondary treatment changed.
      */}
      <div className="cp-secondary flex w-full flex-col gap-4">
        <section className="flex w-full flex-col gap-2">
          <SectionHeader title="Discover" className="home-section-heading" />
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
              <span className="text-2xl">✨</span>
              <div className="flex-1">
                <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-gold">
                  Chess Mind Bonus
                </p>
                <p className="font-classic-body text-sm text-premium-ivory/80">
                  {kingdomBonuses.map((b) => b.label).join(" · ")}
                </p>
              </div>
            </Link>
          )}
        </section>

        <DailyQuestsCard set={questSet} neutralTone={neutralTone} />

        <Suspense fallback={<SkeletonBlock className="h-28 w-full" />}>
          <HomeAchievementsPreview {...achievementsProps} />
        </Suspense>

        <Link
          href="/parent-gate?next=/parent-dashboard"
          className="inline-flex min-h-[44px] items-center font-body text-sm text-premium-ivory/65 underline underline-offset-2"
        >
          For Parents
        </Link>
      </div>
    </>
  );
}
