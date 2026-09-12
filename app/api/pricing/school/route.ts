import { NextRequest, NextResponse } from "next/server";
import { getCountryFromRequest } from "@/lib/pricing/country";
import { getSchoolRegionalPrice } from "@/lib/pricing/school";

/**
 * What the classroom should display for the Chess School price. Informational
 * only, exactly like /api/pricing for Premium: the checkout route re-derives
 * country and amount itself and trusts nothing this returned.
 */
export async function GET(request: NextRequest) {
  const country = getCountryFromRequest(request);
  return NextResponse.json(getSchoolRegionalPrice(country));
}
