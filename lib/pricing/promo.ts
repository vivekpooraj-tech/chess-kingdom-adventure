import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { formatAmount, type RegionalPrice } from "./regions";

export interface PromoPreview {
  promotionCodeId: string;
  code: string;
  currency: string;
  originalMinor: number;
  discountMinor: number;
  finalMinor: number;
  display: { original: string; discount: string; final: string };
}

export type PromoValidationResult =
  | { valid: true; preview: PromoPreview }
  | { valid: false };

/**
 * Validates a customer-entered code against Stripe's actual Promotion Code
 * objects — never a locally-reimplemented discount calculation. Stripe
 * itself keeps `active` accurate against expiry (`expires_at`) and
 * redemption limits (`max_redemptions`), so filtering on `active: true`
 * here already excludes expired/exhausted/deactivated codes; nothing about
 * "is this code still good" is re-derived locally.
 *
 * The returned preview is informational only — the actual charge at
 * checkout is computed by Stripe itself from the `discounts` parameter on
 * the Checkout Session (see app/api/stripe/checkout/route.ts), not from
 * `finalMinor` here. Never trust a client-supplied preview when creating
 * the real session; always re-validate.
 *
 * Returns `{valid:false}` (never a thrown error or Stripe's own error
 * text) for: code not found, inactive/expired/exhausted, or a
 * fixed-amount coupon that doesn't support the customer's regional
 * currency (via `currency_options`) — all of these should read as a single
 * generic "Invalid or expired discount code." to the customer.
 */
export async function validatePromoCode(
  code: string,
  regionalPrice: RegionalPrice
): Promise<PromoValidationResult> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };

  const stripe = getStripe();
  const list = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 1,
    // currency_options doesn't come back from the top-level coupon expand
    // alone in this API version — confirmed by direct testing against a
    // real test-mode coupon; needs its own nested expand path.
    expand: ["data.promotion.coupon.currency_options"],
  });
  const promotionCode = list.data[0];
  if (!promotionCode) return { valid: false };

  // .list() types promotion.coupon as `string | Coupon | null` since it's
  // normally just an ID — the `expand` above guarantees it's the full
  // object here.
  const coupon = promotionCode.promotion.coupon as Stripe.Coupon;
  if (!coupon || !coupon.valid) return { valid: false };

  const originalMinor = regionalPrice.amountMinor;
  let discountMinor: number;

  if (coupon.percent_off != null) {
    discountMinor = Math.round((originalMinor * coupon.percent_off) / 100);
  } else if (coupon.amount_off != null) {
    // A fixed-amount coupon is currency-specific. Prefer a per-currency
    // override (currency_options) if the coupon has one for this region;
    // otherwise the coupon's own base currency must match, or applying it
    // at Checkout would fail — treated as "not valid for this customer"
    // rather than surfacing a confusing Stripe error later.
    const override = coupon.currency_options?.[regionalPrice.currency];
    if (override?.amount_off != null) {
      discountMinor = override.amount_off;
    } else if (coupon.currency === regionalPrice.currency) {
      discountMinor = coupon.amount_off;
    } else {
      return { valid: false };
    }
  } else {
    return { valid: false };
  }

  const finalMinor = Math.max(0, originalMinor - discountMinor);

  return {
    valid: true,
    preview: {
      promotionCodeId: promotionCode.id,
      code: promotionCode.code,
      currency: regionalPrice.currency,
      originalMinor,
      discountMinor,
      finalMinor,
      display: {
        original: formatAmount(regionalPrice.currency, originalMinor),
        discount: formatAmount(regionalPrice.currency, discountMinor),
        final: formatAmount(regionalPrice.currency, finalMinor),
      },
    },
  };
}
