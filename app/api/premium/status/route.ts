import { NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  PARENT_PREMIUM_COLUMNS,
  resolvePremiumState,
  FREE_STATE,
} from "@/lib/premium/entitlement";

export const dynamic = "force-dynamic";

/**
 * Server-authoritative Premium status for the signed-in parent. The client
 * calls this on load and after returning from Stripe Checkout — it never
 * decides Premium from a URL param or localStorage. Read-only.
 */
export async function GET() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: parent, error } = await supabase
    .from("parents")
    .select(`id, ${PARENT_PREMIUM_COLUMNS}`)
    .eq("auth_user_id", user.id)
    .single();

  if (error || !parent) {
    // Fail closed to Free rather than 500 — a transient read failure must
    // never *grant* Premium, and the UI degrades to "upgrade available".
    return NextResponse.json({ ...FREE_STATE, entitlement: null });
  }

  const state = resolvePremiumState(parent);

  // Purchase record for the account screen (RLS lets a parent read only
  // their own rows).
  const { data: entitlements } = await supabase
    .from("premium_entitlements")
    .select("provider, amount_minor, currency, purchased_at, expires_at, status")
    .eq("parent_id", parent.id)
    .order("expires_at", { ascending: false })
    .limit(1);

  const latest = entitlements?.[0] ?? null;

  return NextResponse.json({
    ...state,
    entitlement: latest
      ? {
          provider: latest.provider,
          amountMinor: latest.amount_minor,
          currency: latest.currency,
          purchasedAt: latest.purchased_at,
          expiresAt: latest.expires_at,
          status: latest.status,
        }
      : null,
  });
}
