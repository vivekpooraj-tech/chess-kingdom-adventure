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

/** One-time purchase entitlement length.
 *
 * Phase 8B: changed 2 years -> 1 year (the approved V1 commercial model:
 * one-time for 1 year of Premium, no Stripe subscription). Every real call
 * site (app/api/stripe/webhook/route.ts, app/upgrade/success/page.tsx)
 * passes this value explicitly as the RPC's `p_duration` argument, so
 * changing it here is sufficient — no migration needed. The SQL function
 * grant_premium_entitlement()'s own `p_duration default interval '2 years'`
 * (migration 0031) is NOT updated: it is a dead default that neither call
 * site has ever relied on, since both always pass p_duration explicitly.
 * It's a purely cosmetic inconsistency in the migration file's default
 * value, not a functional one — see the Phase 8B report for why no
 * migration was made for it. */
export const PREMIUM_ENTITLEMENT_YEARS = 1;
export const PREMIUM_DURATION_LABEL = "1 year";
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
