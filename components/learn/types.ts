/**
 * Shape of one LEARN_CHESS entry (app/(tabs)/learn/page.tsx) — shared so all
 * three mode compositions consume the exact same array without redefining
 * its shape. courseId is set only for the two entries that already have a
 * real CourseStatusChip today (strategy, endgames).
 */
export interface LearnChessEntry {
  id: string;
  title: string;
  emoji: string;
  description: string;
  href: string;
  courseId?: string;
}
