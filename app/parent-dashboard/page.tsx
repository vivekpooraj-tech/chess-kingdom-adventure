import { Screen } from "@/components/layout/Screen";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  getChildrenForParent,
  getCompletedDays,
  getPuzzleAccuracyStats,
  getCompletedAcademyContentIds,
  getChessMindStatsByModule,
  getChessMindTotalSolved,
  getOpeningEncounters,
  getRecentUsageMinutes,
} from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { LESSONS } from "@/content/lessons";
import { getFreeDayNumbers } from "@/content/kingdomZones";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { getAchievement } from "@/content/achievements";
import { HISTORY_OF_CHESS } from "@/content/academyVideos";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { SecondaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import { ScreenTimeSettings } from "./ScreenTimeSettings";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { ManageChildren } from "./ManageChildren";

export default async function ParentDashboardPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);

  if (!user) redirect("/sign-in");

  const { data: parent } = await supabase
    .from("parents")
    .select("id, screen_time_weekday_minutes, screen_time_weekend_minutes, premium_status")
    .eq("auth_user_id", user.id)
    .single();

  if (!parent) redirect("/sign-in");

  const allChildren = await getChildrenForParent(supabase, user.id);
  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  // The dashboard is parent-only, so unlike the kid-facing pages it never
  // forces the "who's playing" picker — it just shows whichever child is
  // currently active, falling back to the first child if none is set yet.
  const child = allChildren.find((c) => c.id === cookieChildId) ?? allChildren[0];

  const completedDays = child ? await getCompletedDays(supabase, child.id) : [];
  const puzzleStats = child ? await getPuzzleAccuracyStats(supabase, child.id) : null;
  const completedAcademyIds = child ? await getCompletedAcademyContentIds(supabase, child.id) : [];
  const chessMindStats: Record<string, number> = child
    ? await getChessMindStatsByModule(supabase, child.id).catch(() => ({}))
    : {};
  const chessMindTotal = child ? await getChessMindTotalSolved(supabase, child.id) : 0;
  const openingEncounters = child ? await getOpeningEncounters(supabase, child.id) : [];
  const recentMinutes = child ? await getRecentUsageMinutes(supabase, child.id, 7).catch(() => 0) : 0;

  const { data: progressRows } = child
    ? await supabase
        .from("child_lesson_progress")
        .select("day_number, completed_at")
        .eq("child_id", child.id)
        .eq("status", "completed")
        .order("day_number", { ascending: true })
    : { data: [] };

  const { data: achievementRows } = child
    ? await supabase
        .from("child_achievements")
        .select("achievement_key, earned_at")
        .eq("child_id", child.id)
        .order("earned_at", { ascending: false })
    : { data: [] };

  const avatar = child ? AVATARS.find((a) => a.id === child.avatar_id) : undefined;
  const buddy = child ? BUDDIES.find((b) => b.id === child.buddy_id) : undefined;
  const historyCompleted = completedAcademyIds.includes(HISTORY_OF_CHESS.id);
  const openingsDiscovered = openingEncounters.filter((e) => e.first_seen_at).length;
  const openingsStudied = openingEncounters.filter((e) => e.studied_at).length;

  return (
    <Screen maxWidth="compact">
      <h1 className={TEXT.display}>Parent Dashboard</h1>

      <ManageChildren initialChildren={allChildren} activeChildId={child?.id ?? ""} />

      {child && (
        <>
          <SecondaryCard className="w-full flex items-center gap-4">
            <span className="text-5xl">{avatar?.emoji ?? "🧒"}</span>
            <div>
              <p className={TEXT.subheading}>{child.display_name}</p>
              <p className={`${TEXT.caption} normal-case`}>
                Learning with {buddy?.name ?? "a Kingdom Buddy"} · Currently on Day{" "}
                {child.current_day} of {LESSONS.length}
              </p>
            </div>
          </SecondaryCard>

          {/* Overview — the "quickly understand" summary strip the brief
              asks for: learning, Academy, Chess Mind, openings, time spent
              all in one glance, with detail below for anyone who wants more. */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile value={`${completedDays.length}/${LESSONS.length}`} label="Kingdom Journey" />
            <StatTile value={chessMindTotal} label="Chess Mind Solved" />
            <StatTile value={openingsDiscovered} label="Openings Discovered" />
            <StatTile value={`${recentMinutes}m`} label="Screen Time (7d)" />
          </div>

          <SecondaryCard className="w-full flex flex-col gap-4">
            <h2 className={TEXT.heading}>Learning Progress</h2>
            {progressRows && progressRows.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {progressRows.map((row) => {
                  const lesson = LESSONS.find((l) => l.dayNumber === row.day_number);
                  const completedDate = row.completed_at
                    ? new Date(row.completed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "";
                  return (
                    <li
                      key={row.day_number}
                      className="flex items-center justify-between bg-premium-midnightDeep rounded-premiumBtn px-4 py-3"
                    >
                      <span className="font-classic-body text-sm text-premium-ivory">
                        Day {row.day_number}: {lesson?.title ?? "Lesson"}
                      </span>
                      <span className={TEXT.caption}>{completedDate}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={TEXT.body}>
                No lessons completed yet — {child.display_name} hasn't finished Day 1.
              </p>
            )}
            <p className={`${TEXT.caption} normal-case italic`}>
              Detailed mistake trends by skill aren't tracked yet — see Puzzle
              Accuracy below for how consistently {child.display_name} picks the
              right piece on the first try.
            </p>
          </SecondaryCard>

          <SecondaryCard className="w-full flex flex-col gap-2">
            <h2 className={TEXT.heading}>Academy Progress</h2>
            <div className="flex items-center justify-between bg-premium-midnightDeep rounded-premiumBtn px-4 py-3">
              <span className="font-classic-body text-sm text-premium-ivory">History of Chess</span>
              <span className={historyCompleted ? "text-emerald-400 text-xs font-classic-body font-semibold" : TEXT.caption}>
                {historyCompleted ? "Completed" : "Not started"}
              </span>
            </div>
            <p className={`${TEXT.caption} normal-case italic`}>
              Fundamentals topics are self-paced reading, not individually tracked yet.
            </p>
          </SecondaryCard>

          <SecondaryCard className="w-full flex flex-col gap-3">
            <h2 className={TEXT.heading}>Chess Mind Activity</h2>
            {chessMindTotal > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {CHESS_MIND_CATEGORIES.filter((c) => c.href).map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between bg-premium-midnightDeep rounded-premiumBtn px-3 py-2"
                  >
                    <span className={TEXT.caption}>{cat.title}</span>
                    <span className="font-classic-display text-sm text-premium-gold">
                      {chessMindStats[cat.id] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={TEXT.body}>No Chess Mind challenges solved yet.</p>
            )}
          </SecondaryCard>

          <SecondaryCard className="w-full flex flex-col gap-2">
            <h2 className={TEXT.heading}>Opening Knowledge</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-premium-midnightDeep rounded-premiumBtn px-3 py-2">
                <p className="font-classic-display text-lg text-premium-ivory">{openingsDiscovered}</p>
                <p className={TEXT.caption}>Discovered in games</p>
              </div>
              <div className="bg-premium-midnightDeep rounded-premiumBtn px-3 py-2">
                <p className="font-classic-display text-lg text-premium-ivory">{openingsStudied}</p>
                <p className={TEXT.caption}>Studied in Academy</p>
              </div>
            </div>
          </SecondaryCard>

          <SecondaryCard className="w-full flex flex-col gap-2">
            <h2 className={TEXT.heading}>Puzzle Accuracy</h2>
            {puzzleStats && puzzleStats.totalAttempts > 0 ? (
              <>
                <p className={TEXT.body}>
                  Solved {puzzleStats.puzzlesSolved} puzzle
                  {puzzleStats.puzzlesSolved === 1 ? "" : "s"}, {puzzleStats.firstTryCorrect} on
                  the first try.
                </p>
                <p className={TEXT.caption}>
                  {puzzleStats.totalAttempts} total attempt
                  {puzzleStats.totalAttempts === 1 ? "" : "s"} across all puzzles so far.
                </p>
              </>
            ) : (
              <p className={TEXT.body}>No puzzle attempts recorded yet.</p>
            )}
            <p className={`${TEXT.caption} normal-case italic`}>
              "Correct" means moving the piece that day's lesson is teaching — most
              puzzles are movement practice, not single-answer tactics, so this
              measures engagement with the right piece, not objectively-best play.
            </p>
          </SecondaryCard>

          <SecondaryCard className="w-full flex flex-col gap-4">
            <h2 className={TEXT.heading}>Achievements</h2>
            {achievementRows && achievementRows.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {achievementRows.map((row) => {
                  const def = getAchievement(row.achievement_key);
                  const earnedDate = new Date(row.earned_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <li
                      key={row.achievement_key}
                      className="flex items-center justify-between bg-premium-midnightDeep rounded-premiumBtn px-4 py-3"
                    >
                      <span className="font-classic-body text-sm text-premium-ivory">
                        {def?.emoji ?? "🏅"} {def?.title ?? row.achievement_key}
                      </span>
                      <span className={TEXT.caption}>{earnedDate}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={TEXT.body}>
                No achievements earned yet — they'll show up here as {child.display_name}{" "}
                progresses.
              </p>
            )}
          </SecondaryCard>
        </>
      )}

      <ScreenTimeSettings
        parentId={parent.id}
        initialWeekday={parent.screen_time_weekday_minutes}
        initialWeekend={parent.screen_time_weekend_minutes}
      />

      <SecondaryCard className="w-full flex flex-col items-center gap-3">
        <h2 className={`${TEXT.heading} self-start`}>Plan</h2>
        <p className={`${TEXT.body} self-start`}>
          {parent.premium_status === "premium"
            ? "Premium — all available content unlocked."
            : `Free plan — the first lessons of every Kingdom zone are available (${
                getFreeDayNumbers().length
              } lessons total).`}
        </p>
        {parent.premium_status !== "premium" && <UpgradeButton tone="premium" />}
      </SecondaryCard>
    </Screen>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-1">
      <p className="font-classic-display text-xl text-premium-ivory">{value}</p>
      <p className={TEXT.caption}>{label}</p>
    </div>
  );
}
