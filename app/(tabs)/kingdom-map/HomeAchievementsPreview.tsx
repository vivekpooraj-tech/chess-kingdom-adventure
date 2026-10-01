import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningEncounterDetail } from "@/lib/supabase/queries";
import { ACHIEVEMENTS } from "@/content/achievements";
import { TEXT } from "@/lib/designSystem";
import { getAchievementsCached } from "./achievementsData";

const PREVIEW_COUNT = 4;

/**
 * Compact achievements preview for Home — count, a few earned badges, and a
 * link to the full list on Profile. Uses the same cached evaluation as
 * KingdomMapAchievementCount / KingdomMapAchievements (no extra queries).
 */
export async function HomeAchievementsPreview({
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

  const previewKeys = [
    ...justEarnedKeys,
    ...earnedKeys.filter((key) => !justEarnedKeys.includes(key)),
  ].slice(0, PREVIEW_COUNT);

  const previewBadges = previewKeys
    .map((key) => ACHIEVEMENTS.find((achievement) => achievement.key === key))
    .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => Boolean(achievement));

  return (
    <section
      aria-labelledby="home-achievements-heading"
      className="home-surface-card flex w-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-achievements-heading" className={TEXT.heading}>
          Achievements{" "}
          <span className="text-base text-premium-ivory/40">
            ({earnedKeys.length}/{ACHIEVEMENTS.length})
          </span>
        </h2>
        <Link
          href="/profile"
          className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2"
        >
          See all
        </Link>
      </div>

      {previewBadges.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {previewBadges.map((achievement) => (
            <div
              key={achievement.key}
              title={achievement.description}
              className="flex min-w-[4.5rem] flex-col items-center gap-1 text-center"
            >
              <div className="home-achievement-badge flex h-12 w-12 items-center justify-center rounded-full border border-premium-gold/50 bg-premium-gold/15 text-xl">
                {achievement.emoji}
              </div>
              <span className="w-full break-words font-classic-body text-[11px] leading-tight text-premium-ivory/60">
                {achievement.title}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={TEXT.body}>Complete activities to earn your first badge.</p>
      )}
    </section>
  );
}
