import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

// $29.99 one-time purchase — matches the PRD's business model ("no
// subscriptions, unlock everything forever").
const PREMIUM_PRICE_USD_CENTS = 2999;

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

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: PREMIUM_PRICE_USD_CENTS,
            product_data: {
              name: "Chess Kingdom Adventure — Premium",
              description: "Unlock every day of the adventure, forever. No subscription.",
            },
          },
          quantity: 1,
        },
      ],
      // Carried through to the success page so we know which parent to
      // upgrade without relying solely on a webhook (see success/page.tsx
      // for why — no webhook forwarding needed for local dev this way).
      metadata: { parent_id: parent.id },
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
