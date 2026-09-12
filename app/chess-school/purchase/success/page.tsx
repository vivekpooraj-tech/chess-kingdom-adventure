import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { Button } from "@/components/ui/Button";
import { OllieCoach } from "@/components/school/v2/Coach";
import { TEXT } from "@/lib/designSystem";
import { SCHOOL_CHECKOUT_PRODUCT } from "@/lib/pricing/school";
import { SCHOOL_PRICE_NOTE } from "@/lib/school/v2/access";

/**
 * Instant-feedback counterpart to the Stripe webhook for a Chess School sale —
 * the same role app/upgrade/success/page.tsx plays for Premium, and the same
 * rules: the session_id in the URL is never proof of anything on its own; the
 * session is fetched from Stripe, checked to be paid, checked to be THIS
 * product, and checked to belong to the signed-in parent, and only then is the
 * idempotent grant_school_entitlement() called. If the tab is closed before
 * this renders, the webhook still grants access.
 *
 * The product check is the one thing this page has that the Premium page
 * does not need: a Premium session landing here must not become a School
 * grant, and a School session must not become Premium there (which is handled
 * by never giving it `parent_id` — see checkout-school/route.ts).
 */
export default async function SchoolPurchaseSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect("/chess-school/classroom");

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  let granted = false;
  let errorMessage: string | null = null;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId!);

    const { data: parent } = await supabase
      .from("parents")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (session.metadata?.product !== SCHOOL_CHECKOUT_PRODUCT) {
      errorMessage = "This checkout wasn't for Chess School.";
    } else if (!parent || parent.id !== session.metadata?.school_parent_id) {
      errorMessage = "This checkout session doesn't match your account.";
    } else if (session.payment_status !== "paid") {
      errorMessage = "Payment hasn't completed yet — give it a moment and refresh.";
    } else {
      const admin = getSupabaseAdmin();
      const { error: rpcError } = await admin.rpc("grant_school_entitlement", {
        p_parent_id: parent.id,
        p_checkout_session_id: session.id,
        p_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        p_amount_minor: session.amount_total ?? null,
        p_currency: session.currency ?? null,
        p_provider: "stripe",
      });
      if (rpcError) {
        errorMessage = "Payment succeeded, but we couldn't unlock your account. Contact support.";
      } else {
        granted = true;
      }
    }
  } catch {
    errorMessage = "Couldn't verify payment with Stripe. Try refreshing this page.";
  }

  return (
    <TabPageShell>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-20 pt-4">
        {granted ? (
          <>
            <OllieCoach line="All thirty sessions are yours now. Forever. Let's get back to it." tone="proud" />
            <section className="rounded-premiumCard border border-premium-gold/40 bg-premium-gold/10 p-6 text-center">
              <p className="text-5xl" aria-hidden="true">
                🎓
              </p>
              <h1 className={`${TEXT.heading} mt-3`}>Chess School unlocked</h1>
              <p className={`${TEXT.body} mt-2`}>Lifetime access to every session, on every device you sign in on.</p>
              <p className={`${TEXT.caption} mt-2`}>{SCHOOL_PRICE_NOTE}</p>
            </section>
            <Link href="/chess-school/classroom">
              <Button tone="premium" block size="lg">
                Back to the classroom
              </Button>
            </Link>
          </>
        ) : (
          <>
            <OllieCoach line="Something needs a second look before I can unlock this." tone="warm" />
            <section className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-6 text-center">
              <p className="text-4xl" aria-hidden="true">
                ⚠️
              </p>
              <p className={`${TEXT.body} mt-3`}>{errorMessage}</p>
            </section>
            <Link href="/chess-school/classroom">
              <Button tone="premium" block>
                Back to the classroom
              </Button>
            </Link>
          </>
        )}
      </main>
    </TabPageShell>
  );
}
