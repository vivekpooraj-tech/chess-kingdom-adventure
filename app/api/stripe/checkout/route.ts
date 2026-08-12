import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import { getCountryFromRequest } from "@/lib/pricing/country";
import { getRegionalPrice } from "@/lib/pricing/regions";
import { validatePromoCode } from "@/lib/pricing/promo";

// One-time purchase — matches the PRD's business model ("no subscriptions,
// unlock everything forever"). Preserved unchanged for every region; only
// the currency/amount vary (lib/pricing/regions.ts), never the billing
// model itself.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // The only thing read from the request body is an optional promo code
  // string, re-validated against Stripe below — never trusted as-is, and
  // never a price, currency, or amount. Country (and therefore price) is
  // always re-derived from the request itself, not from anything the
  // client sent.
  const body = await request.json().catch(() => ({}) as { promoCode?: unknown });
  const requestedCode = typeof body?.promoCode === "string" ? body.promoCode : null;

  const country = getCountryFromRequest(request);
  const regionalPrice = getRegionalPrice(country);

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  try {
    const stripe = getStripe();

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    let appliedPromotionCodeId: string | null = null;
    if (requestedCode) {
      const result = await validatePromoCode(requestedCode, regionalPrice);
      if (!result.valid) {
        return NextResponse.json({ error: "Invalid or expired discount code." }, { status: 400 });
      }
      appliedPromotionCodeId = result.preview.promotionCodeId;
      discounts = [{ promotion_code: appliedPromotionCodeId }];
    }

    // UPI (the rail Google Pay/PhonePe/Paytm all use in India) is only a
    // valid Checkout payment_method_type when the session currency is INR —
    // Stripe's API rejects the session outright if it's included for any
    // other currency. regionalPrice.currency already resolves to "inr" for
    // country=IN (lib/pricing/regions.ts), so this stays in sync with the
    // existing regional-pricing logic automatically, no separate country
    // check needed. Whether UPI actually appears on the hosted Checkout
    // page also depends on UPI being enabled as a payment method on the
    // Stripe account itself (Dashboard → Settings → Payment methods) — that
    // account-level toggle is outside what this code can control.
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      regionalPrice.currency === "inr" ? ["card", "upi"] : ["card"];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: regionalPrice.currency,
            unit_amount: regionalPrice.amountMinor,
            product_data: {
              name: `${BRAND.name} — Premium`,
              description: "Unlock every day of the adventure, forever. No subscription.",
            },
          },
          quantity: 1,
        },
      ],
      // discounts and allow_promotion_codes are mutually exclusive on a
      // Checkout Session — if the customer already applied a code on our
      // own page, use it directly; otherwise leave Stripe's own hosted
      // page able to accept one as a fallback entry point.
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      // Carried through to the success page so we know which parent to
      // upgrade without relying solely on a webhook (see success/page.tsx
      // for why — no webhook forwarding needed for local dev this way).
      // country/currency are for traceability/debugging only — nothing
      // downstream trusts them over what was actually charged.
      metadata: {
        parent_id: parent.id,
        country,
        currency: regionalPrice.currency,
      },
      success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/kingdom-map`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session creation failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Check your Stripe API keys." },
      { status: 500 }
    );
  }
}
