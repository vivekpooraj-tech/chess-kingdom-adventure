import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateString } from "@/lib/supabase/queries";
import { TRAIN_MODULES, type TrainModule } from "./dailyLimitRules";

/**
 * Server-backed Train Your Mind daily usage — 3 completed exercises PER CATEGORY, per child,
 * per day, with the eight categories counted independently (see
 * lib/trainYourMind/dailyLimitRules.ts).
 *
 * Enforced by supabase/migrations/0055_train_your_mind_global_daily_limit.sql — in the
 * database, atomically, keyed to the child. This module is a thin client for those two RPCs
 * and holds no limit logic of its own; nothing here reads or writes browser storage.
 *
 * The "day" is the caller's LOCAL calendar date (localDateString(), the same helper every
 * other daily-reset feature uses); the RPCs clamp it so it cannot be abused to open extra
 * buckets.
 *
 * Both calls return null on any error (offline, or the migration not yet applied in an
 * environment). Callers treat null as "unknown" and do not block the learner: a transient
 * hiccup must never trap a child out of a free feature. When the RPCs are reachable the
 * server is the sole judge.
 */

export interface UsageSnapshot {
  usedToday: number;
  /** null = unlimited (Premium). */
  remaining: number | null;
  /** null = unlimited (Premium). */
  limit: number | null;
  isPremium: boolean;
}

export interface CompletionOutcome extends UsageSnapshot {
  /** false = the server refused this completion (a 4th free one in this category). */
  allowed: boolean;
  /** true = this key was already recorded; nothing further was consumed. */
  duplicate: boolean;
}

type Row = Record<string, unknown>;
const firstRow = (data: unknown): Row | null => (Array.isArray(data) ? ((data[0] as Row) ?? null) : ((data as Row) ?? null));
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Today's usage for ALL eight categories, keyed by module id (one call — the hub uses this). */
export async function getTrainYourMindUsageAll(supabase: SupabaseClient, childId: string): Promise<Partial<Record<TrainModule, UsageSnapshot>> | null> {
  try {
    const { data, error } = await supabase.rpc("get_train_your_mind_usage", {
      p_child_id: childId,
      p_activity_date: localDateString(),
    });
    if (error || !Array.isArray(data)) return null;
    const out: Partial<Record<TrainModule, UsageSnapshot>> = {};
    for (const r of data as Row[]) {
      const id = r.module_id as TrainModule;
      if (!(TRAIN_MODULES as readonly string[]).includes(id)) continue;
      out[id] = {
        usedToday: Number(r.used_today ?? 0),
        remaining: num(r.remaining),
        limit: num(r.daily_limit),
        isPremium: !!r.is_premium,
      };
    }
    return out;
  } catch {
    return null;
  }
}

/** Today's usage for ONE category. */
export async function getTrainYourMindUsage(supabase: SupabaseClient, childId: string, moduleId: TrainModule): Promise<UsageSnapshot | null> {
  const all = await getTrainYourMindUsageAll(supabase, childId);
  return all?.[moduleId] ?? null;
}

/** A fresh key for ONE presented exercise. The same key sent twice counts once. */
export function newCompletionKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Record that the learner COMPLETED (answered) one exercise in `moduleId`. */
export async function recordTrainYourMindCompletion(
  supabase: SupabaseClient,
  childId: string,
  moduleId: TrainModule,
  completionKey: string,
  exerciseId?: string
): Promise<CompletionOutcome | null> {
  try {
    const { data, error } = await supabase.rpc("record_train_your_mind_completion", {
      p_child_id: childId,
      p_module_id: moduleId,
      p_completion_key: completionKey,
      p_exercise_id: exerciseId ?? null,
      p_activity_date: localDateString(),
    });
    const row = error ? null : firstRow(data);
    if (!row) return null;
    const isPremium = !!row.is_premium;
    return {
      allowed: !!row.allowed,
      duplicate: !!row.duplicate,
      usedToday: Number(row.used_today ?? 0),
      remaining: num(row.remaining),
      limit: isPremium ? null : 3,
      isPremium,
    };
  } catch {
    return null;
  }
}
