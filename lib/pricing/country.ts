import type { NextRequest } from "next/server";

/**
 * Server-side-only country detection for pricing. Reads Vercel's
 * `x-vercel-ip-country` header — set by Vercel's edge network from the
 * actual connection, not something a client can set or override (any
 * client-supplied value with the same header name is overwritten by
 * Vercel before the request reaches this code). Never trust a country
 * field sent in a request body/query string for pricing decisions — only
 * this header (or its absence) may decide which regional price applies.
 *
 * Falls back to "US" when the header is missing (local dev, or Vercel
 * genuinely couldn't determine a country) — checkout must never break just
 * because geolocation is unavailable.
 */
export function getCountryFromRequest(request: NextRequest): string {
  const country = request.headers.get("x-vercel-ip-country");
  return country && country !== "XX" ? country.toUpperCase() : "US";
}
