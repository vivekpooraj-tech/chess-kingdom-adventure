import Link from "next/link";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ChessJourneyPanel } from "@/components/learner/ChessJourneyPanel";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { ListItemRow } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEXT } from "@/lib/designSystem";
import type { ProfileData } from "@/components/profile/types";

/**
 * Classic/Pro Profile composition — "Profile". Dense, performance-first:
 * rating and today's change lead, Chess Journey (unmodified shared
 * component) stays high in the page, stats/openings/achievements follow at
 * compact density. Every value below comes from the shared ProfileData the
 * page computed once — nothing here recalculates anything.
 */
export function ClassicProfile({ data: d }: { data: ProfileData }) {
  return (
    <div className="w-full flex flex-col gap-4">
      <HomeHeader
        displayName={d.displayName}
        avatar={d.avatar}
        zone={d.zone}
        currentDay={d.currentDay}
        totalDays={d.totalDays}
        streak={d.streak}
      />

      <div className="profile-rating-card w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex items-center justify-between">
        <div>
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Rating</p>
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

      <div className="w-full flex flex-col gap-2">
        <SectionHeader title="Customize" />
        <ListItemRow href="/kingdom-map/customize" className="min-h-[56px]">
          <span className="text-2xl flex-none">{d.pieceSetEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-classic-display text-sm text-premium-ivory">Change Pieces</p>
            <p className={`${TEXT.caption} normal-case`}>Currently {d.pieceSetName}</p>
          </div>
          <span className="profile-cta text-lg flex-none">→</span>
        </ListItemRow>
        <ListItemRow href="/kingdom-map/customize" className="min-h-[56px]">
          <span className="text-2xl flex-none">{d.boardSkinEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-classic-display text-sm text-premium-ivory">Change Board</p>
            <p className={`${TEXT.caption} normal-case`}>Currently {d.boardSkinName}</p>
          </div>
          <span className="profile-cta text-lg flex-none">→</span>
        </ListItemRow>
      </div>

      <div className="w-full flex flex-col gap-2">
        <SectionHeader title="Your Stats" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatCard emoji="🗺️" value={`${d.completedDaysCount}/${d.totalDays}`} label="Kingdom Journey" />
          <StatCard emoji="🏛️" value={`${d.completedAcademyCount}`} label="Academy Completed" />
          <StatCard emoji="🧩" value={`${d.puzzlesSolved}`} label="Puzzles Solved" />
          <StatCard emoji="🧠" value={`${d.chessMindTotalSolved}`} label="Chess Mind Solved" />
          <StatCard emoji="🧭" value={`${d.discoveredCount}`} label="Openings Discovered" />
          <StatCard emoji="🥇" value={`${d.onlineWins}`} label="Online Wins" />
        </div>
      </div>

      <div className="profile-openings-card w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-classic-display text-base text-premium-ivory">Openings Discovered</p>
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
            <p className="font-classic-body text-xs text-premium-ivory/50">Discovered</p>
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
              Recently Discovered
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

      <AchievementBadges earnedKeys={d.earnedKeys} />
    </div>
  );
}
