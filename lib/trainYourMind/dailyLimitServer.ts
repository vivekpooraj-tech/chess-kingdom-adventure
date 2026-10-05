import type { SupabaseClient } from "@supabase/supabase-js";
import { parseClientDate, mayServe, FREE_DAILY_COMPLETIONS, type TrainModule } from "./dailyLimitRules";

/**
 * SERVER-SIDE read of the child's Train Your Mind usage FOR ONE CATEGORY, for the routes
 * that serve exercises (/api/chess-mind/train and the Tactical Thinking lesson route).
 *
 * The routes call this for FREE accounts only. The count comes from the database
 * (get_train_your_mind_usage, migration 0055) under the caller's own session, so a request
 * can never claim a lower number. Returns null if the RPC is unreachable (offline, or the
 * migration is not yet applied) — the caller then does not block, exactly as the
 * client-side usage helpers behave.
 */
export interface ServeGate {
  /** Whether an exercise may be served in this category today. */
  allowed: boolean;
  used: number;
  limit: number;
}

export async function readServeGate(
  supabase: SupabaseClient,
  childId: string,
  module: TrainModule,
  clientDate: string | null | undefined
): Promise<ServeGate | null> {
  try {
    const { data, error } = await supabase.rpc("get_train_your_mind_usage", {
      p_child_id: childId,
      p_activity_date: parseClientDate(clientDate) ?? new Date().toISOString().slice(0, 10),
    });
    if (error || !Array.isArray(data)) return null;
    const row = (data as Array<Record<string, unknown>>).find((r) => r.module_id === module);
    if (!row) return null;
    const used = Number(row.used_today ?? 0);
    return { allowed: mayServe(!!row.is_premium, used), used, limit: FREE_DAILY_COMPLETIONS };
  } catch {
    return null;
  }
}
