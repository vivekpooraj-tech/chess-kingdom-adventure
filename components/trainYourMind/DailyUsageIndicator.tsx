/**
 * Subtle "N of 2 today" line for a Train Your Mind activity page — the
 * proactive counterpart to DailyLimitCard's terminal blocked state.
 *
 * Reads directly from useTrainYourMindDailyLimit()'s own state (usedToday/
 * limit/isPremium) — no second counter, no localStorage, no re-derived
 * limit. `limit` already comes from lib/entitlement/dailyLimits.ts via the
 * hook; this component never hardcodes the "2" itself.
 *
 * Deliberately invisible in the two cases where showing it would be wrong:
 *   - before any use today (nothing to report yet — showing "0 of 2" reads
 *     as a limit warning before the child has done anything)
 *   - Premium (limit is null/unlimited — "2 of 2" would misrepresent an
 *     unlimited account as capped)
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
      {usedToday} of {limit} today
    </p>
  );
}
