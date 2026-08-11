import { NextRequest, NextResponse } from "next/server";
import { getCountryFromRequest } from "@/lib/pricing/country";
import { getRegionalPrice } from "@/lib/pricing/regions";

/**
 * Tells the client what price to display — the client never computes or
 * guesses this itself. Purely informational: /api/stripe/checkout
 * independently re-derives the same country/price server-side rather than
 * trusting anything this endpoint returned, so a tampered display value
 * here can't change what a customer is actually charged.
 */
export async function GET(request: NextRequest) {
  const country = getCountryFromRequest(request);
  const price = getRegionalPrice(country);
  return NextResponse.json(price);
}
