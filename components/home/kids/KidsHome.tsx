import Link from "next/link";
import { Suspense } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningEncounterDetail } from "@/lib/supabase/queries";
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
import { DailyKingdomQuestsPanel } from "@/components/home/kids/DailyKingdomQuestsPanel";
import { KnightsChestPanel } from "@/components/home/kids/KnightsChestPanel";
import { WorldDiscoveryPanel } from "@/components/home/kids/WorldDiscoveryPanel";
import { ChessMindIcon } from "@/components/nav/icons";
import { StatCardCompact } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEXT } from "@/lib/designSystem";

/**
 * The Kids / "Enchanted Kingdom" Home composition (Phase 2.1-D).
 *
 * Mirrors ClassicProHome/AdultHome's contract exactly — page.tsx still owns
 * 100% of auth, redirects, data fetching, and business logic; this
 * component only receives already-computed results as props. Its dashboard
 * panels (Daily Kingdom Quests, Knight's Royal Chest, World Discovery Map)
 * are Kids' own genuinely different composition, built entirely from data
 * Home already fetches (selectDailyQuests' questSet, the same achievement
 * evaluation every mode already runs, the real static WORLD_LOCATIONS
 * content) — no new business logic, no invented XP/levels/rewards/lock
 * states. getPrimaryAction()/getOllieHomeLine() are untouched; only the
 * visual shell (kingdom-hero, via app/modes.css) changes.
 */
export function KidsHome({
  neutralTone,
  displayName,
  avatar,
  streak,
  rating,
  primaryAction,
  buddy,
  ollieLine,
  questSet,
  kingdomBonuses,
  onlineWinsCount,
  openingEncountersCount,
  chessMindTotalSolved,
  achievementsProps,
}: {
  neutralTone: boolean;
  displayName: string;
  avatar: AvatarOption | undefined;
  streak: number;
  rating?: number;
  primaryAction: PrimaryAction;
  buddy: BuddyOption;
  ollieLine: string;
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
}) {
  return (
    <>
      <header className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 text-left">
            <p className="kingdom-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
              Enchanted Kingdom
            </p>
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
        KINGDOM DASHBOARD — hero full-width (the current School session /
        primary action, framed as the adventure's next chapter), then
        "Adventure Arenas" (the real Play/Puzzles/World/Learn destinations,
        themed), then a two-column split at desktop: Daily Kingdom Quests +
        World Discovery Map on the left, Knight's Royal Chest on the right.
      */}
      <div className="kingdom-dashboard flex w-full flex-col gap-3 lg:gap-4">
        <div className="home-hero-grid">
          <HomeHeroSection
            action={primaryAction}
            buddy={buddy}
            ollieLine={ollieLine}
            neutralTone={neutralTone}
          />
          <div className="kingdom-panel home-surface-card flex flex-col gap-2 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4">
            <p className="kingdom-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
              Adventure Arenas
            </p>
            <ActivityTileGrid />
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <DailyKingdomQuestsPanel set={questSet} neutralTone={neutralTone} />
            <WorldDiscoveryPanel />
          </div>
          <div className="flex flex-col gap-3">
            <KnightsChestPanel achievementsProps={achievementsProps} />
          </div>
        </div>
      </div>

      {/*
        SECONDARY ZONE — same treatment as Classic/Pro and Adult: real
        sections, de-emphasised (kingdom-secondary) rather than removed.
      */}
      <div className="kingdom-secondary flex w-full flex-col gap-4">
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

        <section className="flex w-full flex-col gap-2">
          <SectionHeader title="Your Progress" className="home-section-heading" />
          <Link
            href="/profile"
            className="home-surface-card grid grid-cols-2 gap-2 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-3 transition-[border-color,transform] duration-100 hover:border-premium-gold/20 active:scale-[0.98] sm:grid-cols-4"
          >
            <StatCardCompact value={onlineWinsCount} label="Online Wins" />
            <Suspense fallback={<StatCardCompact value="…" label="Achievements" />}>
              <KingdomMapAchievementCount {...achievementsProps} />
            </Suspense>
            <StatCardCompact value={openingEncountersCount} label="Openings" />
            <StatCardCompact value={chessMindTotalSolved} label="Chess Mind" />
          </Link>
        </section>

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
