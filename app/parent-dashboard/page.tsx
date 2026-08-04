import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getChildrenForParent, getCompletedDays, getPuzzleAccuracyStats } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { LESSONS, FREE_DAY_LIMIT } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { getAchievement } from "@/content/achievements";
import { Card } from "@/components/ui/Card";
import { ScreenTimeSettings } from "./ScreenTimeSettings";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { ManageChildren } from "./ManageChildren";

export default async function ParentDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <main className="min-h-screen flex flex-col items-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night">Parent Dashboard</h1>

      <ManageChildren initialChildren={allChildren} activeChildId={child?.id ?? ""} />

      {child && (
        <>
          <Card className="w-full max-w-lg flex items-center gap-4">
            <span className="text-5xl">{avatar?.emoji ?? "🧒"}</span>
            <div>
              <p className="font-display text-lg text-kingdom-night">
                {child.display_name}
              </p>
              <p className="font-body text-sm text-kingdom-night/60">
                Adventuring with {buddy?.name ?? "a Kingdom Buddy"} · Currently on Day{" "}
                {child.current_day} of {LESSONS.length}
              </p>
            </div>
          </Card>

          <Card className="w-full max-w-lg flex flex-col gap-4">
            <h2 className="font-display text-lg text-kingdom-night">Learning Progress</h2>
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
                      className="flex items-center justify-between bg-kingdom-gold/10 rounded-card px-4 py-3"
                    >
                      <span className="font-body text-kingdom-night">
                        Day {row.day_number}: {lesson?.title ?? "Lesson"}
                      </span>
                      <span className="font-body text-sm text-kingdom-night/50">
                        {completedDate}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="font-body text-kingdom-night/60">
                No lessons completed yet — {child.display_name} hasn't finished Day 1.
              </p>
            )}
            <p className="font-body text-xs text-kingdom-night/40 italic">
              Detailed mistake trends by skill aren't tracked yet — see Puzzle
              Accuracy below for how consistently {child.display_name} picks the
              right piece on the first try.
            </p>
          </Card>

          <Card className="w-full max-w-lg flex flex-col gap-2">
            <h2 className="font-display text-lg text-kingdom-night">Puzzle Accuracy</h2>
            {puzzleStats && puzzleStats.totalAttempts > 0 ? (
              <>
                <p className="font-body text-kingdom-night">
                  Solved {puzzleStats.puzzlesSolved} puzzle
                  {puzzleStats.puzzlesSolved === 1 ? "" : "s"}, {puzzleStats.firstTryCorrect} on
                  the first try.
                </p>
                <p className="font-body text-sm text-kingdom-night/50">
                  {puzzleStats.totalAttempts} total attempt
                  {puzzleStats.totalAttempts === 1 ? "" : "s"} across all puzzles so far.
                </p>
              </>
            ) : (
              <p className="font-body text-kingdom-night/60">
                No puzzle attempts recorded yet.
              </p>
            )}
            <p className="font-body text-xs text-kingdom-night/40 italic">
              "Correct" means moving the piece that day's lesson is teaching — most
              puzzles are movement practice, not single-answer tactics, so this
              measures engagement with the right piece, not objectively-best play.
            </p>
          </Card>

          <Card className="w-full max-w-lg flex flex-col gap-4">
            <h2 className="font-display text-lg text-kingdom-night">Achievements</h2>
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
                      className="flex items-center justify-between bg-kingdom-gold/10 rounded-card px-4 py-3"
                    >
                      <span className="font-body text-kingdom-night">
                        {def?.emoji ?? "🏅"} {def?.title ?? row.achievement_key}
                      </span>
                      <span className="font-body text-sm text-kingdom-night/50">
                        {earnedDate}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="font-body text-kingdom-night/60">
                No achievements earned yet — they'll show up here as {child.display_name}{" "}
                progresses.
              </p>
            )}
          </Card>
        </>
      )}

      <ScreenTimeSettings
        parentId={parent.id}
        initialWeekday={parent.screen_time_weekday_minutes}
        initialWeekend={parent.screen_time_weekend_minutes}
      />

      <Card className="w-full max-w-lg flex flex-col items-center gap-3">
        <h2 className="font-display text-lg text-kingdom-night self-start">Plan</h2>
        <p className="font-body text-kingdom-night/70 self-start">
          {parent.premium_status === "premium"
            ? "Premium — all available content unlocked."
            : `Free plan — Days 1-${FREE_DAY_LIMIT} available.`}
        </p>
        {parent.premium_status !== "premium" && <UpgradeButton />}
      </Card>
    </main>
  );
}
