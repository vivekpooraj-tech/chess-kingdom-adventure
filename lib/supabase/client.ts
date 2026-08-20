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

/**
 * The client-side counterpart to getSessionUser() in lib/supabase/server.ts
 * — every "use client" page that gates itself on "is someone signed in"
 * should call this instead of supabase.auth.getUser()/getSession() directly.
 *
 * getSession() first: it reads the already-verified session from storage
 * with no network call when the access token hasn't expired yet — the
 * common case for an already-open app. Only when the token HAS expired
 * (typically after the app sat backgrounded for over an hour — exactly the
 * "reopened the app" moment) does the SDK attempt a real network refresh,
 * and that's the single point of failure that was logging genuinely
 * signed-in users out: a mobile radio still waking from sleep, or any
 * other momentary network blip, made the refresh fail once, which this
 * app's pages then treated identically to "never signed in" and bounced
 * to a fresh magic-link request. One retry here resolves the overwhelming
 * majority of those — they're momentary, not sustained outages.
 */
export async function getVerifiedUser(supabase: SupabaseClient) {
  let {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (!session && error && isAuthRetryableFetchError(error)) {
    ({
      data: { session },
    } = await supabase.auth.getSession());
  }
  return session?.user ?? null;
}
