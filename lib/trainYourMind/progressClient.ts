import type { SupabaseClient } from "@supabase/supabase-js";
import type { Level } from "./curriculum";
import { initialProgress, type ProgressState } from "./progression";

/**
 * Client for per-child progression (supabase/migrations/0054_train_your_mind_progress.sql).
 *
 * Fails OPEN like the history client: any error (offline, migration not yet applied
 * in an environment) yields a fresh Foundation state and a no-op save, so a child
 * is never blocked from training. The cost is only that progress would not follow
 * them across devices until the table is reachable.
 */

interface Row {
  module_id: string;
  level: number;
  best_level: number;
  attempts: number;
  correct: number;
  recent: unknown;
  last_ten: unknown;
  family_stats: unknown;
  mastered: boolean;
}

const clampL = (n: number): Level => (Math.min(5, Math.max(1, Math.round(n))) as Level);

export function rowToState(row: Row): ProgressState {
  const base = initialProgress();
  const recent = Array.isArray(row.recent) ? (row.recent as ProgressState["window"]) : [];
  const lastTen = Array.isArray(row.last_ten) ? (row.last_ten as ProgressState["lastTen"]) : [];
  const stats = row.family_stats && typeof row.family_stats === "object" && !Array.isArray(row.family_stats) ? (row.family_stats as ProgressState["familyStats"]) : {};
  return {
    ...base,
    level: clampL(row.level),
    bestLevel: clampL(row.best_level),
    attempts: Math.max(0, row.attempts | 0),
    correct: Math.max(0, row.correct | 0),
    window: recent.filter((w) => w && (w.c === 0 || w.c === 1)).slice(-10),
    lastTen: lastTen.filter((x) => x === 0 || x === 1).slice(-10),
    familyStats: stats,
    mastered: !!row.mastered,
  };
}

const COLUMNS = "module_id, level, best_level, attempts, correct, recent, last_ten, family_stats, mastered";

export async function loadProgress(supabase: SupabaseClient, childId: string, moduleId: string): Promise<ProgressState> {
  try {
    const { data, error } = await supabase
      .from("child_train_your_mind_progress")
      .select(COLUMNS)
      .eq("child_id", childId)
      .eq("module_id", moduleId)
      .maybeSingle();
    if (error || !data) return initialProgress();
    return rowToState(data as Row);
  } catch {
    return initialProgress();
  }
}

export async function loadAllProgress(supabase: SupabaseClient, childId: string): Promise<Record<string, ProgressState>> {
  try {
    const { data, error } = await supabase.from("child_train_your_mind_progress").select(COLUMNS).eq("child_id", childId);
    if (error || !data) return {};
    const out: Record<string, ProgressState> = {};
    for (const row of data as Row[]) out[row.module_id] = rowToState(row);
    return out;
  } catch {
    return {};
  }
}

export async function saveProgress(
  supabase: SupabaseClient,
  childId: string,
  moduleId: string,
  state: ProgressState
): Promise<void> {
  try {
    await supabase.rpc("save_train_your_mind_progress", {
      p_child_id: childId,
      p_module_id: moduleId,
      p_level: state.level,
      p_best_level: state.bestLevel,
      p_attempts: state.attempts,
      p_correct: state.correct,
      p_recent: state.window,
      p_last_ten: state.lastTen,
      p_family_stats: state.familyStats,
      p_mastered: state.mastered,
    });
  } catch {
    // best-effort
  }
}
