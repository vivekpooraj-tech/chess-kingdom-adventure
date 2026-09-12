"use client";

import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { FLOOR_ACCENT } from "./PuzzleLevelCard";
import type { PuzzleLevel } from "@/lib/puzzles/puzzleLevels";

/**
 * The WOW moment for a genuine level crossing — a full-screen overlay, not
 * the small inline banner the first Puzzle Tower pass used. `PuzzleTower`
 * only ever mounts this once the climber has finished gliding to the new
 * floor and the brain has finished evolving, so by the time this appears
 * the whole tower already visually reflects the new level underneath it.
 *
 * Dismissing calls `onContinue`, which the caller uses to mark the
 * celebration acknowledged (see PuzzleTower's localStorage bookkeeping) —
 * this component itself has no persistence of its own.
 */
export function PuzzleUnlockCelebration({
  level,
  onContinue,
}: {
  level: PuzzleLevel;
  onContinue: () => void;
}) {
  const accent = FLOOR_ACCENT[level.id];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${level.label} unlocked`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm motion-reduce:backdrop-blur-none"
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-premiumCard border p-7 text-center shadow-goldGlow"
        style={{ borderColor: accent.ring, backgroundColor: "#0f1629" }}
      >
        <span className="text-5xl motion-safe:animate-pulse" aria-hidden="true">
          {level.icon}
        </span>
        <div>
          <p className={`${TEXT.meta}`} style={{ color: accent.ring }}>
            ✨ NEW LEVEL UNLOCKED
          </p>
          <p className="mt-1 font-classic-display text-2xl text-premium-ivory">{level.label}</p>
        </div>
        <p className={`${TEXT.body} normal-case`}>{level.ollieLine}</p>
        <Button tone="premium" block onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
