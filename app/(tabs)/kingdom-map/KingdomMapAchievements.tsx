import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningEncounterDetail } from "@/lib/supabase/queries";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { getAchievementsCached } from "./achievementsData";

/**
 * Split out of the main Kingdom Map page (Phase 4 performance audit) so its
 * own Suspense boundary can stream in AFTER the rest of Home is already
 * visible and usable, instead of gating the whole page behind it. This is
 * the single most sequential, most expensive step on Home: it depends on
 * most of the parallel batch's results AND does a write (new achievement
 * rows) before its own read, so it was always the last thing to resolve --
 * exactly the "secondary, can load afterward" content per the audit.
 */
export async function KingdomMapAchievements({
  supabase,
  childId,
  completedDays,
  isPremium,
  completedAcademyIds,
  openingEncounters,
  chessMindTotalSolved,
  onlineWinsCount,
}: {
  supabase: SupabaseClient;
  childId: string;
  completedDays: number[];
  isPremium: boolean;
  completedAcademyIds: string[];
  openingEncounters: OpeningEncounterDetail[];
  chessMindTotalSolved: number;
  onlineWinsCount: number;
}) {
  const { newlyEarned: justEarnedKeys, allEarned: earnedKeys } = await getAchievementsCached(
    supabase,
    childId,
    completedDays,
    isPremium,
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWinsCount
  );

  return <AchievementBadges earnedKeys={earnedKeys} justEarnedKeys={justEarnedKeys} />;
}
