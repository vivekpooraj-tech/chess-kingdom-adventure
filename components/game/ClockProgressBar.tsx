"use client";

import { clockProgress, clockUrgency, URGENCY_FILL } from "@/lib/game/clockProgress";
import { useRemainingMs, type ClockSync } from "@/lib/game/useRemainingMs";

/**
 * A player's remaining time as a bar.
 *
 * Reads the same hook LiveChessClock does, from the same server-authoritative
 * props, so it is a second VIEW of one number rather than a second countdown.
 * It ticks itself and re-renders only itself.
 *
 * Renders nothing at all when the game has no clock scale to draw against —
 * an empty track that never moves would imply a timed game that isn't one.
 */
export function ClockProgressBar({
  totalMs,
  label,
  ...sync
}: ClockSync & {
  /** The side's starting time (online_games.initial_time_ms). */
  totalMs: number | null | undefined;
  /** Whose bar this is, for screen readers — the bar is decorative otherwise. */
  label: string;
}) {
  const remainingMs = useRemainingMs(sync);

  if (typeof totalMs !== "number" || totalMs <= 0) return null;

  const fraction = clockProgress(remainingMs, totalMs);
  const urgency = clockUrgency(fraction);
  const percent = Math.round(fraction * 100);

  return (
    <div
      role="progressbar"
      aria-label={`${label} time remaining`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-testid="clock-progress"
      data-urgency={urgency}
      data-percent={percent}
      className="h-1 w-full overflow-hidden rounded-full bg-white/10"
    >
      <div
        className={`h-full rounded-full transition-[width,background-color] duration-300 ease-linear ${URGENCY_FILL[urgency]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
