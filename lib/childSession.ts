// Tracks which child profile is "active" on this device/browser — the
// multi-child equivalent of a streaming service's "who's watching?" picker.
//
// Deliberately a plain (non-httpOnly) cookie, not stored in Supabase or
// tied to the auth session: it's not sensitive (just a child ID the parent
// already has access to) and both Server Components (via next/headers) and
// Client Components (via document.cookie) need to read it, which a
// server-only httpOnly cookie couldn't support without extra API routes.

import { clearAllActiveChildCache } from "./supabase/activeChildCache";

const COOKIE_NAME = "cka_active_child";
/** Set by SignOutRow after a deliberate sign-out; middleware reads this in
 *  LOCAL_TEST_MODE so dev auto-signin does not immediately re-authenticate. */
export const EXPLICIT_SIGN_OUT_COOKIE_NAME = "cka_explicit_sign_out";
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
  // Immediate, not just eventually-consistent via the TTL -- see the
  // comment on clearAllActiveChildCache() for why this is defense-in-depth
  // rather than a correctness requirement.
  clearAllActiveChildCache();
}

export const ACTIVE_CHILD_COOKIE_NAME = COOKIE_NAME;

export function clearActiveChildIdClient() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  clearAllActiveChildCache();
}

/** Marks that the user explicitly signed out (survives a hard navigation). */
export function markExplicitSignOutClient() {
  if (typeof document === "undefined") return;
  document.cookie = `${EXPLICIT_SIGN_OUT_COOKIE_NAME}=1; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Cleared on a deliberate sign-in so LOCAL_TEST_MODE auto-signin resumes. */
export function clearExplicitSignOutClient() {
  if (typeof document === "undefined") return;
  document.cookie = `${EXPLICIT_SIGN_OUT_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
