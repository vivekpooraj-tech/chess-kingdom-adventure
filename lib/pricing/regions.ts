/**
 * Server-authoritative fixed regional pricing — never converted from a live
 * exchange rate. Only ever imported from server-side code (Route Handlers);
 * the client is told what to display via /api/pricing and never gets to
 * choose the currency, amount, or which of these entries applies.
 *
 * amountMinor is in the currency's smallest unit (cents/paise), matching
 * what Stripe's unit_amount expects.
 *
 * Prices beyond the explicitly-requested India ₹299 and unchanged US $29.99
 * are reasonable fixed local price points I chose (not a raw FX
 * conversion) — flag these for review before going live if you have
 * specific figures in mind.
 */
export interface RegionalPrice {
  country: string;
  currency: string;
  amountMinor: number;
  /** Pre-formatted for display — avoids Intl locale edge cases entirely. */
  display: string;
}

const IN: RegionalPrice = { country: "IN", currency: "inr", amountMinor: 29900, display: "₹299" };
const US: RegionalPrice = { country: "US", currency: "usd", amountMinor: 2999, display: "$29.99" };
const GB: RegionalPrice = { country: "GB", currency: "gbp", amountMinor: 2499, display: "£24.99" };
const EU: RegionalPrice = { country: "EU", currency: "eur", amountMinor: 2799, display: "€27.99" };
const CA: RegionalPrice = { country: "CA", currency: "cad", amountMinor: 3999, display: "CA$39.99" };
const AU: RegionalPrice = { country: "AU", currency: "aud", amountMinor: 4499, display: "AU$44.99" };
const DEFAULT_PRICE: RegionalPrice = US;

// Eurozone-19 — countries that use EUR as their actual currency. Not every
// EU member state (e.g. Sweden, Poland use their own currencies) and not
// exhaustive of every micro-state, but covers the real eurozone markets.
const EUROZONE_COUNTRIES = [
  "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "HR",
];

const COUNTRY_TO_PRICE: Record<string, RegionalPrice> = {
  IN,
  US,
  GB,
  CA,
  AU,
};
for (const c of EUROZONE_COUNTRIES) COUNTRY_TO_PRICE[c] = EU;

/**
 * Resolves an ISO 3166-1 alpha-2 country code (as detected server-side —
 * see lib/pricing/country.ts) to a fixed regional price. Unknown/missing
 * country codes fall back to the USD price rather than breaking checkout.
 */
export function getRegionalPrice(countryCode: string | null | undefined): RegionalPrice {
  if (!countryCode) return DEFAULT_PRICE;
  return COUNTRY_TO_PRICE[countryCode.toUpperCase()] ?? DEFAULT_PRICE;
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
 * discounted price reads consistently with the original ("₹299" -> "₹269",
 * not "269.00 INR"). Whole-currency amounts drop the decimals (matching
 * "₹299"); fractional amounts (e.g. "$29.99") keep exactly 2.
 */
export function formatAmount(currency: string, amountMinor: number): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency.toUpperCase() + " ";
  const major = amountMinor / 100;
  const text = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return `${symbol}${text}`;
}
