import { createBrowserClient } from "@supabase/ssr";

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
