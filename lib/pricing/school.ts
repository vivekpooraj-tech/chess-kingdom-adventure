import type { RegionalPrice } from "./regions";

/**
 * Chess School — lifetime access, sold on its own.
 *
 * Server-authoritative fixed regional prices, exactly as lib/pricing/regions.ts
 * does for Premium: never converted from a live rate, never chosen by the
 * client. The client is told what to display via /api/pricing/school and the
 * checkout route re-derives the amount from the request's country itself.
 *
 * India is the requested price point: ₹199, one payment, forever. The other
 * entries are fixed local price points in the same style Premium uses
 * (₹299 / $29.99 / £24.99 …), sitting below Premium in every region because
 * Premium includes Chess School. They are placeholders in the same sense the
 * Premium ones are — flag for review before going live outside India.
 */
const IN: RegionalPrice = { country: "IN", currency: "inr", amountMinor: 19900, display: "₹199" };
const US: RegionalPrice = { country: "US", currency: "usd", amountMinor: 1999, display: "$19.99" };
const GB: RegionalPrice = { country: "GB", currency: "gbp", amountMinor: 1699, display: "£16.99" };
const EU: RegionalPrice = { country: "EU", currency: "eur", amountMinor: 1899, display: "€18.99" };
const CA: RegionalPrice = { country: "CA", currency: "cad", amountMinor: 2699, display: "CA$26.99" };
const AU: RegionalPrice = { country: "AU", currency: "aud", amountMinor: 2999, display: "AU$29.99" };
const DEFAULT_PRICE: RegionalPrice = US;

const EUROZONE_COUNTRIES = [
  "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "HR",
];

const COUNTRY_TO_PRICE: Record<string, RegionalPrice> = { IN, US, GB, CA, AU };
for (const c of EUROZONE_COUNTRIES) COUNTRY_TO_PRICE[c] = EU;

/** The product name and description as they appear on Stripe's hosted page
 *  and the receipt. Kept here so the checkout route and any UI say the same
 *  thing. */
export const SCHOOL_PRODUCT_NAME = "Chess School — Lifetime Access";
export const SCHOOL_PRODUCT_DESCRIPTION =
  "All 30 Chess School sessions with Ollie as coach — from zero to playing real people. One payment, yours forever.";

/** The metadata value that marks a Checkout Session as a Chess School sale.
 *  Read by the webhook and the purchase success page; never by Premium. */
export const SCHOOL_CHECKOUT_PRODUCT = "chess_school";

export function getSchoolRegionalPrice(countryCode: string | null | undefined): RegionalPrice {
  if (!countryCode) return DEFAULT_PRICE;
  return COUNTRY_TO_PRICE[countryCode.toUpperCase()] ?? DEFAULT_PRICE;
}
