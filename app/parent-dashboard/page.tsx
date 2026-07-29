import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateChild, getCompletedDays } from "@/lib/supabase/queries";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { AVATARS } from "@/content/avatars";
import { Card } from "@/components/ui/Card";
import { ScreenTimeSettings } from "./ScreenTimeSettings";

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

  const child = await getOrCreateChild(supabase, user.id);
  const completedDays = await getCompletedDays(supabase, child.id);

  const { data: progressRows } = await supabase
    .from("child_lesson_progress")
    .select("day_number, completed_at")
    .eq("child_id", child.id)
    .eq("status", "completed")
    .order("day_number", { ascending: true });

  const avatar = AVATARS.find((a) => a.id === child.avatar_id);
  const buddy = BUDDIES.find((b) => b.id === child.buddy_id);

  return (
    <main className="min-h-screen flex flex-col items-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night">Parent Dashboard</h1>

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
          Detailed puzzle accuracy, mistake trends, and achievements aren't tracked yet
          in this version — this shows lesson completion only.
        </p>
      </Card>

      <ScreenTimeSettings
        parentId={parent.id}
        initialWeekday={parent.screen_time_weekday_minutes}
        initialWeekend={parent.screen_time_weekend_minutes}
      />

      <Card className="w-full max-w-lg">
        <h2 className="font-display text-lg text-kingdom-night mb-2">Plan</h2>
        <p className="font-body text-kingdom-night/70">
          {parent.premium_status === "premium"
            ? "Premium — all available content unlocked."
            : "Free plan — Days 1-3 available."}
        </p>
      </Card>
    </main>
  );
}
