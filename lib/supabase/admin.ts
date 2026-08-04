import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/**
 * Service-role client that bypasses Row Level Security entirely. Only ever
 * use this from trusted server-side code that has no user session to scope
 * to — like the Stripe webhook route, which Stripe calls directly with no
 * cookies or auth context at all. The normal cookie-based client
 * (lib/supabase/server.ts) can't work there since there's no browser
 * session behind the request.
 *
 * NEVER import this into any client-facing code path, and never let
 * SUPABASE_SERVICE_ROLE_KEY reach the browser (it isn't prefixed
 * NEXT_PUBLIC_ for exactly this reason).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for the Stripe webhook to upgrade accounts server-side."
    );
  }

  _admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
