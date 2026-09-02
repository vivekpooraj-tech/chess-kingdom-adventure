import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";
import {
  PREMIUM_ENTITLEMENT_YEARS,
  PREMIUM_BILLING_NOTE,
  formatExpiryDate,
} from "@/lib/premium/entitlement";

/**
 * Instant-feedback counterpart to the Stripe webhook
 * (app/api/stripe/webhook/route.ts). Verifies payment directly against the
 * Stripe API using the session_id in the redirect URL — a URL param alone is
 * never treated as proof of payment. Both paths call the same idempotent
 * grant_premium_entitlement() RPC (migration 0031), so a double fire is a
 * no-op.
 *
 * If the tab is closed before this loads, the webhook still grants Premium.
 */
export default async function UpgradeSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect("/kingdom-map");

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  let paid = false;
  let expiresAtLabel: string | null = null;
  let errorMessage: string | null = null;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId!);
    const sessionParentId = session.metadata?.parent_id;

    const { data: parent } = await supabase
      .from("parents")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!parent || parent.id !== sessionParentId) {
      errorMessage = "This checkout session doesn't match your account.";
    } else if (session.payment_status !== "paid") {
      errorMessage = "Payment hasn't completed yet — check your Stripe dashboard.";
    } else {
      const admin = getSupabaseAdmin();
      const { data: expiresAt, error: rpcError } = await admin.rpc("grant_premium_entitlement", {
        p_parent_id: parent.id,
        p_checkout_session_id: session.id,
        p_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        p_amount_minor: session.amount_total ?? null,
        p_currency: session.currency ?? null,
        p_provider: "stripe",
        p_duration: `${PREMIUM_ENTITLEMENT_YEARS} years`,
      });

      if (rpcError) {
        errorMessage = "Payment succeeded, but we couldn't update your account. Contact support.";
      } else {
        paid = true;
        expiresAtLabel = formatExpiryDate(typeof expiresAt === "string" ? expiresAt : null);
      }
    }
  } catch {
    errorMessage = "Couldn't verify payment with Stripe. Try refreshing this page.";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        {paid ? (
          <>
            <span className="text-6xl">🎉</span>
            <h1 className="font-display text-2xl text-kingdom-night">Welcome to Premium!</h1>
            <p className="font-body text-kingdom-night/70">
              {BRAND.name} Premium is unlocked for {PREMIUM_ENTITLEMENT_YEARS} years.
              {expiresAtLabel ? ` Active until ${expiresAtLabel}.` : ""}
            </p>
            <p className="font-body text-xs text-kingdom-night/50">{PREMIUM_BILLING_NOTE}</p>
            <Link href="/kingdom-map">
              <Button>Back to the Kingdom →</Button>
            </Link>
          </>
        ) : (
          <>
            <span className="text-6xl">⚠️</span>
            <h1 className="font-display text-xl text-kingdom-night">Something needs a second look</h1>
            <p className="font-body text-kingdom-night/70">{errorMessage}</p>
            <Link href="/kingdom-map">
              <Button variant="ghost">Back to the Kingdom Map</Button>
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
