import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import { getCountryFromRequest } from "@/lib/pricing/country";
import { getRegionalPrice } from "@/lib/pricing/regions";
import { validatePromoCode } from "@/lib/pricing/promo";
import { PREMIUM_ENTITLEMENT_YEARS, PREMIUM_DURATION_LABEL } from "@/lib/premium/entitlement";

// One-time purchase (Stripe mode: "payment", never a subscription) — a
// single payment that unlocks Premium for a fixed term (see
// PREMIUM_ENTITLEMENT_YEARS). Only the currency/amount vary by region
// (lib/pricing/regions.ts); the billing model never does. The entitlement
// itself (term, expiry) is granted server-side from the verified webhook /
// success-page call to grant_premium_entitlement() — nothing here is
// trusted for that.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  // Phase 8B-hardening: getSessionUser() (fast x-user-id header path from
  // middleware, plus one retry on a retryable Supabase fetch error) instead
  // of a raw supabase.auth.getUser() call — a transient network blip during
  // checkout previously failed auth immediately rather than retrying once,
  // exactly the "keeps asking me to sign in" bug class this wrapper exists
  // to prevent. Behavior for a genuinely unauthenticated request (401) is
  // unchanged.
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
              // Phase 8B: uses the pre-pluralized label (PREMIUM_DURATION_LABEL,
              // "1 year") rather than interpolating PREMIUM_ENTITLEMENT_YEARS
              // directly — that raw number is still correct for the RPC's
              // interval string below (Postgres accepts "1 years" fine), but
              // "Premium (1 years)" would be wrong English on the actual
              // Stripe-hosted checkout page a customer sees.
              name: `${BRAND.name} — Premium (${PREMIUM_DURATION_LABEL})`,
              description: `Unlimited puzzles, deeper analysis, full AI Coach, detailed progress and no ads for ${PREMIUM_DURATION_LABEL}. One payment — no recurring subscription.`,
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
        entitlement_years: String(PREMIUM_ENTITLEMENT_YEARS),
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
