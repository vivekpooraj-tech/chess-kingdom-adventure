import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/lessons";
import { AVATARS } from "@/content/avatars";
import { OPENINGS } from "@/content/openings";
import { getZoneForDay } from "@/content/kingdomZones";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  resolveActiveChild,
  getCompletedDays,
  getEarnedAchievementKeys,
  getPuzzleAccuracyStats,
  getCompletedAcademyContentIds,
  getOpeningEncounters,
  getChessMindTotalSolved,
  getChessMindStreak,
  getOnlineWinsCount,
  getTodayRatingChange,
  getRatingTimeline,
  getRecentGameReviews,
} from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { Screen } from "@/components/layout/Screen";
import { buildChessJourney } from "@/lib/learner/chessJourney";
import { getPieceSet } from "@/content/pieceSets";
import { getBoardSkin } from "@/content/boardSkins";
import { ProfileModePresentation } from "@/components/profile/ProfileModePresentation";
import { ClassicProfile } from "@/components/profile/classic/ClassicProfile";
import { AdultProfile } from "@/components/profile/adult/AdultProfile";
import { KidsProfile } from "@/components/profile/kids/KidsProfile";
import type { ProfileData } from "@/components/profile/types";

export default async function ProfilePage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  // All eight of these are independent reads — no ordering dependency
  // between them, so they run as one batch instead of one at a time.
  const [
    completedDays,
    earnedKeys,
    puzzleStats,
    completedAcademyIds,
    openingEncounters,
    chessMindTotalSolved,
    onlineWins,
    chessMindStreak,
    todayRatingChange,
    ratingTimeline,
    recentReviews,
  ] = await Promise.all([
    getCompletedDays(supabase, child.id),
    getEarnedAchievementKeys(supabase, child.id),
    getPuzzleAccuracyStats(supabase, child.id),
    getCompletedAcademyContentIds(supabase, child.id),
    getOpeningEncounters(supabase, child.id),
    getChessMindTotalSolved(supabase, child.id),
    getOnlineWinsCount(supabase, child.id),
    getChessMindStreak(supabase, child.id).catch(() => 0),
    getTodayRatingChange(supabase, child.id).catch(() => 0),
    // Both join the existing parallel batch — no new sequential layer on a
    // route that already pays cross-region latency per query.
    getRatingTimeline(supabase, child.id).catch(() => []),
    getRecentGameReviews(supabase, child.id, 20).catch(() => []),
  ]);

  const journey = buildChessJourney(ratingTimeline, recentReviews);

  const avatar = AVATARS.find((a) => a.id === child.avatar_id);
  const currentZone = getZoneForDay(Math.min(child.current_day, LESSONS.length));
  const pieceSet = getPieceSet(child.piece_set_id);
  const boardSkin = getBoardSkin(child.board_skin_id);

  const discovered = openingEncounters.filter((e) => e.first_seen_at);
  const studied = openingEncounters.filter((e) => e.studied_at);
  const discoveredOpenings = discovered
    .map((e) => OPENINGS.find((o) => o.id === e.opening_id))
    .filter((o): o is (typeof OPENINGS)[number] => !!o);
  const gambitsDiscovered = discoveredOpenings.filter((o) => o.isGambit).length;
  const recentlyDiscovered = [...discovered]
    .sort((a, b) => new Date(b.first_seen_at!).getTime() - new Date(a.first_seen_at!).getTime())
    .slice(0, 5)
    .map((e) => OPENINGS.find((o) => o.id === e.opening_id))
    .filter((o): o is (typeof OPENINGS)[number] => !!o);

  const profileData: ProfileData = {
    displayName: child.display_name,
    avatar,
    zone: currentZone,
    currentDay: child.current_day,
    totalDays: LESSONS.length,
    streak: chessMindStreak,
    rating: child.rating,
    todayRatingChange,
    journey,
    pieceSetEmoji: pieceSet.emoji,
    pieceSetName: pieceSet.name,
    boardSkinEmoji: boardSkin.emoji,
    boardSkinName: boardSkin.name,
    completedDaysCount: completedDays.length,
    completedAcademyCount: completedAcademyIds.length,
    puzzlesSolved: puzzleStats.puzzlesSolved,
    chessMindTotalSolved,
    discoveredCount: discovered.length,
    onlineWins,
    gambitsDiscovered,
    studiedCount: studied.length,
    totalOpeningsCount: OPENINGS.length,
    recentlyDiscovered,
    earnedKeys,
  };

  return (
    <Screen maxWidth="medium" contentClassName="profile-mode-scope">
      <ProfileModePresentation
        classicPro={<ClassicProfile data={profileData} />}
        adult={<AdultProfile data={profileData} />}
        kids={<KidsProfile data={profileData} />}
      />
    </Screen>
  );
}
