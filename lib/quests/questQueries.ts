/**
 * Reads today's real activity counts that lib/quests/dailyQuests.ts turns into
 * quest progress. See that file's header for why quests are derived rather
 * than stored, and for why free_game_usage is deliberately not a source here.
 *
 * Every read is scoped to one child id and goes through the ordinary client,
 * so the existing per-table RLS ("parent can manage own child's ...") is what
 * enforces the parent/child boundary — this module adds no new write path, no
 * SECURITY DEFINER function, and no privileged read.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyQuestActivity } from "./dailyQuests";

/**
 * Half-open local-day bounds [start, next) as ISO strings, for the
 * timestamptz columns these counts filter on.
 *
 * Local, not UTC, to match localDateString() in lib/supabase/queries.ts and
 * the date convention set in supabase/migrations/0002_screen_time_usage.sql —
 * "today" has to mean the user's today, or a child in UTC+13 gets a new set of
 * quests midway through their afternoon.
 */
export function localDayBounds(date = new Date()): { start: string; next: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const next = new Date(start.getTime());
  next.setDate(next.getDate() + 1); // DST-safe: date arithmetic, not +86_400_000
  return { start: start.toISOString(), next: next.toISOString() };
}

/**
 * Count rows, returning null (not 0) if the read fails for any reason.
 *
 * The distinction matters: dailyQuests.ts renders nothing for a null source
 * and a real progress bar for a 0. Collapsing the two would show a confident
 * "0 / 3" to a child who had in fact solved three puzzles, on nothing worse
 * than a dropped connection.
 */
async function safeCount(run: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await run();
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/**
 * Puzzles solved today.
 *
 * puzzle_library_solves holds one row per (child, puzzle) written the FIRST
 * time it is solved, from either the Trainer or the Daily Challenge (0029), so
 * this counts distinct puzzles newly solved today. Re-solving an already-solved
 * puzzle does not advance the quest — which is the honest reading of "solve 3
 * puzzles" and also means the quest cannot be farmed by replaying one puzzle.
 */
function countPuzzlesSolved(supabase: SupabaseClient, childId: string, start: string, next: string) {
  return safeCount(() =>
    supabase
      .from("puzzle_library_solves")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .gte("solved_at", start)
      .lt("solved_at", next)
  );
}

/**
 * Games played today.
 *
 * child_game_reviews (0033) gets one row per finished, reviewed game from BOTH
 * surfaces — source is 'free_play' or 'online' — so this counts games against
 * the computer as well as online games, and counts them identically for free
 * and premium children. That premium-neutrality is why this, and not
 * free_game_usage, is the Play quest's source.
 */
function countGamesPlayed(supabase: SupabaseClient, childId: string, start: string, next: string) {
  return safeCount(() =>
    supabase
      .from("child_game_reviews")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .gte("reviewed_at", start)
      .lt("reviewed_at", next)
  );
}

/**
 * Learning activities completed today — course lesson days (child_lesson_progress)
 * plus Academy content (child_academy_progress). Summed, because "learn
 * something today" is satisfied by either and a child working through the
 * Academy should not be told they have not learned anything.
 *
 * If EITHER read fails the whole count is null: a partial sum would understate
 * real progress, which is the one direction this system must never fail in.
 */
async function countLearningCompleted(
  supabase: SupabaseClient,
  childId: string,
  start: string,
  next: string
): Promise<number | null> {
  const [lessons, academy] = await Promise.all([
    safeCount(() =>
      supabase
        .from("child_lesson_progress")
        .select("id", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("status", "completed")
        .gte("completed_at", start)
        .lt("completed_at", next)
    ),
    safeCount(() =>
      supabase
        .from("child_academy_progress")
        .select("id", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("status", "completed")
        .gte("completed_at", start)
        .lt("completed_at", next)
    ),
  ]);
  if (lessons === null || academy === null) return null;
  return lessons + academy;
}

/**
 * All three counts for today, in one parallel wave.
 *
 * Safe to drop into an existing Promise.all batch: it never throws (each read
 * degrades to null on its own) and never blocks on another query's result.
 */
export async function getDailyQuestActivity(
  supabase: SupabaseClient,
  childId: string,
  now = new Date()
): Promise<DailyQuestActivity> {
  const { start, next } = localDayBounds(now);
  const [puzzlesSolved, gamesPlayed, learningCompleted] = await Promise.all([
    countPuzzlesSolved(supabase, childId, start, next),
    countGamesPlayed(supabase, childId, start, next),
    countLearningCompleted(supabase, childId, start, next),
  ]);
  return { puzzlesSolved, gamesPlayed, learningCompleted };
}
