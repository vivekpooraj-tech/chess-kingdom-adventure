/**
 * The Lichess connection of ONE Chess Mind profile, kept in this browser/WebView only.
 *
 * Why browser storage: v1 stores nothing in Supabase, and the Android WebView can be killed while the user is in the system browser, so a
 * memory-only token would be lost mid-sign-in. The token is therefore persisted per profile (key includes the child id — a sibling profile on
 * the same device never sees it), scoped to `board:play` only, and removed by Disconnect. It is never sent to our servers, put in a URL,
 * logged, or handed to the UI: `readConnection` returns the public username only; `readToken` is for the Lichess client code (Phase 2+).
 */

const KEY_PREFIX = "cm:lichess:conn:";

type Stored = { token: string; username: string; connectedAt: number; expiresAt: number | null };

export type LichessConnection = { username: string; connectedAt: number };

function key(childId: string): string {
  return `${KEY_PREFIX}${childId}`;
}

function read(childId: string): Stored | null {
  try {
    const raw = localStorage.getItem(key(childId));
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.token !== "string" || typeof s.username !== "string") return null;
    if (s.expiresAt && Date.now() > s.expiresAt) {
      localStorage.removeItem(key(childId));
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveConnection(childId: string, token: string, username: string, expiresInSec: number): void {
  const now = Date.now();
  const stored: Stored = { token, username, connectedAt: now, expiresAt: expiresInSec > 0 ? now + expiresInSec * 1000 : null };
  localStorage.setItem(key(childId), JSON.stringify(stored));
}

/** Public view only: never includes the token. */
export function readConnection(childId: string): LichessConnection | null {
  const s = read(childId);
  return s ? { username: s.username, connectedAt: s.connectedAt } : null;
}

/** For the Lichess API client only. Do not render, log or pass through props. */
export function readToken(childId: string): string | null {
  return read(childId)?.token ?? null;
}

export function clearConnection(childId: string): void {
  try {
    localStorage.removeItem(key(childId));
  } catch {
    /* nothing to clear */
  }
}
