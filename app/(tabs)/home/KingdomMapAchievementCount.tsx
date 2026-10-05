import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningEncounterDetail } from "@/lib/supabase/queries";
import { ACHIEVEMENTS } from "@/content/achievements";
import { StatCardCompact } from "@/components/ui/StatCard";
import { getAchievementsCached } from "./achievementsData";

/**
 * The Stats grid's achievement count, split out so it can sit inside its
 * own tiny Suspense boundary -- same underlying data as
 * KingdomMapAchievements.tsx (deduped via getAchievementsCached, see
 * achievementsData.ts), but this lets the OTHER 3 stats (already
 * available from the main batch) render immediately instead of the whole
 * Stats row waiting on the achievement evaluation too.
 */
export async function KingdomMapAchievementCount({
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
  const { allEarned: earnedKeys } = await getAchievementsCached(
    supabase,
    childId,
    completedDays,
    isPremium,
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWinsCount
  );

  return <StatCardCompact value={`${earnedKeys.length}/${ACHIEVEMENTS.length}`} label="Achievements" />;
}
