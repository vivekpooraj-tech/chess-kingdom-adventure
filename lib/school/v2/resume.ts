/**
 * Where a child was inside a session, on this device.
 *
 * Progress is written once, when a session is finished — that is the right
 * unit for the cloud record and for what a parent is told. But a child who
 * refreshes at step four of five, or whose tablet falls asleep, or who taps the
 * wrong thing and ends up on the home screen, should not be sent back to the
 * first teach card. That is the single most common way a young child gives up
 * on a lesson: "it made me start again".
 *
 * So the step index is bookmarked on the device as the child moves, and read
 * back when the same session opens. It is deliberately NOT synced: a bookmark
 * is about this screen, and a session started on a phone and continued on a
 * tablet is a session started again — that is fine, because sessions are ten
 * minutes long and the cloud record is untouched either way.
 *
 * Cleared the moment the session is finished, so a replay starts from the top.
 */

const PREFIX = "cm.school.v2.step.";

const key = (childId: string, sessionId: string) => `${PREFIX}${childId}.${sessionId}`;

/** The bookmarked step index, or 0. Out-of-range or unreadable values are 0. */
export function readBookmark(childId: string, sessionId: string, stepCount: number): number {
  if (typeof window === "undefined" || !childId || !sessionId) return 0;
  try {
    const raw = window.localStorage.getItem(key(childId, sessionId));
    if (raw === null) return 0;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= stepCount) return 0;
    return n;
  } catch {
    return 0;
  }
}

export function writeBookmark(childId: string, sessionId: string, stepIndex: number): void {
  if (typeof window === "undefined" || !childId || !sessionId) return;
  try {
    if (stepIndex <= 0) window.localStorage.removeItem(key(childId, sessionId));
    else window.localStorage.setItem(key(childId, sessionId), String(stepIndex));
  } catch {
    /* storage unavailable — the child simply starts from the top next time */
  }
}

export function clearBookmark(childId: string, sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(childId, sessionId));
  } catch {
    /* nothing to do */
  }
}
