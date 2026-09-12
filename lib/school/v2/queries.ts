import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolProgress } from "@/content/school/types";
import { EMPTY_PROGRESS, normalizeProgress } from "./progress";
import { mergeProgress, readLocalProgress, writeLocalProgress } from "./storage";

/**
 * Reading and writing Chess School progress.
 *
 * ONE ROW PER CHILD. `child_school_progress` holds the whole record as a few
 * columns rather than an event log, because every screen wants the same
 * question answered — where is this child — and an event log would make that a
 * fold over history on every page load.
 *
 * NOTHING HERE THROWS AT A CHILD. A missing table (the migration is in git but
 * may not be applied), a dropped connection, an expired session: all of them
 * resolve to the device's own copy and the session continues. The only thing a
 * failure costs is durability across devices, and that is a much smaller price
 * than a child losing their first checkmate to an error boundary.
 *
 * The RLS policy on the table (parent owns child) is what actually protects
 * the data. This module never uses a service role and never accepts a
 * child_id it was not given by the caller's own session resolution.
 */

export const SCHOOL_PROGRESS_TABLE = "child_school_progress";

const COLUMNS = "completed_sessions, skill_tags, unlocks, graduated_at";

interface SchoolProgressRow {
  completed_sessions: number[] | null;
  skill_tags: string[] | null;
  unlocks: string[] | null;
  graduated_at: string | null;
}

function rowToProgress(row: SchoolProgressRow | null | undefined): SchoolProgress {
  if (!row) return EMPTY_PROGRESS;
  return normalizeProgress({
    completedSessions: row.completed_sessions ?? [],
    skillTags: row.skill_tags ?? [],
    unlocks: row.unlocks ?? [],
    graduatedAt: row.graduated_at,
  });
}

export interface LoadedProgress {
  progress: SchoolProgress;
  /** False when the server copy could not be read, so the UI can say so
   *  quietly rather than pretending everything synced. */
  synced: boolean;
}

/**
 * The child's progress, preferring the server and falling back to the device.
 *
 * The two are MERGED rather than one replacing the other: a session finished
 * while offline is real, and a server row that predates it must not delete it.
 */
export async function loadSchoolProgress(
  supabase: SupabaseClient,
  childId: string
): Promise<LoadedProgress> {
  const local = readLocalProgress(childId);
  try {
    const { data, error } = await supabase
      .from(SCHOOL_PROGRESS_TABLE)
      .select(COLUMNS)
      .eq("child_id", childId)
      .maybeSingle();

    if (error) return { progress: local, synced: false };

    const merged = mergeProgress(rowToProgress(data as SchoolProgressRow | null), local);
    writeLocalProgress(childId, merged);
    return { progress: merged, synced: true };
  } catch {
    return { progress: local, synced: false };
  }
}

/**
 * Persist progress. Always writes the device copy first, so the child keeps
 * their session even if the network call never lands.
 *
 * Returns whether the server accepted it — callers use that only to decide
 * whether to show a quiet "saved on this device" note, never to block.
 */
export async function saveSchoolProgress(
  supabase: SupabaseClient,
  childId: string,
  progress: SchoolProgress
): Promise<boolean> {
  writeLocalProgress(childId, progress);
  try {
    // merge_school_progress (migration 0043) UNIONS on the server, so a save
    // from one device can never drop a session another device recorded. It
    // runs as the signed-in parent under RLS — no service role involved.
    const { error } = await supabase.rpc("merge_school_progress", {
      p_child_id: childId,
      p_completed_sessions: progress.completedSessions,
      p_skill_tags: progress.skillTags,
      p_unlocks: progress.unlocks,
      p_graduated_at: progress.graduatedAt,
    });
    if (!error) return true;

    // Only if the RPC itself is absent (a database on an older shape) fall
    // back to a plain upsert. Any other error is a real failure — the device
    // copy already holds the session, and the next save will retry.
    if (error.code !== "PGRST202") return false;
    const { error: upsertError } = await supabase.from(SCHOOL_PROGRESS_TABLE).upsert(
      {
        child_id: childId,
        completed_sessions: progress.completedSessions,
        skill_tags: progress.skillTags,
        unlocks: progress.unlocks,
        graduated_at: progress.graduatedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "child_id" }
    );
    return !upsertError;
  } catch {
    return false;
  }
}

/**
 * Server-side read for a React Server Component.
 *
 * No local fallback here — there is no device on the server. A failure returns
 * the empty state and the client component re-reads with its own fallback once
 * it mounts, so a child on a device with local progress still sees it.
 */
export async function loadSchoolProgressServer(
  supabase: SupabaseClient,
  childId: string
): Promise<SchoolProgress> {
  try {
    const { data, error } = await supabase
      .from(SCHOOL_PROGRESS_TABLE)
      .select(COLUMNS)
      .eq("child_id", childId)
      .maybeSingle();
    if (error) return EMPTY_PROGRESS;
    return rowToProgress(data as SchoolProgressRow | null);
  } catch {
    return EMPTY_PROGRESS;
  }
}
