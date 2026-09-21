import Link from "next/link";
import { Suspense } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningEncounterDetail } from "@/lib/supabase/queries";
import { ACHIEVEMENTS } from "@/content/achievements";
import { getAchievementsCached } from "@/app/(tabs)/kingdom-map/achievementsData";
import { TEXT } from "@/lib/designSystem";

type AchievementsProps = {
  supabase: SupabaseClient;
  childId: string;
  completedDays: number[];
  isPremium: boolean;
  completedAcademyIds: string[];
  openingEncounters: OpeningEncounterDetail[];
  chessMindTotalSolved: number;
  onlineWinsCount: number;
};

/**
 * Kids' "Knight's Royal Chest" panel (Phase 2.1-D) — a themed presentation
 * of REAL achievement progress, reusing the exact same
 * getAchievementsCached() call (React.cache()-deduped against the other
 * Home achievement reads this same request already makes) as
 * HomeAchievementsPreview/KingdomMapAchievementCount. The chest's
 * "open"/"locked" framing is driven by whether the child has earned at
 * least one achievement — a real, existing signal — not by an invented
 * quest-completion gate or fictional reward contents. The CTA links to
 * /profile, where the real achievement list already lives, per the
 * explicit fallback this task specifies when there's no literal
 * interactive-chest feature to build.
 */
async function ChestReveal({ achievementsProps }: { achievementsProps: AchievementsProps }) {
  const { allEarned } = await getAchievementsCached(
    achievementsProps.supabase,
    achievementsProps.childId,
    achievementsProps.completedDays,
    achievementsProps.isPremium,
    achievementsProps.completedAcademyIds,
    achievementsProps.openingEncounters,
    achievementsProps.chessMindTotalSolved,
    achievementsProps.onlineWinsCount
  );
  const earned = allEarned.length;
  const total = ACHIEVEMENTS.length;
  const opened = earned > 0;

  return (
    <>
      <span className="text-3xl" aria-hidden="true">{opened ? "👑" : "🔒"}</span>
      <p className="font-classic-display text-lg text-premium-ivory">
        {earned} of {total} treasures found
      </p>
      <p className={TEXT.caption}>
        {opened ? "Open your trophy hall to see them all." : "Complete an activity to earn your first one."}
      </p>
    </>
  );
}

export function KnightsChestPanel({ achievementsProps }: { achievementsProps: AchievementsProps }) {
  return (
    <Link
      href="/profile"
      className="kingdom-panel home-surface-card flex h-full flex-col items-center justify-center gap-2 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 text-center transition-transform duration-100 active:scale-[0.98] sm:p-5"
    >
      <p className="kingdom-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
        Knight&apos;s Royal Chest
      </p>
      <Suspense
        fallback={
          <>
            <span className="text-3xl" aria-hidden="true">🔒</span>
            <p className={TEXT.body}>Opening the chest…</p>
          </>
        }
      >
        <ChestReveal achievementsProps={achievementsProps} />
      </Suspense>
    </Link>
  );
}
