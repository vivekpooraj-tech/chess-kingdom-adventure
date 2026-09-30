/**
 * Chess Mind's single entitlement resolution layer — CHESS_MIND_IMPLEMENTATION_PLAN.md
 * §2 and §14 ("the new entitlement layer must compose existing systems, not
 * replace them").
 *
 * This module NEVER re-derives Premium or Chess School status itself. It
 * calls the two existing, unmodified sources of truth —
 * lib/premium/entitlement.ts's resolvePremiumState() and
 * lib/school/v2/access.ts's resolveSchoolAccess() — and composes their
 * answers into one object a feature can ask a single question of:
 * "does this account have access to X, and how much of it?"
 *
 * Framework-agnostic on purpose (no React, no Supabase import), matching
 * both modules it wraps, so it runs in Server Components, route handlers,
 * the client, and tests alike.
 *
 * ADOPTION IS GRADUAL BY DESIGN. Every existing call site that reads
 * resolvePremiumState/resolveSchoolAccess directly keeps working untouched.
 * Call sites move to resolveCapabilities() one at a time, in whichever
 * implementation phase already has a reason to touch that file — never as
 * a dedicated mass-refactor (see the implementation plan's Risk #2).
 */

import {
  resolvePremiumState,
  type ParentPremiumRow,
} from "@/lib/premium/entitlement";
import {
  resolveSchoolAccess,
  type SchoolEntitlementRow,
  type SchoolAccess,
} from "@/lib/school/v2/access";
import { dailyLimitFor } from "./dailyLimits";

/** The three tiers as your product brief names them. Not stored anywhere —
 * always derived fresh from the two real entitlement sources. */
export type Tier = "free" | "school" | "premium";

export interface Capabilities {
  tier: Tier;
  isPremium: boolean;
  /** Chess School's own access shape, unchanged — re-exported here so a
   * caller that only needs "am I premium or on School" doesn't have to
   * import two modules. */
  chessSchool: SchoolAccess;
  /** Free-tier daily allowance for puzzles; null once Premium. Chess School
   * alone does not lift this — Chess School and Premium are independent
   * entitlements, per the approved matrix. */
  puzzles: { dailyLimit: number | null };
  /** Free-tier daily allowance for Train Your Mind, per category; null once
   * Premium. Not yet wired to any page (Phase 4) — present now so the shape
   * is stable before that phase starts. */
  trainYourMind: { dailyLimitPerCategory: number | null };
}

/**
 * Resolve everything a page needs to know about what an account can access,
 * from the two rows that already decide it everywhere else in the app.
 *
 * Both rows are optional, exactly as resolveSchoolAccess already requires —
 * a caller that couldn't read one (offline, RLS denial, missing row) gets
 * free-tier capabilities rather than a thrown exception.
 */
export function resolveCapabilities(
  parentRow: ParentPremiumRow | null | undefined,
  schoolRow: SchoolEntitlementRow | null | undefined
): Capabilities {
  const premium = resolvePremiumState(parentRow);
  const chessSchool = resolveSchoolAccess(parentRow, schoolRow);
  const tier: Tier = premium.isPremium ? "premium" : chessSchool.hasFullAccess ? "school" : "free";

  return {
    tier,
    isPremium: premium.isPremium,
    chessSchool,
    puzzles: { dailyLimit: dailyLimitFor("puzzles", premium.isPremium) },
    trainYourMind: { dailyLimitPerCategory: dailyLimitFor("trainYourMindPerCategory", premium.isPremium) },
  };
}

export { isDailyLimitReached, remainingToday, dailyLimitFor, DAILY_LIMITS } from "./dailyLimits";
export type { DailyLimitKey } from "./dailyLimits";
