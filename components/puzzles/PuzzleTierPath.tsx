"use client";

import { FLOOR_ACCENT } from "./PuzzleLevelCard";
import { currentPuzzleLevel, type PuzzleLevel } from "@/lib/puzzles/puzzleLevels";

/**
 * Chess.com-style numbered steps within the child's CURRENT tier only —
 * shows "you are on step 7 of 10" inside Easy, without rebuilding the
 * whole tower as an isometric map.
 */
export function PuzzleTierPath({
  solvedCount,
  entered,
}: {
  solvedCount: number;
  entered: boolean;
}) {
  const current = currentPuzzleLevel(solvedCount);
  const steps = tierSteps(current, solvedCount);
  if (steps.length <= 1) return null;

  const accent = FLOOR_ACCENT[current.id];
  const activeIndex = Math.min(steps.length - 1, Math.max(0, solvedCount - current.min));

  return (
    <div
      className={`flex flex-col gap-2 rounded-premiumCard border border-white/10 bg-premium-navy/50 p-3 transition-opacity duration-700 motion-reduce:transition-none ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      aria-label={`${current.label} tier progress`}
    >
      <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/60">
        {current.label} path · {current.rangeLabel}
      </p>
      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={step}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-classic-display tabular-nums transition-colors ${
                done
                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                  : active
                    ? "border-premium-gold/60 text-premium-gold shadow-goldGlow"
                    : "border-white/10 bg-premium-midnight/60 text-premium-ivory/40"
              }`}
              style={
                active
                  ? {
                      backgroundColor: `${accent.ring}22`,
                      borderColor: `${accent.ring}88`,
                      color: accent.ring,
                    }
                  : undefined
              }
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : step}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function tierSteps(level: PuzzleLevel, solvedCount: number): number[] {
  const count = Math.max(0, solvedCount);
  if (level.max === null) {
    // Master — show a short aspirational strip, not 100+ tiles.
    const start = Math.max(level.min, count - 2);
    return [start, start + 1, start + 2, start + 3].map((n) => n + 1);
  }
  const size = Math.min(10, level.max - level.min + 1);
  const start = level.min + 1;
  return Array.from({ length: size }, (_, i) => start + i);
}
