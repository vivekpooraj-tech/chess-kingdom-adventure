// Tracks which child profile is "active" on this device/browser — the
// multi-child equivalent of a streaming service's "who's watching?" picker.
//
// Deliberately a plain (non-httpOnly) cookie, not stored in Supabase or
// tied to the auth session: it's not sensitive (just a child ID the parent
// already has access to) and both Server Components (via next/headers) and
// Client Components (via document.cookie) need to read it, which a
// server-only httpOnly cookie couldn't support without extra API routes.

const COOKIE_NAME = "cka_active_child";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function getActiveChildIdClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setActiveChildIdClient(childId: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    childId
  )}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export const ACTIVE_CHILD_COOKIE_NAME = COOKIE_NAME;
