import { createBrowserClient } from "@supabase/ssr";
import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Use this in Client Components ("use client"). It reads/writes the auth
 * session via cookies automatically, kept in sync with the server client
 * below by middleware.ts.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Three outcomes, kept deliberately distinct — the whole "keeps asking me to
 * sign in" class of bugs came from collapsing the third into the second:
 *
 *  - "authed"        a valid session (fresh, or refreshed just now)
 *  - "unauthenticated" no session and none recoverable — a real sign-in is needed
 *  - "network-error"  couldn't reach Supabase to confirm either way. This is
 *                     NOT "signed out". The caller must keep whatever it was
 *                     showing (or a neutral "reconnecting" state) and try
 *                     again — never redirect to /sign-in on this.
 *
 * The common cold-start failure is a device radio still waking from sleep
 * right as the app tries to refresh an access token that expired while it
 * was backgrounded. One immediate retry never covered that; this backs off
 * over ~3s before giving up, which resolves the overwhelming majority.
 */
export type AuthState =
  | { status: "authed"; user: { id: string; email?: string } }
  | { status: "unauthenticated"; user: null }
  | { status: "network-error"; user: null };

const RETRY_DELAYS_MS = [250, 600, 1200];

export async function getAuthState(supabase: SupabaseClient): Promise<AuthState> {
  let lastRetryable = false;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const { data, error } = await supabase.auth.getSession();

    if (data.session?.user) {
      return { status: "authed", user: data.session.user };
    }

    // A clean "no session" with no error is a genuine signed-out state —
    // stop here, don't burn retries on it.
    if (!error) {
      return { status: "unauthenticated", user: null };
    }

    lastRetryable = isAuthRetryableFetchError(error);
    if (!lastRetryable) {
      // e.g. refresh_token_not_found / already-used — the session is really
      // gone and cannot be refreshed. This is the only non-explicit path
      // that should ever land someone back on sign-in.
      return { status: "unauthenticated", user: null };
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  return lastRetryable
    ? { status: "network-error", user: null }
    : { status: "unauthenticated", user: null };
}

/**
 * Back-compat wrapper for the ~30 pages that just need "who's signed in, or
 * null". It now benefits from the same backoff as getAuthState(). It still
 * returns null on a network error — callers that must tell "signed out" from
 * "offline" apart (the app's launch screen, the parent gate) should use
 * getAuthState() directly and NOT bounce to /sign-in on "network-error".
 */
export async function getVerifiedUser(supabase: SupabaseClient) {
  const state = await getAuthState(supabase);
  return state.user;
}
