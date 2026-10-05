/**
 * Subtle "N / 3 today" line for a Train Your Mind page — the proactive
 * counterpart to DailyLimitCard's terminal state. The 3 is the GLOBAL free limit
 * (completed exercises across every Train Your Mind category), mirrored from the
 * server by useTrainYourMindDailyLimit(); this component never counts or hardcodes
 * anything itself.
 *
 * Invisible before the first completion today (showing "0 / 3" reads as a limit
 * warning before the child has done anything) and for Premium (unlimited).
 */
export function DailyUsageIndicator({
  usedToday,
  limit,
  isPremium,
}: {
  usedToday: number;
  limit: number | null;
  isPremium: boolean;
}) {
  if (isPremium || limit === null) return null;
  if (usedToday <= 0) return null;

  return (
    <p className="font-classic-body text-[11px] text-premium-ivory/40 text-center">
      {Math.min(usedToday, limit)} / {limit} today
    </p>
  );
}
