export type AchievementCriteria =
  | { type: "complete_day"; day: number }
  | { type: "complete_count"; count: number }
  | { type: "premium" }
  /** contentId matches an id in content/academyVideos.ts (or future Academy content). */
  | { type: "academy_complete"; contentId: string }
  /** Every id in contentIds must be completed — e.g. all 21 Tactics lessons (content/tacticsLessons.ts). */
  | { type: "academy_complete_all"; contentIds: string[] }
  /** Distinct openings actually DISCOVERED (reached in a real game) — see content/openings.ts. */
  | { type: "opening_count"; count: number }
  /** Distinct openings whose Academy detail page has been STUDIED. */
  | { type: "opening_studied_count"; count: number }
  /** Distinct gambit openings discovered. */
  | { type: "gambit_count"; count: number }
  /** Openings that have reached MASTERED status (see lib/openings/practiceTracking.ts). */
  | { type: "opening_mastered_count"; count: number }
  /** Total correct answers across all Chess Mind modules combined. */
  | { type: "chess_mind_count"; count: number }
  | { type: "online_wins"; count: number };

export type AchievementCategory = "learning" | "thinking" | "playing" | "exploration";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  criteria: AchievementCriteria;
}

/**
 * Kept modest and honest on purpose: every entry here is something we can
 * actually detect from real tracked data — no badges for things the app
 * doesn't measure. The four categories match the product spec's
 * Learning/Thinking/Playing/Exploration split; where the spec named a
 * specific sub-skill this app doesn't have real data for yet (e.g.
 * "Pattern Master" — no Pattern Recognition module exists, see Chess
 * Mind's "Soon" categories), it's substituted with an achievement tied to
 * a module that's actually built (Spatial Thinking, Chess Mathematics)
 * rather than added as a badge nothing can ever earn.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Learning --------------------------------------------------------
  {
    key: "first_steps",
    title: "First Steps",
    description: "Completed Day 1 — woke up the Pawn Village!",
    emoji: "🐣",
    category: "learning",
    criteria: { type: "complete_day", day: 1 },
  },
  {
    key: "knight_master",
    title: "Knight Master",
    description: "Completed Day 2 — learned the Knight's jump!",
    emoji: "🐴",
    category: "learning",
    criteria: { type: "complete_day", day: 2 },
  },
  {
    key: "bishop_master",
    title: "Bishop Master",
    description: "Completed Day 3 — lit up the Hall of Light!",
    emoji: "🔮",
    category: "learning",
    criteria: { type: "complete_day", day: 3 },
  },
  {
    key: "rook_master",
    title: "Rook Master",
    description: "Completed Day 4 — cleared the Iron Corridor!",
    emoji: "🏰",
    category: "learning",
    criteria: { type: "complete_day", day: 4 },
  },
  {
    key: "queen_master",
    title: "Queen Master",
    description: "Completed Day 5 — restored the Grand Court!",
    emoji: "👑",
    category: "learning",
    criteria: { type: "complete_day", day: 5 },
  },
  {
    key: "kings_guard",
    title: "King's Guard",
    description: "Completed Day 6 — protected the Throne Room!",
    emoji: "🛡️",
    category: "learning",
    criteria: { type: "complete_day", day: 6 },
  },
  {
    key: "six_crystals",
    title: "All Six Crystals",
    description: "Recovered every Chess Crystal — Pawn to King!",
    emoji: "💎",
    category: "learning",
    criteria: { type: "complete_count", count: 6 },
  },
  {
    key: "fork_finder",
    title: "Fork Finder",
    description: "Completed Day 7 — the Knight's Fork Academy!",
    emoji: "🍴",
    category: "learning",
    criteria: { type: "complete_day", day: 7 },
  },
  {
    key: "pin_master",
    title: "Pin Master",
    description: "Completed Day 8 — the Bishop's Pin Trial!",
    emoji: "📌",
    category: "learning",
    criteria: { type: "complete_day", day: 8 },
  },
  {
    key: "watchtower",
    title: "Watchtower",
    description: "Completed Day 9 — guarded the Back Rank!",
    emoji: "🗼",
    category: "learning",
    criteria: { type: "complete_day", day: 9 },
  },
  {
    key: "champion",
    title: "Champion of the Kingdom",
    description: "Completed Day 10 — the Checkmate Finale!",
    emoji: "🏆",
    category: "learning",
    criteria: { type: "complete_day", day: 10 },
  },
  {
    key: "halfway_hero",
    title: "Halfway Hero",
    description: "Completed 5 lessons total!",
    emoji: "⭐",
    category: "learning",
    criteria: { type: "complete_count", count: 5 },
  },
  {
    key: "premium_adventurer",
    title: "Premium Adventurer",
    description: "Unlocked the whole Kingdom!",
    emoji: "✨",
    category: "learning",
    criteria: { type: "premium" },
  },
  {
    key: "ten_lessons",
    title: "Ten Lessons Strong",
    description: "Completed 10 lessons total!",
    emoji: "🔟",
    category: "learning",
    criteria: { type: "complete_count", count: 10 },
  },
  {
    key: "intermediate_graduate",
    title: "Intermediate Kingdom Graduate",
    description: "Completed Day 15 — mastered the Promotion Road!",
    emoji: "🎓",
    category: "learning",
    criteria: { type: "complete_day", day: 15 },
  },
  {
    key: "twenty_lessons",
    title: "Twenty Lessons Strong",
    description: "Completed 20 lessons total!",
    emoji: "🥇",
    category: "learning",
    criteria: { type: "complete_count", count: 20 },
  },
  {
    key: "tournament_trial",
    title: "Tournament Trial Winner",
    description: "Completed Day 20 — your first Tournament Trial!",
    emoji: "🏅",
    category: "learning",
    criteria: { type: "complete_day", day: 20 },
  },
  {
    key: "advanced_graduate",
    title: "Advanced Kingdom Graduate",
    description: "Completed Day 25 — halfway through the Advanced Kingdom!",
    emoji: "📯",
    category: "learning",
    criteria: { type: "complete_day", day: 25 },
  },
  {
    key: "kingdom_champion",
    title: "Champion of Chess Mind",
    description: "Completed all 30 days and defeated the Shadow King!",
    emoji: "👑",
    category: "learning",
    criteria: { type: "complete_day", day: 30 },
  },
  {
    key: "tactics_master",
    title: "Tactics Master",
    description: "Completed every lesson in the Academy Tactics course — forks, pins, skewers, and everything in between.",
    emoji: "⚔️",
    category: "learning",
    criteria: {
      type: "academy_complete_all",
      contentIds: [
        "what-is-a-tactic", "checks-captures-threats", "forks", "pins", "skewers",
        "discovered-attacks", "double-attacks", "removing-the-defender", "deflection", "decoy",
        "overloading", "zwischenzug", "back-rank-tactics", "discovered-check", "double-check",
        "trapped-pieces", "clearance", "combining-tactical-ideas", "tactical-vision",
        "mixed-tactical-practice", "final-tactics-challenge",
      ],
    },
  },

  // --- Thinking (Chess Mind) --------------------------------------------
  {
    key: "chess_mind_novice",
    title: "Sharp Mind",
    description: "Solved 10 Chess Mind challenges — Spatial Thinking or Chess Mathematics.",
    emoji: "🧠",
    category: "thinking",
    criteria: { type: "chess_mind_count", count: 10 },
  },
  {
    key: "chess_mind_adept",
    title: "Quick Calculator",
    description: "Solved 50 Chess Mind challenges — real practice adds up!",
    emoji: "⚡",
    category: "thinking",
    criteria: { type: "chess_mind_count", count: 50 },
  },

  // --- Playing -----------------------------------------------------------
  {
    key: "first_win",
    title: "First Victory",
    description: "Won your first online game!",
    emoji: "🥳",
    category: "playing",
    criteria: { type: "online_wins", count: 1 },
  },
  {
    key: "ten_wins",
    title: "Rising Contender",
    description: "Won 10 online games.",
    emoji: "🎖️",
    category: "playing",
    criteria: { type: "online_wins", count: 10 },
  },

  // --- Exploration ---------------------------------------------------------
  {
    key: "chess_historian",
    title: "Chess Historian",
    description: "Learned how chess crossed the world, from ancient India to the game played today.",
    emoji: "🏛️",
    category: "exploration",
    criteria: { type: "academy_complete", contentId: "history-of-chess" },
  },
  {
    key: "opening_explorer",
    title: "Opening Explorer",
    description: "Discovered 5 different named openings in real games.",
    emoji: "🧭",
    category: "exploration",
    criteria: { type: "opening_count", count: 5 },
  },
  {
    key: "opening_scholar",
    title: "Opening Scholar",
    description: "Studied 10 different openings in the Academy — a real repertoire!",
    emoji: "📚",
    category: "exploration",
    criteria: { type: "opening_studied_count", count: 10 },
  },
  {
    key: "first_gambit",
    title: "Gambit Player",
    description: "Played into a real gambit line for the first time.",
    emoji: "♟️",
    category: "exploration",
    criteria: { type: "gambit_count", count: 1 },
  },
  {
    key: "gambit_hunter",
    title: "Gambit Hunter",
    description: "Discovered 3 different gambit openings.",
    emoji: "⚔️",
    category: "exploration",
    criteria: { type: "gambit_count", count: 3 },
  },
  {
    key: "opening_master",
    title: "Opening Master",
    description: "Practiced an opening successfully enough times to truly master it.",
    emoji: "🏆",
    category: "exploration",
    criteria: { type: "opening_mastered_count", count: 1 },
  },
];

export function getAchievement(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}
