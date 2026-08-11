import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";

/**
 * Verifies payment directly against the Stripe API using the session_id
 * Stripe put in the redirect URL, rather than relying on a webhook.
 *
 * Why not a webhook (the usual best practice)? Webhooks need a public URL
 * Stripe can reach — testing that locally means installing and running the
 * Stripe CLI (`stripe listen --forward-to ...`) just to develop. Verifying
 * the session directly here works immediately in any environment, including
 * localhost, with zero extra tooling.
 *
 * Trade-off worth knowing before production: if someone closes the tab
 * before this page loads (e.g. flaky connection right after paying), this
 * path never runs and they won't be upgraded despite paying. A real webhook
 * handler is the durable fix for that edge case — this is fine for local
 * development and even a v1 launch with low traffic, but add the webhook
 * before this app has real payment volume.
 */
export default async function UpgradeSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    redirect("/kingdom-map");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  let paid = false;
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
      // premium_status is REVOKEd from direct client/RLS-scoped writes
      // (supabase/migrations/0018_secure_premium_status.sql) — this is now
      // the only other legitimate write path besides the webhook, and it
      // only runs after the payment_status/parent_id checks above, using
      // Stripe's own record of the session, not anything the client
      // claimed.
      const supabaseAdmin = getSupabaseAdmin();
      const { error: updateError } = await supabaseAdmin
        .from("parents")
        .update({ premium_status: "premium" })
        .eq("id", parent.id);

      if (updateError) {
        errorMessage = "Payment succeeded, but we couldn't update your account. Contact support.";
      } else {
        paid = true;
      }
    }
  } catch (err) {
    errorMessage = "Couldn't verify payment with Stripe. Try refreshing this page.";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        {paid ? (
          <>
            <span className="text-6xl">🎉</span>
            <h1 className="font-display text-2xl text-kingdom-night">
              Welcome to Premium!
            </h1>
            <p className="font-body text-kingdom-night/70">
              Every day of {BRAND.name} is unlocked, forever.
            </p>
            <Link href="/kingdom-map">
              <Button>Back to the Kingdom →</Button>
            </Link>
          </>
        ) : (
          <>
            <span className="text-6xl">⚠️</span>
            <h1 className="font-display text-xl text-kingdom-night">
              Something needs a second look
            </h1>
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
