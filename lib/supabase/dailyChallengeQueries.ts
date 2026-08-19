import { SupabaseClient } from "@supabase/supabase-js";

export interface DailyChallengeState {
  puzzleId: string;
  levelServed: number;
  result: "pending" | "solved" | "failed";
  attempts: number;
  theme: string;
  mateIn: 1 | 2 | 3;
}

/**
 * Fetches (and, server-side, selects on first call of the day) this
 * child's personalized Daily Challenge for `dateStr` (YYYY-MM-DD, local —
 * see lib/supabase/queries.ts's localDateString, same convention already
 * used by the free-preview daily limit). Calling this again the same day
 * always returns the same puzzle — see get_daily_challenge's own
 * same-day-consistency comment in supabase/migrations/0025_daily_challenge_progression.sql.
 */
export async function getDailyChallenge(
  supabase: SupabaseClient,
  childId: string,
  dateStr: string
): Promise<DailyChallengeState> {
  const { data, error } = await supabase.rpc("get_daily_challenge", {
    p_child_id: childId,
    p_date: dateStr,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("No Daily Challenge returned");
  // Field names carry an out_ prefix — see the RPC's own comment in
  // supabase/migrations/0025_daily_challenge_progression.sql for why
  // (RETURNS TABLE column names collide with real table column names
  // otherwise, the exact bug already found and fixed in claim_timeout).
  return {
    puzzleId: row.out_puzzle_id,
    levelServed: row.out_level_served,
    result: row.out_result,
    attempts: row.out_attempts,
    theme: row.out_theme,
    mateIn: row.out_mate_in,
  };
}

/**
 * Server-authoritative result recording — idempotent (see the RPC's own
 * comment): once solved, further calls for the same day are a no-op, so a
 * retried/duplicate request can't double-count or be replayed to fake
 * extra "solved" credit.
 */
export async function recordDailyChallengeResult(
  supabase: SupabaseClient,
  childId: string,
  dateStr: string,
  solved: boolean
): Promise<void> {
  const { error } = await supabase.rpc("record_daily_challenge_result", {
    p_child_id: childId,
    p_date: dateStr,
    p_solved: solved,
  });
  if (error) throw error;
}
