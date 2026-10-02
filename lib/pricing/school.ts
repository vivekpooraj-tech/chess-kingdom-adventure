import type { RegionalPrice } from "./regions";

/**
 * Chess School — lifetime access, sold on its own.
 *
 * India: ₹199 (19900 paise). Every other country (and the missing-country
 * fallback) is USD $3.99 (399 cents) — never the old $19.99 list. Display
 * and checkout both use getSchoolRegionalPrice(); country is still recorded
 * on the Stripe session for analytics.
 */
const IN: RegionalPrice = { country: "IN", currency: "inr", amountMinor: 19900, display: "₹199" };
const INTERNATIONAL: RegionalPrice = { country: "US", currency: "usd", amountMinor: 399, display: "$3.99" };
const DEFAULT_PRICE: RegionalPrice = INTERNATIONAL;

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
  return countryCode.toUpperCase() === "IN" ? IN : INTERNATIONAL;
}
