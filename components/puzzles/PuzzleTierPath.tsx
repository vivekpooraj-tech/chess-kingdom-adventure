"use client";

import { FLOOR_ACCENT } from "./PuzzleLevelCard";
import { currentPuzzleLevel, type PuzzleLevel } from "@/lib/puzzles/puzzleLevels";

/**
 * Chess.com-inspired zig-zag stepping path within the current tier — sits on
 * a meadow strip inside the illustrated hero scene.
 */
export function PuzzleTierPath({
  solvedCount,
  entered,
}: {
  solvedCount: number;
  entered: boolean;
}) {
  const current = currentPuzzleLevel(solvedCount);
  const { steps, activeIndex } = tierStepWindow(current, solvedCount);
  if (steps.length <= 1) return null;

  const accent = FLOOR_ACCENT[current.id];

  // Zig-zag rows: 4 + 3 + 3 for up to 10 steps (Chess.com rhythm).
  const rows: number[][] = [];
  const pattern = [4, 3, 3];
  let i = 0;
  for (const n of pattern) {
    if (i >= steps.length) break;
    rows.push(steps.slice(i, i + n));
    i += n;
  }
  if (i < steps.length) rows.push(steps.slice(i));

  return (
    <div
      className={`relative z-10 flex flex-col gap-2 transition-opacity duration-700 motion-reduce:transition-none ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      aria-label={`${current.label} tier progress`}
    >
      <p className="text-center font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/75 md:text-left">
        {current.label} path · puzzles {current.rangeLabel}
      </p>

      <div className="relative mx-auto w-full max-w-md rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-emerald-950/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(34,197,94,0.15) 25%, transparent 25%, transparent 75%, rgba(34,197,94,0.15) 75%), linear-gradient(45deg, rgba(34,197,94,0.15) 25%, transparent 25%, transparent 75%, rgba(34,197,94,0.15) 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 8px 8px",
          }}
          aria-hidden
        />

        <div className="relative flex flex-col items-center gap-2 py-1">
          {rows.map((row, rowIdx) => (
            <ol
              key={rowIdx}
              className="flex items-end justify-center gap-2"
              style={{ marginLeft: rowIdx % 2 === 1 ? "1.75rem" : 0 }}
            >
              {row.map((step) => {
                const globalIdx = steps.indexOf(step);
                const done = globalIdx < activeIndex;
                const active = globalIdx === activeIndex;
                return (
                  <li key={step} aria-current={active ? "step" : undefined}>
                    <div
                      className={`relative flex h-11 w-11 items-center justify-center rounded-lg border-2 text-sm font-classic-display tabular-nums shadow-md transition-transform ${
                        done
                          ? "border-emerald-300/60 bg-emerald-600/50 text-emerald-50"
                          : active
                            ? "scale-110 border-premium-gold/80 text-white shadow-goldGlow motion-safe:animate-pulse"
                            : "border-amber-900/40 bg-amber-950/50 text-amber-100/50"
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: `${accent.ring}cc`,
                              borderColor: accent.ring,
                              boxShadow: `0 8px 20px ${accent.glow}, 0 0 0 2px ${accent.ring}44`,
                            }
                          : {
                              transform: "perspective(400px) rotateX(14deg)",
                            }
                      }
                    >
                      {done ? "✓" : step}
                      {active && (
                        <span className="absolute -top-7 text-lg drop-shadow-md" aria-hidden>
                          🧗
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ))}
        </div>
      </div>
    </div>
  );
}

function tierStepWindow(
  level: PuzzleLevel,
  solvedCount: number
): { steps: number[]; activeIndex: number } {
  const count = Math.max(0, solvedCount);

  if (level.max === null) {
    const start = Math.max(level.min, count - 2);
    const steps = [start, start + 1, start + 2, start + 3].map((n) => n + 1);
    return { steps, activeIndex: steps.length - 1 };
  }

  const bandSize = level.max - level.min + 1;
  const windowSize = Math.min(10, bandSize);
  const progressInBand = Math.max(0, count - level.min);
  const windowStart = Math.min(
    Math.max(level.min, level.min + Math.max(0, progressInBand - windowSize + 1)),
    level.max - windowSize + 1
  );
  const steps = Array.from({ length: windowSize }, (_, idx) => windowStart + idx);
  const activeIndex = Math.min(steps.length - 1, Math.max(0, count - windowStart));
  return { steps, activeIndex };
}
