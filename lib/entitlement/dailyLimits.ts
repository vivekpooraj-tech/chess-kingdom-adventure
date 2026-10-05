/**
 * The single registry of free-tier daily limits, per CHESS_MIND_IMPLEMENTATION_PLAN.md
 * §15 ("Daily-limit architecture"). Replaces the pattern of each feature
 * hardcoding its own limit constant and its own `>=` comparison inline.
 *
 * ONE SOURCE OF TRUTH PER LIMIT. `lib/premium/capabilities.ts`'s
 * `FREE_LIMITS` already exists and is the established, tested home for
 * Premium-related numeric limits (it predates this module — "Phase 15" in
 * its own header comment). Where a limit already lives there, this registry
 * re-exports it rather than defining a second, independently-maintained
 * copy of the same number. Only a limit `capabilities.ts` genuinely has no
 * equivalent for (Train Your Mind, below) gets a brand-new constant here.
 *
 * Deliberately pure and storage-agnostic: this module never reads or writes
 * a database row itself. Callers fetch today's usage count however that
 * feature already does it (Puzzles' existing `puzzle_preview_usage` table,
 * Train Your Mind's own table once Phase 4 adds it) and pass the number in.
 * That keeps this registry reusable across features with completely
 * different storage shapes, and means adding a new limited feature never
 * requires touching an existing one's storage.
 *
 * `null` means "no limit" everywhere in this module — used for Premium
 * accounts, never for "not yet implemented."
 */

import { FREE_LIMITS } from "@/lib/premium/capabilities";

export const DAILY_LIMITS = {
  /** Free-tier puzzles per day — sourced from lib/premium/capabilities.ts's
   * FREE_LIMITS.trainerPuzzlesPerDay, not redefined here. That value is also
   * numerically identical to content/lessons.ts's DAILY_PREVIEW_LIMIT (which
   * stays untouched — it also governs the Kingdom Journey lesson preview, a
   * system this phase does not touch), so there remain two call sites with
   * the same value for now; the fix here is that this module no longer adds
   * a *third*, independent copy of that number. */
  puzzles: FREE_LIMITS.trainerPuzzlesPerDay,
  /** Free-tier Train Your Mind: 3 completed exercises PER CATEGORY, per child, per calendar
   * day. The eight categories (Pattern, Visualization, Calculation, Memory, Spatial,
   * Mathematics, Reaction, Tactical Thinking) are counted independently, so each has its own
   * 3. Enforced server-side by supabase/migrations/0055_train_your_mind_global_daily_limit.sql
   * (its literal 3 must stay in sync with this value). No existing equivalent was found in lib/premium/capabilities.ts (its
   * FREE_LIMITS has no Train Your Mind entry) — this is a genuinely new
   * limit, not a duplicate of one that already exists elsewhere. Not yet
   * wired to any page — Phase 4 of the implementation plan. Present here
   * now so the registry's shape is settled before that phase starts. */
  trainYourMindPerCategory: 3,
} as const;

export type DailyLimitKey = keyof typeof DAILY_LIMITS;

/** A Premium account's limit for anything in this registry — always
 * unlimited. Chess School alone does NOT lift these limits (Chess School
 * and Premium are independent entitlements, per the approved matrix). */
export function dailyLimitFor(key: DailyLimitKey, isPremium: boolean): number | null {
  return isPremium ? null : DAILY_LIMITS[key];
}

/** Whether today's usage has reached (or passed) the limit. A `null` limit
 * (Premium) is never reached. */
export function isDailyLimitReached(usedToday: number, limit: number | null): boolean {
  if (limit === null) return false;
  return usedToday >= limit;
}

/** How many are left today, or `null` when unlimited — never negative. */
export function remainingToday(usedToday: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - usedToday);
}
