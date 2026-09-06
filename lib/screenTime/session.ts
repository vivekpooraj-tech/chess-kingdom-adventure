/**
 * Screen-time session logic.
 *
 * Pure: no I/O, no browser APIs. The tracker component supplies the clock,
 * storage and network; everything decidable lives here so it can be tested
 * without a browser.
 *
 * The model is ACTIVE time, accumulated in milliseconds and committed to the
 * server a whole minute at a time. Counting whole minutes on a fixed interval
 * (the previous approach) lost every partial minute at a navigation or a tab
 * close, which a child could exploit indefinitely by moving between screens.
 */

export interface ScreenTimeLimits {
  weekdayMinutes: number;
  weekendMinutes: number;
}

/** Weekend is Saturday and Sunday in the device's own timezone. */
export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function pickLimit(d: Date, limits: ScreenTimeLimits): number {
  return isWeekend(d) ? limits.weekendMinutes : limits.weekdayMinutes;
}

/**
 * Local calendar date, matching lib/supabase/queries.ts localDateString().
 *
 * Deliberately the DEVICE's date rather than UTC: a limit is a promise about
 * the child's day, and a child in IST who plays at 23:00 is still inside
 * Monday even though UTC has not rolled over.
 */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Whether access is blocked.
 *
 * A limit of 0 means zero minutes today, not "unlimited". The parent slider
 * ranges 0-480, so 0 is a real setting a parent can choose to stop play
 * entirely; treating it as no-enforcement (an earlier version did) turned the
 * strictest possible setting into the most permissive one.
 */
export function isBlocked(usedMinutes: number, limitMinutes: number | null): boolean {
  if (limitMinutes === null) return false; // limit not loaded yet — never guess
  return usedMinutes >= limitMinutes;
}

export interface Accumulator {
  /** Sub-minute active time not yet committed to the server. */
  remainderMs: number;
  /** The local date this remainder belongs to. */
  date: string;
}

export interface AccumulateResult {
  accumulator: Accumulator;
  /** Whole minutes to commit to the server now. */
  minutesToCommit: number;
  /** True when the local date rolled over and the caller must resync. */
  dayRolled: boolean;
}

/** Ignore absurd deltas: a laptop resumed from sleep reports a huge jump, and
 *  that is not time the child spent playing. */
export const MAX_PLAUSIBLE_DELTA_MS = 2 * 60 * 1000;

/**
 * Fold `deltaMs` of active time into the accumulator.
 *
 * Returns whole minutes to commit and keeps the remainder, so nothing is lost
 * at a navigation, a tab close or a visibility change.
 */
export function accumulate(
  acc: Accumulator,
  deltaMs: number,
  now: Date
): AccumulateResult {
  const today = dateKey(now);

  // A new day starts a fresh allowance and a fresh remainder; yesterday's
  // partial minute must not be charged to today.
  if (acc.date !== today) {
    return {
      accumulator: { remainderMs: 0, date: today },
      minutesToCommit: 0,
      dayRolled: true,
    };
  }

  const usable = deltaMs > 0 && deltaMs <= MAX_PLAUSIBLE_DELTA_MS ? deltaMs : 0;
  const total = acc.remainderMs + usable;
  const minutesToCommit = Math.floor(total / 60_000);

  return {
    accumulator: { remainderMs: total - minutesToCommit * 60_000, date: today },
    minutesToCommit,
    dayRolled: false,
  };
}

// --- Multi-tab leader election -------------------------------------------
//
// Three open tabs must not bill three minutes a minute. One tab is elected the
// accruing leader through a heartbeat in shared storage; the others observe.
// Deliberately not BroadcastChannel: this needs to survive a tab crashing
// without a clean handover, which a timestamp does and a channel does not.

export const LEADER_HEARTBEAT_MS = 5_000;
/** A leader silent for longer than this is presumed gone. */
export const LEADER_STALE_MS = 15_000;

export interface LeaderRecord {
  id: string;
  ts: number;
}

export function parseLeader(raw: string | null): LeaderRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.id === "string" && typeof v?.ts === "number") return v;
// eslint-disable-next-line no-empty
  } catch {}
  return null;
}

/** Whether `selfId` may accrue: it is already the leader, or the leader is stale. */
export function shouldClaimLeadership(
  record: LeaderRecord | null,
  selfId: string,
  nowMs: number
): boolean {
  if (!record) return true;
  if (record.id === selfId) return true;
  return nowMs - record.ts > LEADER_STALE_MS;
}
