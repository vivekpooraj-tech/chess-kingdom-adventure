/**
 * Central Free vs Premium capability model (Phase 15).
 *
 * One place to describe what Premium unlocks and what limits a Free account
 * lives with — so gating reads `hasPremiumCapability(isPremium, "...")`
 * instead of scattering bare `if (premium)` checks with per-site copies of
 * the feature list. All Premium capabilities unlock together with the single
 * one-time 2-year entitlement (see lib/premium/entitlement.ts); there are no
 * partial tiers.
 *
 * IMPORTANT: core chess play is NEVER a Premium capability — see
 * ALWAYS_FREE. Do not gate anything in that list.
 */

/** Numeric limits that apply to a Free account. Premium removes each. Where
 * a limit is also enforced server-side, the authoritative copy lives in SQL
 * (e.g. the free-game "2 per 24h" in migration 0019/0031); these constants
 * are the client-facing / display copy and must be kept in sync. */
export const FREE_LIMITS = {
  /** Puzzle Trainer puzzles per day (content/lessons.ts DAILY_PREVIEW_LIMIT).
   * Daily Challenge is separate and always free. */
  trainerPuzzlesPerDay: 3,
  /** Most recent games visible in history. */
  gameHistoryCount: 30,
  /** Full engine analyses per day. */
  engineAnalysesPerDay: 2,
  /** Best-move suggestions per day. */
  bestMoveSuggestionsPerDay: 5,
  /** Free games vs computer per rolling 24h (migration 0019). */
  aiGamesPer24h: 2,
  /** Free multiplayer games per rolling 24h (migration 0019). */
  multiplayerGamesPer24h: 2,
} as const;

export type PremiumCapability =
  | "unlimited_puzzles"
  | "unlimited_puzzle_history"
  | "unlimited_game_analysis"
  | "deep_engine_analysis"
  | "advanced_blunder_detection"
  | "full_opening_explorer"
  | "unlimited_game_history"
  | "detailed_statistics"
  | "opening_statistics"
  | "blunder_pattern_insights"
  | "full_ai_coach"
  | "unlimited_custom_training"
  | "premium_themes"
  | "ad_free"
  | "premium_cloud_history";

export const PREMIUM_CAPABILITIES: readonly PremiumCapability[] = [
  "unlimited_puzzles",
  "unlimited_puzzle_history",
  "unlimited_game_analysis",
  "deep_engine_analysis",
  "advanced_blunder_detection",
  "full_opening_explorer",
  "unlimited_game_history",
  "detailed_statistics",
  "opening_statistics",
  "blunder_pattern_insights",
  "full_ai_coach",
  "unlimited_custom_training",
  "premium_themes",
  "ad_free",
  "premium_cloud_history",
];

/**
 * Things that must stay usable for a Free account, forever. Listed
 * explicitly so a future contributor can see at a glance what Premium must
 * never take away. Nothing here should ever be passed to a PremiumGate.
 */
export const ALWAYS_FREE = [
  "play_vs_computer",
  "online_friend_play",
  "basic_matchmaking",
  "basic_boards_and_pieces",
  "lessons_journey_free_days",
  "daily_challenge",
  "trainer_puzzles_daily_allowance",
  "basic_puzzle_feedback",
  "basic_engine_analysis",
  "best_move_suggestions_daily_allowance",
  "basic_blunder_detection",
  "limited_opening_explorer",
  "basic_statistics",
  "recent_game_history",
  "limited_ai_coach",
  "limited_custom_training",
  "basic_themes",
] as const;

/** Short, parent-facing benefit lines for the paywall. Keep to the few that
 * land on a small screen — do not dump the whole capability list. */
export const PREMIUM_HEADLINE_BENEFITS = [
  "Unlimited puzzles",
  "Deeper game analysis",
  "Full AI Coach",
  "Detailed progress & statistics",
  "Unlimited history",
  "No ads",
] as const;

/** Every Premium capability unlocks with the single 2-year entitlement. */
export function hasPremiumCapability(isPremium: boolean, _capability: PremiumCapability): boolean {
  return isPremium;
}
