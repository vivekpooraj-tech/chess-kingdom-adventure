/**
 * Ad architecture (Phase 15).
 *
 * There is NO ad provider or SDK in this app, and Phase 15 deliberately does
 * not add one. This module is the single entitlement gate an ad layer would
 * consult once a provider is integrated — so that integration is a matter of
 * rendering something where `shouldShowAds()` is true, never sprinkling
 * `!isPremium` checks around.
 *
 * Rules (from the Phase 15 brief):
 *   - Premium accounts never see ads.
 *   - Ads must never overlay the chessboard or interrupt an active game.
 *   - No ads during a lesson, a puzzle, or the Daily Challenge.
 */

/** Would a free account see ads at all right now? Premium => always false. */
export function shouldShowAds(isPremium: boolean): boolean {
  return !isPremium;
}

/** Surfaces where an ad must never appear, even for a free account. */
export const AD_FORBIDDEN_CONTEXTS = [
  "active_game",
  "chessboard",
  "daily_challenge",
  "lesson_in_progress",
  "puzzle_in_progress",
] as const;

export type AdContext = (typeof AD_FORBIDDEN_CONTEXTS)[number] | "home" | "kingdom_map" | "more" | "discover";

/** Whether an ad slot in `context` may render for this account. */
export function adsAllowedInContext(isPremium: boolean, context: AdContext): boolean {
  if (isPremium) return false;
  return !(AD_FORBIDDEN_CONTEXTS as readonly string[]).includes(context);
}
