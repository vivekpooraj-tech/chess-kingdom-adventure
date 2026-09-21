import type { AvatarOption } from "@/lib/types";
import type { KingdomZone } from "@/content/kingdomZones";
import type { ChessJourney } from "@/lib/learner/chessJourney";
import type { OpeningDef } from "@/content/openings";

/**
 * Everything a Profile mode presentation needs to render — computed exactly
 * ONCE in app/profile/page.tsx (same Promise.all batch and derived reads as
 * before this change) and passed identically to all three mode compositions.
 * No mode component re-fetches or re-derives any of this; they only vary
 * copy, ordering, and styling around the same real values.
 */
export interface ProfileData {
  displayName: string;
  avatar: AvatarOption | undefined;
  zone: KingdomZone;
  currentDay: number;
  totalDays: number;
  streak: number;
  rating: number;
  todayRatingChange: number;
  journey: ChessJourney;
  pieceSetEmoji: string;
  pieceSetName: string;
  boardSkinEmoji: string;
  boardSkinName: string;
  completedDaysCount: number;
  completedAcademyCount: number;
  puzzlesSolved: number;
  chessMindTotalSolved: number;
  discoveredCount: number;
  onlineWins: number;
  gambitsDiscovered: number;
  studiedCount: number;
  totalOpeningsCount: number;
  recentlyDiscovered: OpeningDef[];
  earnedKeys: string[];
}
