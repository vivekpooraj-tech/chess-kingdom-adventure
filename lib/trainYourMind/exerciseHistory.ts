import type { SupabaseClient } from "@supabase/supabase-js";
import { HISTORY_FETCH_LIMIT } from "./historyConfig";
import type { HistoryEntry } from "./exerciseSelection";

/**
 * Client for the per-child exercise history
 * (supabase/migrations/0053_train_your_mind_exercise_history.sql).
 *
 * Both functions fail OPEN: any error — network, RLS, or the migration not
 * yet applied in an environment — yields an empty history / a no-op write, so
 * a child is never blocked from training. The cost of failing open is only
 * that selection falls back to "no memory" (today's behaviour).
 */

export async function loadExerciseHistory(
  supabase: SupabaseClient,
  childId: string,
  moduleId: string
): Promise<HistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from("child_train_your_mind_exercise_history")
      .select("exercise_id, last_seen_at")
      .eq("child_id", childId)
      .eq("module_id", moduleId)
      .order("last_seen_at", { ascending: false })
      .limit(HISTORY_FETCH_LIMIT);
    if (error || !data) return [];
    return data
      .map((r: { exercise_id: string; last_seen_at: string }) => ({
        exerciseId: r.exercise_id,
        lastSeenAt: Date.parse(r.last_seen_at),
      }))
      .filter((h) => Number.isFinite(h.lastSeenAt));
  } catch {
    return [];
  }
}

export async function recordExerciseSeen(
  supabase: SupabaseClient,
  childId: string,
  moduleId: string,
  exerciseId: string
): Promise<void> {
  try {
    await supabase.rpc("record_train_your_mind_exercise_seen", {
      p_child_id: childId,
      p_module_id: moduleId,
      p_exercise_id: exerciseId,
    });
  } catch {
    // best-effort
  }
}
