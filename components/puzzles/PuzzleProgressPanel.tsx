import { TEXT } from "@/lib/designSystem";
import type { PuzzleStats } from "@/lib/puzzles/puzzleStats";

export interface RecentSolveDisplay {
  theme: string;
  emoji: string;
  firstTry: boolean;
  solvedAt: string;
}

/**
 * Your Puzzle Progress — real streak, real personal bests, real recent
 * solves. Nothing here is computed by this component; it is handed the
 * already-computed PuzzleStats (lib/puzzles/puzzleStats.ts) and a short
 * list of already-labelled recent solves, so it stays a pure presentational
 * piece with no chance of quietly diverging from the numbers that were
 * actually verified against the database.
 *
 * Renders nothing when there is no history at all — a brand-new learner
 * sees the theme browser with no empty "0-day streak" panel guilt-tripping
 * them before they've solved a single puzzle.
 */
export function PuzzleProgressPanel({
  stats,
  recent,
}: {
  stats: PuzzleStats;
  recent: RecentSolveDisplay[];
}) {
  if (stats.totalSolved === 0) return null;

  return (
    <section
      aria-labelledby="puzzle-progress-heading"
      className="w-full rounded-premiumCard border border-premium-gold/20 bg-premium-navyLight/50 p-4 sm:p-5 flex flex-col gap-4"
    >
      <h2 id="puzzle-progress-heading" className={`${TEXT.caption} uppercase tracking-wide`}>
        Your Puzzle Progress
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat value={stats.totalSolved} label="Solved" />
        {stats.currentStreakDays > 0 && (
          <Stat value={stats.currentStreakDays} label={stats.currentStreakDays === 1 ? "Day streak" : "Day streak"} emoji="🔥" />
        )}
        {stats.bestDayCount > 0 && <Stat value={stats.bestDayCount} label="Best day" />}
        {stats.longestFirstTryStreak > 1 && (
          <Stat value={stats.longestFirstTryStreak} label="Best first-try run" emoji="⭐" />
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <p className={`${TEXT.caption} uppercase tracking-wide mb-2`}>Recently solved</p>
          <ul className="flex flex-col gap-1.5 list-none">
            {recent.map((r, i) => (
              <li
                key={i}
                className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory/75"
              >
                <span aria-hidden="true">{r.emoji}</span>
                <span className="min-w-0 truncate">{r.theme}</span>
                {r.firstTry && (
                  <span className="flex-none font-classic-body text-[10px] font-semibold text-premium-gold uppercase tracking-wide">
                    first try
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, emoji }: { value: number; label: string; emoji?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-classic-display text-2xl text-premium-ivory tabular-nums">
        {emoji && <span aria-hidden="true">{emoji} </span>}
        {value}
      </p>
      <p className={`${TEXT.caption} normal-case`}>{label}</p>
    </div>
  );
}
