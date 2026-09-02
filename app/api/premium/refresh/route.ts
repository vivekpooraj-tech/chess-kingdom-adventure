import { NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  PARENT_PREMIUM_COLUMNS,
  resolvePremiumState,
  FREE_STATE,
} from "@/lib/premium/entitlement";

export const dynamic = "force-dynamic";

/**
 * "Refresh / restore Premium" for the account screen.
 *
 * Re-derives parents.premium_status + premium_expires_at from the parent's
 * verified premium_entitlements rows via the service-role RPC
 * sync_premium_from_entitlements() — recovering a stale cache flag (e.g. a
 * webhook that wrote the entitlement row but not the parents row). It never
 * grants Premium on its own: with no entitlement rows it is a no-op, so it
 * cannot be used to self-upgrade. A genuinely missed payment (no entitlement
 * row at all) is still recovered only by re-hitting the Stripe success URL
 * or the webhook.
 */
export async function POST() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!parent) {
    return NextResponse.json({ error: "No parent record found" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { error: rpcError } = await admin.rpc("sync_premium_from_entitlements", {
      p_parent_id: parent.id,
    });
    if (rpcError) {
      console.error("premium refresh: sync_premium_from_entitlements failed", rpcError);
    }
  } catch (err) {
    // Missing service-role config etc. — fall through to just returning the
    // current (un-synced) state rather than 500ing.
    console.error("premium refresh: could not reach Supabase admin", err);
  }

  const { data: fresh } = await supabase
    .from("parents")
    .select(PARENT_PREMIUM_COLUMNS)
    .eq("id", parent.id)
    .single();

  return NextResponse.json(fresh ? resolvePremiumState(fresh) : FREE_STATE);
}
