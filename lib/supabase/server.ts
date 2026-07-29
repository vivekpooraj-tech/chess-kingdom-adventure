import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
