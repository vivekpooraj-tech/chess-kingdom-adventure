/**
 * The single place the app answers "is this account currently Premium?".
 *
 * Server-authoritative: Premium lives in the database (parents.premium_status
 * + parents.premium_expires_at, backed by public.premium_entitlements — see
 * supabase/migrations/0031_premium_entitlements.sql). Every code path that
 * needs the answer reads those two columns and passes the row through
 * resolvePremiumState() rather than re-implementing `=== "premium"` with its
 * own idea of expiry. Never trust a URL param, localStorage, or a React
 * state flag as proof of Premium.
 *
 * This module is framework-agnostic (no React, no Supabase import) so it can
 * be used from Server Components, Route Handlers, the client, and tests.
 */

/** Column list for `.select(...)` on the `parents` table wherever Premium is checked. */
export const PARENT_PREMIUM_COLUMNS = "premium_status, premium_expires_at";

/** One-time purchase entitlement length. Keep in sync with
 * grant_premium_entitlement()'s `p_duration` default in migration 0031. */
export const PREMIUM_ENTITLEMENT_YEARS = 2;
export const PREMIUM_DURATION_LABEL = "2 years";
/** Currency-agnostic reassurance line shown under every price. */
export const PREMIUM_BILLING_NOTE = "One payment. No recurring subscription.";

export interface ParentPremiumRow {
  premium_status?: string | null;
  premium_expires_at?: string | null;
}

export interface PremiumState {
  /** True only if the account is Premium AND not past its expiry. */
  isPremium: boolean;
  /** ISO timestamp the entitlement lapses, or null when there is no expiry
   * (a legacy "forever" purchase) or the account is not Premium at all. */
  expiresAt: string | null;
  /** True when the account was Premium but the entitlement has lapsed —
   * lets the UI say "your Premium expired" rather than "upgrade". */
  isExpired: boolean;
  /** Whole days until expiry (ceil), or null when not applicable. */
  daysRemaining: number | null;
}

export const FREE_STATE: PremiumState = {
  isPremium: false,
  expiresAt: null,
  isExpired: false,
  daysRemaining: null,
};

/**
 * Derives Premium state from a `parents` row. Mirrors the SQL
 * parent_is_premium() exactly: premium_status = 'premium' AND
 * (premium_expires_at IS NULL OR premium_expires_at > now()).
 */
export function resolvePremiumState(row: ParentPremiumRow | null | undefined): PremiumState {
  const status = row?.premium_status ?? "free";
  if (status !== "premium") return FREE_STATE;

  const raw = row?.premium_expires_at ?? null;
  if (!raw) {
    // Premium with no expiry — grandfathered "forever" purchase.
    return { isPremium: true, expiresAt: null, isExpired: false, daysRemaining: null };
  }

  const expiryMs = Date.parse(raw);
  if (Number.isNaN(expiryMs)) {
    // Unparseable timestamp — fail open to "active, no expiry shown" rather
    // than yanking access from someone who paid.
    return { isPremium: true, expiresAt: null, isExpired: false, daysRemaining: null };
  }

  const now = Date.now();
  if (expiryMs > now) {
    return {
      isPremium: true,
      expiresAt: raw,
      isExpired: false,
      daysRemaining: Math.ceil((expiryMs - now) / 86_400_000),
    };
  }
  return { isPremium: false, expiresAt: raw, isExpired: true, daysRemaining: 0 };
}

/** "2 September 2028" style, for the account screen. Returns null for no expiry. */
export function formatExpiryDate(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
