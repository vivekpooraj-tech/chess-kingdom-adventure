import Link from "next/link";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ChessJourneyPanel } from "@/components/learner/ChessJourneyPanel";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { ListItemRow } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { TEXT } from "@/lib/designSystem";
import type { ProfileData } from "@/components/profile/types";

/**
 * Kids ("Enchanted Kingdom") Profile composition — "My Chess Journey" (the
 * page's own title — not to be confused with the ChessJourneyPanel section
 * further down, which keeps its own unmodified heading). Same real values
 * as every other mode, just friendlier labels passed as StatCard props
 * (StatCard itself is untouched) and warmer framing copy.
 */
export function KidsProfile({ data: d }: { data: ProfileData }) {
  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className={TEXT.display}>My Chess Journey</h1>
        <p className={`${TEXT.body} mt-2`}>Everything you&apos;ve done so far, all in one place!</p>
      </div>

      <HomeHeader
        displayName={d.displayName}
        avatar={d.avatar}
        zone={d.zone}
        currentDay={d.currentDay}
        totalDays={d.totalDays}
        streak={d.streak}
      />

      <div className="profile-rating-card w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between">
        <div>
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Your Rating</p>
          <p className="profile-rating-value font-classic-display text-3xl">{d.rating.toLocaleString()}</p>
        </div>
        {d.todayRatingChange !== 0 && (
          <p
            className={`font-classic-body text-sm font-semibold ${
              d.todayRatingChange > 0 ? "text-emerald-400" : "text-red-300"
            }`}
          >
            {d.todayRatingChange > 0 ? `+${d.todayRatingChange}` : d.todayRatingChange} today
          </p>
        )}
      </div>

      <ChessJourneyPanel journey={d.journey} />

      <section className="w-full flex flex-col gap-2">
        <p className="profile-section-eyebrow font-classic-body text-xs font-semibold uppercase tracking-wide">
          Make It Yours
        </p>
        <ListItemRow href="/kingdom-map/customize" className="min-h-[76px]">
          <span className="text-3xl flex-none">{d.pieceSetEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-classic-display text-base text-premium-ivory">Change Pieces</p>
            <p className={`${TEXT.caption} normal-case`}>Currently {d.pieceSetName}</p>
          </div>
          <span className="profile-cta text-xl flex-none">→</span>
        </ListItemRow>
        <ListItemRow href="/kingdom-map/customize" className="min-h-[76px]">
          <span className="text-3xl flex-none">{d.boardSkinEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-classic-display text-base text-premium-ivory">Change Board</p>
            <p className={`${TEXT.caption} normal-case`}>Currently {d.boardSkinName}</p>
          </div>
          <span className="profile-cta text-xl flex-none">→</span>
        </ListItemRow>
      </section>

      <section className="w-full flex flex-col gap-2">
        <p className="profile-section-eyebrow font-classic-body text-xs font-semibold uppercase tracking-wide">
          What You&apos;ve Done
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard emoji="🗺️" value={`${d.completedDaysCount}/${d.totalDays}`} label="Kingdom Journey" />
          <StatCard emoji="🏛️" value={`${d.completedAcademyCount}`} label="Academy Completed" />
          <StatCard emoji="🧩" value={`${d.puzzlesSolved}`} label="Puzzles You've Solved" />
          <StatCard emoji="🧠" value={`${d.chessMindTotalSolved}`} label="Chess Mind Challenges Solved" />
          <StatCard emoji="🧭" value={`${d.discoveredCount}`} label="Openings You've Discovered" />
          <StatCard emoji="🥇" value={`${d.onlineWins}`} label="Games You've Won" />
        </div>
      </section>

      <div className="profile-openings-card w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-classic-display text-base text-premium-ivory">Openings You&apos;ve Discovered</p>
          <Link
            href="/academy/openings"
            className="profile-cta inline-flex items-center min-h-[44px] font-classic-body text-xs underline underline-offset-2"
          >
            Explore Openings →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="font-classic-display text-xl text-premium-ivory">{d.discoveredCount}</p>
            <p className="font-classic-body text-xs text-premium-ivory/50">Found</p>
          </div>
          <div>
            <p className="font-classic-display text-xl text-premium-ivory">{d.gambitsDiscovered}</p>
            <p className="font-classic-body text-xs text-premium-ivory/50">Gambits</p>
          </div>
          <div>
            <p className="font-classic-display text-xl text-premium-ivory">
              {d.studiedCount}/{d.totalOpeningsCount}
            </p>
            <p className="font-classic-body text-xs text-premium-ivory/50">Studied</p>
          </div>
        </div>

        {d.recentlyDiscovered.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-classic-body text-[11px] uppercase tracking-wider text-premium-ivory/50 font-semibold">
              Found Recently
            </p>
            <div className="flex flex-wrap gap-2">
              {d.recentlyDiscovered.map((o) => (
                <span
                  key={o.id}
                  className={`font-classic-body text-[11px] rounded-full px-3 py-1 border ${
                    o.isGambit ? "border-red-400/30 text-red-300" : "profile-chip"
                  }`}
                >
                  {o.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="w-full flex flex-col gap-2">
        <p className="profile-section-eyebrow font-classic-body text-xs font-semibold uppercase tracking-wide">
          Badges You&apos;ve Earned
        </p>
        <AchievementBadges earnedKeys={d.earnedKeys} />
      </section>
    </div>
  );
}
