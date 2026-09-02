import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type Stripe from "stripe";
import { PREMIUM_ENTITLEMENT_YEARS } from "@/lib/premium/entitlement";

/**
 * The durable source of truth for granting Premium. Stripe calls this
 * server-to-server regardless of what the browser does after checkout (the
 * success page — app/upgrade/success/page.tsx — is the instant-feedback
 * counterpart, and calls the exact same RPC).
 *
 * No user session exists here (Stripe sends no cookies), so this uses the
 * service-role admin client. grant_premium_entitlement() /
 * revoke_premium_entitlement() (migration 0031) are the only entitlement
 * write path and are idempotent — Stripe delivers events at least once, and
 * both this route and the success page may fire for the same session, so
 * every write below must be safe to repeat.
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
  // exact bytes it sent, so calling request.json() first would break it.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const parentId = session.metadata?.parent_id;

      if (parentId && session.payment_status === "paid") {
        const admin = getSupabaseAdmin();
        const { error } = await admin.rpc("grant_premium_entitlement", {
          p_parent_id: parentId,
          p_checkout_session_id: session.id,
          p_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          p_amount_minor: session.amount_total ?? null,
          p_currency: session.currency ?? null,
          p_provider: "stripe",
          p_duration: `${PREMIUM_ENTITLEMENT_YEARS} years`,
        });
        if (error) {
          console.error("Stripe webhook: grant_premium_entitlement failed", parentId, error);
          // Still 200 below — a 5xx makes Stripe retry, which won't fix a DB
          // config problem. Logged for manual follow-up.
        }
      } else {
        console.warn("Stripe webhook: checkout.session.completed missing parent_id or not paid.", {
          parentId,
          paymentStatus: session.payment_status,
        });
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (paymentIntentId) {
        const admin = getSupabaseAdmin();
        const { error } = await admin.rpc("revoke_premium_entitlement", {
          p_payment_intent_id: paymentIntentId,
        });
        if (error) {
          console.error("Stripe webhook: revoke_premium_entitlement failed", paymentIntentId, error);
        }
      }
    }
  } catch (err) {
    console.error("Stripe webhook: handler error (still ack'ing 200)", event.type, err);
  }

  // Acknowledge every event Stripe sends, handled or not.
  return NextResponse.json({ received: true });
}
