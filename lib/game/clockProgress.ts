/**
 * The clock progress bar's arithmetic — pure, so it can be tested without a
 * browser, a game or a timer.
 *
 * This file deliberately contains NO timing of its own. It never reads the
 * clock, never calls Date.now() and never decides how much time is left; it
 * only turns a remaining-ms value that someone else computed into a width and
 * a colour. The single source of remaining time is useRemainingMs(), which is
 * the same hook LiveChessClock ticks on, so the bar and the digits can never
 * disagree about how much time a player has.
 */

/** How full the bar is, as a fraction of the side's starting time. */
export function clockProgress(remainingMs: number, totalMs: number | null | undefined): number {
  // No usable total (untimed game, or a row written before the clock columns
  // existed) means there is no scale to draw against. Zero, not a guess.
  if (typeof totalMs !== "number" || !Number.isFinite(totalMs) || totalMs <= 0) return 0;
  if (!Number.isFinite(remainingMs)) return 0;

  // Clamped at both ends. Below zero would render a negative width, and above
  // one would overflow the track — increments legitimately push remaining time
  // past the starting time, so the upper clamp is a real case, not paranoia.
  const fraction = remainingMs / totalMs;
  if (fraction < 0) return 0;
  if (fraction > 1) return 1;
  return fraction;
}

export type ClockUrgency = "normal" | "caution" | "urgent" | "critical";

/**
 * Urgency expressed as a share of your own starting time, so it means the same
 * thing in a 1-minute bullet game as in a 30-minute classical one.
 *
 * This is a SEPARATE axis from the absolute thresholds ChessClock already uses
 * on the digits (2 minutes / 30 seconds). Those answer "can I still think?";
 * this answers "how far through my time am I?". Both are useful and neither
 * replaces the other, so the existing digit colours are left exactly as they
 * were.
 */
export function clockUrgency(fraction: number): ClockUrgency {
  if (!Number.isFinite(fraction)) return "normal";
  if (fraction < 0.1) return "critical";
  if (fraction < 0.25) return "urgent";
  if (fraction <= 0.5) return "caution";
  return "normal";
}

/**
 * Bar colours per tier. Critical is a solid, saturated red rather than a
 * flashing one: a player at 6% of their clock is already under as much
 * pressure as they can usefully absorb, and an animation at that moment
 * competes with the board for the attention they need most.
 */
export const URGENCY_FILL: Record<ClockUrgency, string> = {
  normal: "bg-premium-gold/70",
  caution: "bg-amber-300/80",
  urgent: "bg-orange-400/85",
  critical: "bg-red-500",
};
