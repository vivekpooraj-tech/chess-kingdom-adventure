export type AchievementCriteria =
  | { type: "complete_day"; day: number }
  | { type: "complete_count"; count: number }
  | { type: "premium" };

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  emoji: string;
  criteria: AchievementCriteria;
}

/**
 * Kept modest and honest on purpose: every entry here is something we can
 * actually detect from real tracked data (child_lesson_progress,
 * parents.premium_status) — no "500 achievements" fantasy list with badges
 * for things the app doesn't measure (attention span, mistake trends, etc.
 * aren't tracked anywhere yet, so there's no achievement for them).
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_steps",
    title: "First Steps",
    description: "Completed Day 1 — woke up the Pawn Village!",
    emoji: "🐣",
    criteria: { type: "complete_day", day: 1 },
  },
  {
    key: "knight_master",
    title: "Knight Master",
    description: "Completed Day 2 — learned the Knight's jump!",
    emoji: "🐴",
    criteria: { type: "complete_day", day: 2 },
  },
  {
    key: "bishop_master",
    title: "Bishop Master",
    description: "Completed Day 3 — lit up the Hall of Light!",
    emoji: "🔮",
    criteria: { type: "complete_day", day: 3 },
  },
  {
    key: "rook_master",
    title: "Rook Master",
    description: "Completed Day 4 — cleared the Iron Corridor!",
    emoji: "🏰",
    criteria: { type: "complete_day", day: 4 },
  },
  {
    key: "queen_master",
    title: "Queen Master",
    description: "Completed Day 5 — restored the Grand Court!",
    emoji: "👑",
    criteria: { type: "complete_day", day: 5 },
  },
  {
    key: "kings_guard",
    title: "King's Guard",
    description: "Completed Day 6 — protected the Throne Room!",
    emoji: "🛡️",
    criteria: { type: "complete_day", day: 6 },
  },
  {
    key: "six_crystals",
    title: "All Six Crystals",
    description: "Recovered every Chess Crystal — Pawn to King!",
    emoji: "💎",
    criteria: { type: "complete_count", count: 6 },
  },
  {
    key: "fork_finder",
    title: "Fork Finder",
    description: "Completed Day 7 — the Knight's Fork Academy!",
    emoji: "🍴",
    criteria: { type: "complete_day", day: 7 },
  },
  {
    key: "pin_master",
    title: "Pin Master",
    description: "Completed Day 8 — the Bishop's Pin Trial!",
    emoji: "📌",
    criteria: { type: "complete_day", day: 8 },
  },
  {
    key: "watchtower",
    title: "Watchtower",
    description: "Completed Day 9 — guarded the Back Rank!",
    emoji: "🗼",
    criteria: { type: "complete_day", day: 9 },
  },
  {
    key: "champion",
    title: "Champion of the Kingdom",
    description: "Completed Day 10 — the Checkmate Finale!",
    emoji: "🏆",
    criteria: { type: "complete_day", day: 10 },
  },
  {
    key: "halfway_hero",
    title: "Halfway Hero",
    description: "Completed 5 lessons total!",
    emoji: "⭐",
    criteria: { type: "complete_count", count: 5 },
  },
  {
    key: "premium_adventurer",
    title: "Premium Adventurer",
    description: "Unlocked the whole Kingdom!",
    emoji: "✨",
    criteria: { type: "premium" },
  },
  {
    key: "ten_lessons",
    title: "Ten Lessons Strong",
    description: "Completed 10 lessons total!",
    emoji: "🔟",
    criteria: { type: "complete_count", count: 10 },
  },
  {
    key: "intermediate_graduate",
    title: "Intermediate Kingdom Graduate",
    description: "Completed Day 15 — mastered the Promotion Road!",
    emoji: "🎓",
    criteria: { type: "complete_day", day: 15 },
  },
  {
    key: "twenty_lessons",
    title: "Twenty Lessons Strong",
    description: "Completed 20 lessons total!",
    emoji: "🥇",
    criteria: { type: "complete_count", count: 20 },
  },
  {
    key: "tournament_trial",
    title: "Tournament Trial Winner",
    description: "Completed Day 20 — your first Tournament Trial!",
    emoji: "🏅",
    criteria: { type: "complete_day", day: 20 },
  },
  {
    key: "advanced_graduate",
    title: "Advanced Kingdom Graduate",
    description: "Completed Day 25 — halfway through the Advanced Kingdom!",
    emoji: "📯",
    criteria: { type: "complete_day", day: 25 },
  },
  {
    key: "kingdom_champion",
    title: "Champion of Chess Kingdom Adventure",
    description: "Completed all 30 days and defeated the Shadow King!",
    emoji: "👑",
    criteria: { type: "complete_day", day: 30 },
  },
];

export function getAchievement(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}
