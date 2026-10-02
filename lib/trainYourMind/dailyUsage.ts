import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateString } from "@/lib/supabase/queries";

/**
 * Server-backed Train Your Mind daily usage (Phase 5, Objective A).
 *
 * Replaces the Phase 4 localStorage stopgap. The real limit is now enforced
 * by supabase/migrations/0044_train_your_mind_daily_usage.sql's
 * record_train_your_mind_use() RPC — server-side, atomic, keyed to the
 * child rather than the browser. This module is a thin client for that
 * table/RPC; it holds no limit logic of its own (that lives in the RPC and,
 * for display, in lib/entitlement/dailyLimits.ts).
 *
 * The "day" is the caller's LOCAL calendar date — localDateString(), the
 * same helper every other daily-reset feature in this app already uses
 * (screen time, puzzle previews, chess-mind activity, the Daily Challenge).
 * Postgres/Supabase's own current_date is UTC, so both the read below and
 * the RPC call explicitly pass this local date rather than relying on the
 * database's default. See 0044's own header comment for why.
 *
 * Both functions fail open (0 used / allowed) on any error — a transient
 * network hiccup, or the migration not yet applied in an environment,
 * should never trap a child out of a free feature. This mirrors how
 * recordChessMindSolve and similar best-effort progress writes elsewhere in
 * this codebase already behave.
 */

export interface TrainYourMindUseResult {
  allowed: boolean;
  usedToday: number;
  /** null means unlimited (Premium). */
  remaining: number | null;
  isPremium: boolean;
}

export async function getTrainYourMindUsageToday(
  supabase: SupabaseClient,
  childId: string,
  moduleId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("child_train_your_mind_activity")
      .select("activities_completed")
      .eq("child_id", childId)
      .eq("module_id", moduleId)
      .eq("activity_date", localDateString())
      .maybeSingle();
    if (error) return 0;
    return data?.activities_completed ?? 0;
  } catch {
    return 0;
  }
}

/** Call once per completed activity. Returns the server's authoritative
 * post-call state — never an optimistic local guess. */
export async function recordTrainYourMindUse(
  supabase: SupabaseClient,
  childId: string,
  moduleId: string
): Promise<TrainYourMindUseResult> {
  try {
    const { data, error } = await supabase.rpc("record_train_your_mind_use", {
      p_child_id: childId,
      p_module_id: moduleId,
      p_activity_date: localDateString(),
    });
    if (error || !data) return { allowed: true, usedToday: 0, remaining: null, isPremium: false };
    // Supabase returns a `returns table(...)` RPC as an array of rows.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { allowed: true, usedToday: 0, remaining: null, isPremium: false };
    return {
      allowed: !!row.allowed,
      usedToday: row.used_today ?? 0,
      remaining: row.remaining ?? null,
      isPremium: !!row.is_premium,
    };
  } catch {
    return { allowed: true, usedToday: 0, remaining: null, isPremium: false };
  }
}
