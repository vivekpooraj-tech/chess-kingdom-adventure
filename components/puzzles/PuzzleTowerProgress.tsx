"use client";

import { TEXT } from "@/lib/designSystem";
import { progressToNextLevel, type PuzzleLevel } from "@/lib/puzzles/puzzleLevels";
import { FLOOR_ACCENT } from "./PuzzleLevelCard";

/** "YOUR PROGRESS" on the Puzzle Tower — the honest numbers behind the
 * climb: real solved count, current rank, and a progress bar toward the
 * next real threshold (not a flat lifetime percentage — see
 * progressToNextLevel's doc comment for why that would misrepresent every
 * band but the first).
 *
 * Deliberately a separate component from the pre-existing
 * PuzzleProgressPanel (components/puzzles/PuzzleProgressPanel.tsx, used by
 * the Tactics theme browser for real streak/personal-best data) — same
 * naming idea, different screen, different data shape; kept apart so
 * neither can be mistaken for or accidentally replace the other. */
export function PuzzleTowerProgress({
  solvedCount,
  current,
  next,
  toNext,
  entered,
}: {
  solvedCount: number;
  current: PuzzleLevel;
  next: PuzzleLevel | null;
  toNext: number;
  entered: boolean;
}) {
  const progress = progressToNextLevel(solvedCount);
  const accent = FLOOR_ACCENT[current.id];

  return (
    <div className="flex flex-col gap-3 rounded-premiumCard border border-premium-gold/20 bg-premium-navy/70 p-4">
      <p className={`${TEXT.meta} text-premium-gold`}>YOUR PROGRESS</p>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon="👑" label="Current Rank" value={current.label} />
        <Stat icon="🧩" label="Puzzles Solved" value={String(solvedCount)} />
        <Stat icon="🏆" label="Achievement" value={current.achievement} />
        <Stat
          icon="📈"
          label="Next Goal"
          value={next ? `${toNext} more to ${next.label}` : "Tower conquered"}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            next ? `${progress.percent}% of the way to ${next.label}` : "Tower fully climbed"
          }
          className="h-2 w-full overflow-hidden rounded-full bg-premium-midnight/80"
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: entered ? `${progress.percent}%` : "0%",
              backgroundColor: accent.ring,
            }}
          />
        </div>
        <p className={`${TEXT.caption} normal-case`}>
          {next
            ? `Solve ${toNext} more puzzle${toNext === 1 ? "" : "s"} to unlock ${next.label}`
            : "You've reached the top of the tower — Master."}
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-premiumBtn bg-premium-midnight/60 px-3 py-2">
      <span className={`${TEXT.caption} uppercase tracking-wide`}>
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      <span className="font-classic-display text-sm text-premium-ivory truncate">{value}</span>
    </div>
  );
}
