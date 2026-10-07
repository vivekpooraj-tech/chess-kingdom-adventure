import { ForParentsLink } from "@/components/nav/ForParentsLink";
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
import { WorldScope } from "@/components/layout/WorldScope";
import { ProfileBody } from "@/components/profile/ProfileBody";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { buildChessJourney } from "@/lib/learner/chessJourney";
import { ChessJourneyPanel } from "@/components/learner/ChessJourneyPanel";
import { getPieceSet } from "@/content/pieceSets";
import { getBoardSkin } from "@/content/boardSkins";

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

  const journeyDay = Math.min(child.current_day, LESSONS.length);
  const dayPercent = Math.min(100, Math.round((Math.min(child.current_day - 1, LESSONS.length) / LESSONS.length) * 100));

  return (
    <WorldScope>
      <Screen maxWidth="wide">
        {/* The page owns every query and lookup above; ProfileBody only lays the same real values out per world (Enchanted Kingdom
            identity, Atelier dossier, Classic player record). The shared panels are passed in as they are. */}
        <ProfileBody
          name={child.display_name}
          avatar={{ emoji: avatar?.emoji ?? "🧑", colorFrom: avatar?.colorFrom ?? "#28315A", colorTo: avatar?.colorTo ?? "#28315A" }}
          zone={currentZone ? { emoji: currentZone.emoji, name: currentZone.name } : null}
          day={{ current: journeyDay, total: LESSONS.length, percent: dayPercent }}
          streak={chessMindStreak}
          rating={child.rating}
          todayRatingChange={todayRatingChange}
          pieces={{ emoji: pieceSet.emoji, name: pieceSet.name }}
          board={{ emoji: boardSkin.emoji, name: boardSkin.name }}
          stats={[
            { emoji: "🗺️", value: `${completedDays.length}/${LESSONS.length}`, label: "Kingdom Story Map" },
            { emoji: "🏛️", value: `${completedAcademyIds.length}`, label: "Academy Completed" },
            { emoji: "🧩", value: `${puzzleStats.puzzlesSolved}`, label: "Puzzles Solved" },
            { emoji: "🧠", value: `${chessMindTotalSolved}`, label: "Chess Mind Solved" },
            { emoji: "🧭", value: `${discovered.length}`, label: "Openings Discovered" },
            { emoji: "🥇", value: `${onlineWins}`, label: "Online Wins" },
          ]}
          openings={{
            discovered: discovered.length,
            gambits: gambitsDiscovered,
            studied: studied.length,
            total: OPENINGS.length,
            recent: recentlyDiscovered.map((o) => ({ id: o.id, name: o.name, isGambit: !!o.isGambit })),
          }}
          /* The time dimension, above the lifetime totals: "am I improving?" is a more useful first answer than "how much have I
             done?". Renders nothing until there are enough rated games to say something honest. */
          journey={<ChessJourneyPanel journey={journey} />}
          achievements={<AchievementBadges earnedKeys={earnedKeys} />}
          parents={<ForParentsLink ageBand={child.age_band} />}
        />
      </Screen>
    </WorldScope>
  );
}
