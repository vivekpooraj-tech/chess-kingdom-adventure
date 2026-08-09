/**
 * Rotating daily category, by day of week — same idea as
 * content/puzzles.ts's getDailyPuzzle(): deterministic, same for every
 * player on a given date, no scheduling table needed. Falls back to
 * "mixed" (no fixed category) on the day a rotation slot points at a
 * category that isn't built yet, so the daily challenge never links
 * somewhere dead.
 */
import { CHESS_MIND_CATEGORIES, getChessMindCategory } from "@/content/chessMindCategories";

const ROTATION: Record<number, string> = {
  0: "mixed", // Sunday
  1: "pattern", // Monday
  2: "visualization", // Tuesday
  3: "calculation", // Wednesday
  4: "memory", // Thursday
  5: "mathematics", // Friday
  6: "tactical", // Saturday
};

export function getDailyChallengeCategoryId(date: Date = new Date()): string {
  const categoryId = ROTATION[date.getDay()];
  const category = getChessMindCategory(categoryId);
  if (category?.href) return categoryId;
  // Rotation slot points at a category not built yet — fall back to a
  // real, playable one rather than link somewhere dead. Deterministic
  // (day-of-year based) so it's still consistent across a single day.
  const playable = CHESS_MIND_CATEGORIES.filter((c) => c.href);
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return playable[dayOfYear % playable.length].id;
}
