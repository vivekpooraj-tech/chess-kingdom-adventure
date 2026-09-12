import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import { getCountryFromRequest } from "@/lib/pricing/country";
import {
  SCHOOL_CHECKOUT_PRODUCT,
  SCHOOL_PRODUCT_DESCRIPTION,
  SCHOOL_PRODUCT_NAME,
  getSchoolRegionalPrice,
} from "@/lib/pricing/school";

/**
 * Chess School — Lifetime Access. A one-time payment (Stripe mode "payment",
 * never a subscription) for the standalone School entitlement.
 *
 * A SEPARATE ROUTE, NOT A FLAG ON /api/stripe/checkout. The Premium route is
 * live, tested and byte-identical after this change. Sharing it would mean a
 * request-body field deciding which product gets charged, and a bug in that
 * branch could sell the wrong thing. Two routes, two products, no shared
 * decision.
 *
 * THE INVARIANT THIS ROUTE MUST NEVER BREAK: a Chess School session carries
 * NO `metadata.parent_id`. The existing /upgrade/success page grants two
 * years of PREMIUM to any paid session whose metadata.parent_id matches the
 * signed-in parent, and checks neither the amount nor the product. If this
 * session carried parent_id, a buyer could open /upgrade/success with its
 * session_id and redeem ₹199 as ₹299 Premium. The parent is identified here
 * under a different key (`school_parent_id`) precisely so that page cannot
 * recognise it. scripts/test-chess-school-v2.js asserts this file never
 * emits `parent_id:`.
 *
 * Everything else mirrors the Premium route: country and price derived from
 * the request, not the body; the entitlement granted only from the verified
 * webhook / success page via grant_school_entitlement(); UPI offered for INR.
 */
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

  const country = getCountryFromRequest(request);
  const price = getSchoolRegionalPrice(country);
  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  try {
    const stripe = getStripe();

    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      price.currency === "inr" ? ["card", "upi"] : ["card"];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: price.currency,
            unit_amount: price.amountMinor,
            product_data: {
              name: `${BRAND.name} — ${SCHOOL_PRODUCT_NAME}`,
              description: SCHOOL_PRODUCT_DESCRIPTION,
            },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        product: SCHOOL_CHECKOUT_PRODUCT,
        // Deliberately NOT `parent_id` — see the invariant above.
        school_parent_id: parent.id,
        country,
        currency: price.currency,
      },
      success_url: `${origin}/chess-school/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/chess-school/classroom`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Chess School checkout session creation failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Check your Stripe API keys." },
      { status: 500 }
    );
  }
}
