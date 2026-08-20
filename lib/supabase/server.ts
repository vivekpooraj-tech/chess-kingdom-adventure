import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Use this in Server Components, Route Handlers, and Server Actions.
 * Reading cookies here opts the calling route out of static generation
 * (Next.js marks it dynamic automatically) — that's expected for anything
 * behind auth.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component with no ability to set cookies —
            // safe to ignore because middleware.ts refreshes the session on
            // every request anyway.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        },
      },
    }
  );
}

/**
 * Same result as `(await supabase.auth.getUser()).data.user`, but skips the
 * network round trip to Supabase's Auth server when possible — middleware.ts
 * already did that exact verification for this request and forwards the
 * result via the `x-user-id` header (which it strips from the incoming
 * request first, so this can never be client-forged). Every route that
 * reaches a Server Component has already passed through middleware, so the
 * fallback below only matters for the rare case of a route outside its
 * matcher; it's a straight call to the real thing, never a weaker check.
 */
export async function getSessionUser(
  supabase: SupabaseClient
): Promise<{ id: string } | null> {
  const forwardedId = headers().get("x-user-id");
  if (forwardedId) {
    return { id: forwardedId };
  }
  let {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  // Same reasoning as middleware.ts's retry: a failed token refresh over a
  // flaky connection isn't proof the session is invalid, just that this one
  // attempt didn't land. One retry here catches the rare case this helper's
  // fallback path (no forwarded header) is actually exercised.
  if (!user && error && isAuthRetryableFetchError(error)) {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  }
  return user;
}
