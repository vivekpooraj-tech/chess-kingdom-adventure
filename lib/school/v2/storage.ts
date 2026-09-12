import type { SchoolProgress } from "@/content/school/types";
import { EMPTY_PROGRESS, normalizeProgress } from "./progress";

/**
 * Per-device Chess School progress.
 *
 * WHY A LOCAL COPY EXISTS AT ALL. The durable home for progress is Postgres
 * (supabase/migrations/0043_chess_school_v2.sql). But migrations in this
 * repository are a backlog rather than a description of the live database —
 * a table can exist in git and not exist in production — and a child halfway
 * through Fork Festival must not lose the session because a migration has not
 * been applied yet.
 *
 * So every write goes to BOTH places and every read prefers the server:
 *
 *   server row exists  -> that is the truth, and it is mirrored locally
 *   server unreachable -> the local mirror carries the session
 *   neither            -> a genuinely new learner, empty state
 *
 * This is a cache and a safety net, never an authority. It is keyed by child
 * so two children on one tablet cannot read each other's progress, and it is
 * merged rather than overwritten on reconnect (see mergeProgress) so a session
 * finished offline is not thrown away by a stale server row.
 */

const KEY_PREFIX = "cm.school.v2.";

function key(childId: string): string {
  return `${KEY_PREFIX}${childId}`;
}

/** Reads the device's copy. Returns the empty state for anything unreadable —
 *  private-mode browsers throw on access, and that must not break the page. */
export function readLocalProgress(childId: string): SchoolProgress {
  if (typeof window === "undefined" || !childId) return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(key(childId));
    if (!raw) return EMPTY_PROGRESS;
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Best-effort write. Storage being unavailable is never an error a child sees. */
export function writeLocalProgress(childId: string, progress: SchoolProgress): void {
  if (typeof window === "undefined" || !childId) return;
  try {
    window.localStorage.setItem(key(childId), JSON.stringify(progress));
  } catch {
    /* quota, private mode, blocked site data — the server copy still stands */
  }
}

/**
 * Combine two progress records without losing anything.
 *
 * Union on every collection and the EARLIER graduation date, because both
 * sides are records of things that really happened. A child who finished
 * session 12 on a plane and session 13 at home has done both, and neither copy
 * is allowed to erase the other.
 */
export function mergeProgress(a: SchoolProgress, b: SchoolProgress): SchoolProgress {
  const graduatedAt =
    a.graduatedAt && b.graduatedAt
      ? a.graduatedAt < b.graduatedAt
        ? a.graduatedAt
        : b.graduatedAt
      : a.graduatedAt ?? b.graduatedAt;

  return normalizeProgress({
    completedSessions: [...a.completedSessions, ...b.completedSessions],
    skillTags: [...a.skillTags, ...b.skillTags],
    unlocks: [...a.unlocks, ...b.unlocks],
    graduatedAt,
  });
}
