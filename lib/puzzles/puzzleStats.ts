/**
 * Puzzle history, streak and personal-best arithmetic — Priority 4 (personal
 * puzzle history, personal best, puzzle streak).
 *
 * WHERE THE DATA COMES FROM. puzzle_library_solves (migration 0029)
 * already records one row per (child, puzzle) the first time it's solved,
 * across BOTH the Puzzle Trainer (mate library) and the Tactics Trainer,
 * with a real `solved_at` timestamp and `first_try` boolean, indexed by
 * (child_id, solved_at desc). No migration is needed for any of this — it
 * is exactly the shape a streak and a personal best need, and it already
 * exists and is already RLS-protected.
 *
 * WHAT COUNTS AS "PERSONAL BEST" HERE, AND WHY. Only two numbers, both
 * directly counted from real rows, both explainable in one sentence to a
 * parent:
 *   - bestDayCount: the most puzzles solved on any single calendar day.
 *   - longestFirstTryStreak: the longest run of consecutive solves (in
 *     solve order) that were each right on the first try.
 * Nothing here is a synthetic "skill score" or a normalized rating — the
 * brief is explicit that a personal best must be a real, explainable
 * metric, not an invented one.
 *
 * Pure: every function takes plain data and a "now" reference where dates
 * matter, so streak math is fully testable without a database or a clock.
 */

export interface SolveRecord {
  puzzleId: string;
  /** ISO timestamp. */
  solvedAt: string;
  firstTry: boolean;
  source: "trainer" | "daily";
}

export interface PuzzleStats {
  totalSolved: number;
  /** Consecutive days (including today or yesterday) with at least one
   *  solve. Mirrors getChessMindStreak's exact rule: 0 if the most recent
   *  solve was neither today nor yesterday — a streak "grace day" of
   *  exactly one, same as the rest of the app already gives credit for. */
  currentStreakDays: number;
  bestDayCount: number;
  longestFirstTryStreak: number;
}

const DAY_MS = 86_400_000;

function toLocalDateString(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  // Calendar date only — matches lib/supabase/queries.ts's localDateString
  // shape (YYYY-MM-DD) closely enough for day-bucketing purposes here; the
  // caller passes real solved_at values, which are always valid ISO.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The streak, given the set of distinct dates something was solved on and
 * "today" as the caller's own reference point (so this is testable without
 * a real clock). Same rule as getChessMindStreak: today or yesterday keeps
 * the streak alive; anything older resets it to 0.
 */
export function streakFromDates(dates: readonly string[], today: string): number {
  const distinct = [...new Set(dates)].sort().reverse(); // newest first
  if (distinct.length === 0) return 0;

  const todayMs = Date.parse(today);
  const yesterday = toLocalDateString(new Date(todayMs - DAY_MS).toISOString());
  if (distinct[0] !== today && distinct[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < distinct.length; i++) {
    const prevMs = Date.parse(distinct[i - 1]);
    const curMs = Date.parse(distinct[i]);
    const diffDays = Math.round((prevMs - curMs) / DAY_MS);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

/**
 * Full stats from a solve history. `today` is the caller's local-date
 * string (see lib/supabase/queries.ts's localDateString) — passed in rather
 * than computed here so the same "what day is it" answer is used
 * everywhere in the app.
 */
export function computePuzzleStats(records: readonly SolveRecord[], today: string): PuzzleStats {
  const valid = (records ?? []).filter((r) => r && typeof r.solvedAt === "string" && !Number.isNaN(Date.parse(r.solvedAt)));

  if (valid.length === 0) {
    return { totalSolved: 0, currentStreakDays: 0, bestDayCount: 0, longestFirstTryStreak: 0 };
  }

  // Chronological order (oldest first) for the first-try streak, which is a
  // property of SOLVE ORDER, not calendar order.
  const chronological = [...valid].sort((a, b) => Date.parse(a.solvedAt) - Date.parse(b.solvedAt));

  const byDay = new Map<string, number>();
  for (const r of valid) {
    const day = toLocalDateString(r.solvedAt);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  let longestFirstTryStreak = 0;
  let running = 0;
  for (const r of chronological) {
    if (r.firstTry) {
      running++;
      longestFirstTryStreak = Math.max(longestFirstTryStreak, running);
    } else {
      running = 0;
    }
  }

  return {
    totalSolved: valid.length,
    currentStreakDays: streakFromDates([...byDay.keys()], today),
    bestDayCount: Math.max(0, ...byDay.values()),
    longestFirstTryStreak,
  };
}

/** The N most recent solves, newest first — for a "recently solved" list. */
export function recentSolves(records: readonly SolveRecord[], limit = 10): SolveRecord[] {
  return [...(records ?? [])]
    .filter((r) => r && typeof r.solvedAt === "string" && !Number.isNaN(Date.parse(r.solvedAt)))
    .sort((a, b) => Date.parse(b.solvedAt) - Date.parse(a.solvedAt))
    .slice(0, Math.max(0, limit));
}
