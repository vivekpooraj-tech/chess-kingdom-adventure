import type { ChessSchoolProgress } from "@/lib/school/chessSchool";
import type { Lesson } from "@/lib/types";

/**
 * Everything a Chess School mode presentation needs — computed exactly ONCE
 * in app/chess-school/page.tsx (same auth/premium/Supabase reads and same
 * chessSchoolProgress()/courseJourney() inputs as before this change) and
 * passed identically to all three mode compositions. No mode component
 * re-fetches, re-derives progress, or recalculates a percentage.
 */
export interface ChessSchoolData {
  progress: ChessSchoolProgress;
  completedDays: number[];
  lockedDays: number[];
  neutralTone: boolean;
  resumeLesson: Lesson | undefined;
}
