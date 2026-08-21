import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateAndAwardAchievements,
  type OpeningEncounterDetail,
  type AchievementEvaluationResult,
} from "@/lib/supabase/queries";

/**
 * React.cache()-wrapped so the Stats card's achievement count (needs it
 * immediately, above the fold) and the Achievements section (streamed in
 * separately, see KingdomMapAchievements.tsx) can each call this with the
 * same arguments and only trigger the underlying evaluate+award work ONCE
 * per request -- React dedupes by argument identity within a single render
 * pass. Without this, splitting the achievements section into its own
 * Suspense boundary would mean either duplicating this write, or the Stats
 * card losing its achievement count entirely.
 */
export const getAchievementsCached = cache(
  (
    supabase: SupabaseClient,
    childId: string,
    completedDays: number[],
    isPremium: boolean,
    completedAcademyIds: string[],
    openingEncounters: OpeningEncounterDetail[],
    chessMindTotalSolved: number,
    onlineWinsCount: number
  ): Promise<AchievementEvaluationResult> =>
    evaluateAndAwardAchievements(
      supabase,
      childId,
      completedDays,
      isPremium,
      completedAcademyIds,
      openingEncounters,
      chessMindTotalSolved,
      onlineWinsCount
    )
);
