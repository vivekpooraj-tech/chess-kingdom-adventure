import type { ParentPremiumRow } from "@/lib/premium/entitlement";
import { resolvePremiumState } from "@/lib/premium/entitlement";

/**
 * Who can open Chess School.
 *
 * TWO WAYS IN, ONE ANSWER. Premium includes Chess School permanently. Chess
 * School can also be bought on its own (the intended Rs 199 one-off). Every
 * screen asks this module rather than re-deriving `premium_status === "premium"
 * || …` with its own idea of expiry — the same reason lib/premium/entitlement.ts
 * exists for Premium.
 *
 * FREE ACCESS IS NOT NOTHING. The first three sessions are open to everyone.
 * A course whose promise is "from zero to playing with real people" has to let
 * a child find out whether they like it, and a paywall on session 1 tests the
 * parent's patience rather than the product. Three sessions is enough to reach
 * "I moved a piece and a pawn became a Queen", which is the moment worth
 * paying for.
 *
 * Framework-agnostic on purpose: no React, no Supabase import, so this runs in
 * Server Components, route handlers, the client and the test suite.
 */

/** Sessions any account can play, paid or not. */
export const FREE_SESSION_LIMIT = 3;

/** The intended standalone price. Display only — no checkout reads this yet. */
export const SCHOOL_PRICE_LABEL = "₹199";
export const SCHOOL_PRICE_NOTE = "One payment. Yours forever.";

export interface SchoolEntitlementRow {
  /** NULL means lifetime. */
  expires_at?: string | null;
  /** Set by revoke_school_entitlement() on refund. A revoked row grants nothing. */
  revoked_at?: string | null;
}

/** Column list for `.select(...)` on school_entitlements wherever access is checked. */
export const SCHOOL_ENTITLEMENT_COLUMNS = "expires_at, revoked_at";

export interface SchoolAccess {
  /** True when every session is open. */
  hasFullAccess: boolean;
  /** Why — used for copy ("included with Premium" vs "you own Chess School"). */
  source: "premium" | "school_purchase" | "free";
  /** Highest session number this account may open. */
  maxSession: number;
}

/**
 * Resolve access from the two rows that decide it.
 *
 * Both are optional: a caller that could not read one (offline, missing table,
 * RLS denial) passes null and gets free-tier access rather than an exception.
 * Failing CLOSED to the free tier is right here — it costs a paying parent a
 * reload, whereas failing open would give the course away on every transient
 * database error.
 */
export function resolveSchoolAccess(
  parentRow: ParentPremiumRow | null | undefined,
  schoolRow: SchoolEntitlementRow | null | undefined,
  now: Date = new Date()
): SchoolAccess {
  if (resolvePremiumState(parentRow).isPremium) {
    return { hasFullAccess: true, source: "premium", maxSession: Number.POSITIVE_INFINITY };
  }

  if (schoolRow && !schoolRow.revoked_at) {
    const raw = schoolRow.expires_at ?? null;
    const alive = !raw || (() => {
      const ms = Date.parse(raw);
      // An unparseable timestamp on a row that exists means somebody paid and
      // the date is malformed. Honour the purchase.
      return Number.isNaN(ms) ? true : ms > now.getTime();
    })();
    if (alive) {
      return { hasFullAccess: true, source: "school_purchase", maxSession: Number.POSITIVE_INFINITY };
    }
  }

  return { hasFullAccess: false, source: "free", maxSession: FREE_SESSION_LIMIT };
}

/** Whether one session is open under this access level. */
export function canOpenSession(access: SchoolAccess, sessionNumber: number): boolean {
  return sessionNumber <= access.maxSession;
}

/** The line shown on a locked session card. */
export function lockedReason(access: SchoolAccess): string {
  if (access.hasFullAccess) return "";
  return `The first ${FREE_SESSION_LIMIT} sessions are free. Unlock the rest for ${SCHOOL_PRICE_LABEL}.`;
}
