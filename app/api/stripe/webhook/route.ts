import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type Stripe from "stripe";

/**
 * The reliable counterpart to app/upgrade/success/page.tsx's client-side
 * verification. That page gives instant UI feedback right after checkout,
 * but only runs if the browser tab stays open long enough to load it — if
 * someone closes the tab the moment they finish paying, that page never
 * runs and they'd stay on the free plan despite paying. Stripe calls this
 * route directly, server-to-server, regardless of what the browser does,
 * so it's the actual source of truth. Both paths write the same field, so
 * there's no conflict if both fire — the second write is just a no-op.
 *
 * No user session exists here (Stripe has no cookies for this app), so this
 * uses the service-role admin client instead of the normal cookie-based one.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("Stripe webhook: missing signature header or STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Must be the raw, unparsed body — Stripe's signature is computed over the
  // exact bytes it sent, so calling request.json() first (which consumes and
  // reformats the body) would break verification.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const parentId = session.metadata?.parent_id;

    if (parentId && session.payment_status === "paid") {
      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin
        .from("parents")
        .update({ premium_status: "premium" })
        .eq("id", parentId);

      if (error) {
        console.error("Stripe webhook: failed to upgrade parent", parentId, error);
        // Still return 200 below — a 4xx/5xx here makes Stripe retry, which
        // won't help if the problem is our own DB config rather than a
        // transient blip. The error is logged for manual follow-up either way.
      }
    } else {
      console.warn(
        "Stripe webhook: checkout.session.completed with no parent_id metadata or unpaid status.",
        { parentId, paymentStatus: session.payment_status }
      );
    }
  }

  // Acknowledge receipt regardless of event type — Stripe expects a 200 for
  // any event it sends, not just the ones this app cares about.
  return NextResponse.json({ received: true });
}
