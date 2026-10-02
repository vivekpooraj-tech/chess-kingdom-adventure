/**
 * Server-authoritative Premium pricing — never converted from a live
 * exchange rate. Only ever imported from server-side code (Route Handlers);
 * the client is told what to display via /api/pricing and never gets to
 * choose the currency, amount, or which of these entries applies.
 *
 * amountMinor is in the currency's smallest unit (cents/paise), matching
 * what Stripe's unit_amount expects.
 *
 * India: ₹349 (34900 paise). Every other country (and the missing-country)
 * fallback) is USD $7.99 (799 cents). Billing remains a one-time Stripe
 * Checkout payment (see app/api/stripe/checkout/route.ts); entitlement
 * length is PREMIUM_ENTITLEMENT_YEARS.
 */
export interface RegionalPrice {
  country: string;
  currency: string;
  amountMinor: number;
  /** Pre-formatted for display — avoids Intl locale edge cases entirely. */
  display: string;
}

const IN: RegionalPrice = { country: "IN", currency: "inr", amountMinor: 34900, display: "₹349" };
const INTERNATIONAL: RegionalPrice = { country: "US", currency: "usd", amountMinor: 799, display: "$7.99" };
const DEFAULT_PRICE: RegionalPrice = INTERNATIONAL;

/**
 * Resolves an ISO 3166-1 alpha-2 country code (as detected server-side —
 * see lib/pricing/country.ts) to a fixed regional price. Only IN uses INR;
 * every other code (and missing/unknown) uses the international USD price.
 */
export function getRegionalPrice(countryCode: string | null | undefined): RegionalPrice {
  if (!countryCode) return DEFAULT_PRICE;
  return countryCode.toUpperCase() === "IN" ? IN : INTERNATIONAL;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  inr: "₹",
  usd: "$",
  gbp: "£",
  eur: "€",
  cad: "CA$",
  aud: "AU$",
};

/**
 * Formats an arbitrary minor-unit amount (e.g. a post-discount total) using
 * the same symbol style as the hardcoded `display` strings above, so a
 * discounted price reads consistently with the original ("₹349" -> "₹319",
 * not "319.00 INR"). Whole-currency amounts drop the decimals (matching
 * "₹349"); fractional amounts (e.g. "$7.99") keep exactly 2.
 */
export function formatAmount(currency: string, amountMinor: number): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency.toUpperCase() + " ";
  const major = amountMinor / 100;
  const text = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return `${symbol}${text}`;
}
