import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCountryFromRequest } from "@/lib/pricing/country";
import { getRegionalPrice } from "@/lib/pricing/regions";
import { validatePromoCode } from "@/lib/pricing/promo";

const INVALID_MESSAGE = "Invalid or expired discount code.";

/**
 * Server-side "Apply" preview for the discount-code UI. This is display
 * only — the code is re-validated independently at actual checkout
 * (app/api/stripe/checkout/route.ts) rather than trusting whatever this
 * endpoint said a moment ago.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ valid: false, message: INVALID_MESSAGE });
  }

  const country = getCountryFromRequest(request);
  const regionalPrice = getRegionalPrice(country);

  try {
    const result = await validatePromoCode(code, regionalPrice);
    if (!result.valid) {
      return NextResponse.json({ valid: false, message: INVALID_MESSAGE });
    }
    return NextResponse.json({ valid: true, preview: result.preview });
  } catch (err) {
    // Never forward Stripe's own error text to the client.
    console.error("Promo code validation failed:", err);
    return NextResponse.json({ valid: false, message: INVALID_MESSAGE });
  }
}
