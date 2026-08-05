import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { createClient } from "@/lib/supabase/server";
import {
  resolveActiveChild,
  getCompletedDays,
  evaluateAndAwardAchievements,
  getEarnedAchievementKeys,
} from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { KingdomMapCards } from "./KingdomMapCards";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");

  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const completedDays = await getCompletedDays(supabase, child.id);
  const buddy = BUDDIES.find((b) => b.id === child.buddy_id) ?? BUDDIES[0];

  const { data: parent } = await supabase
    .from("parents")
    .select("premium_status")
    .eq("auth_user_id", user.id)
    .single();
  const isPremium = parent?.premium_status === "premium";

  // Evaluated on every Kingdom Map visit — cheap, idempotent (won't
  // double-award), and this is where a child lands after every lesson
  // completion and every successful premium purchase, so it's the natural
  // single place to catch newly-earned achievements.
  await evaluateAndAwardAchievements(supabase, child.id, completedDays, isPremium);
  const earnedKeys = await getEarnedAchievementKeys(supabase, child.id);

  return (
    <ScreenTimeGate childId={child.id}>
      <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{buddy.emoji}</span>
          <p className="font-body text-kingdom-night/70">
            {buddy.name} is exploring the Kingdom with you!
          </p>
        </div>

        <h1 className="font-display text-3xl text-kingdom-night text-center">
          The Chess Kingdom Map 🗺️
        </h1>

        <KingdomMapCards
          lessons={LESSONS}
          currentDay={child.current_day}
          completedDays={completedDays}
          isPremium={isPremium}
        />

        {completedDays.length >= LESSONS.length && (
          <Link
            href="/free-play"
            className="flex items-center gap-4 rounded-card bg-kingdom-gold/90 shadow-toy p-5 w-full max-w-md"
          >
            <span className="text-4xl">⚔️</span>
            <div>
              <p className="font-display text-lg text-kingdom-night">Free Play Arena</p>
              <p className="font-body text-sm text-kingdom-night/70">
                Play a full game anytime — pick your difficulty!
              </p>
            </div>
          </Link>
        )}

        <div className="flex flex-col items-center gap-3 rounded-card bg-kingdom-sky/10 p-5 w-full max-w-md">
          <p className="font-body text-kingdom-night/70 text-center">
            Want to play a friend? Send them an invite link!
          </p>
          <InviteFriendButton />
        </div>

        <Link
          href="/kingdom-map/board-skin"
          className="flex items-center gap-4 rounded-card bg-white/85 shadow-toy p-5 w-full max-w-md"
        >
          <span className="text-4xl">🎨</span>
          <div>
            <p className="font-display text-lg text-kingdom-night">Change Board</p>
            <p className="font-body text-sm text-kingdom-night/70">
              Pick a new look for your chess board
            </p>
          </div>
        </Link>

        <Link
          href="/kingdom-map/piece-set"
          className="flex items-center gap-4 rounded-card bg-white/85 shadow-toy p-5 w-full max-w-md"
        >
          <span className="text-4xl">♟️</span>
          <div>
            <p className="font-display text-lg text-kingdom-night">Change Pieces</p>
            <p className="font-body text-sm text-kingdom-night/70">
              Pick a new style for your chess pieces
            </p>
          </div>
        </Link>

        <AchievementBadges earnedKeys={earnedKeys} />

        <Link
          href="/parent-gate?next=/parent-dashboard"
          className="font-body text-sm text-kingdom-night/40 underline underline-offset-2 mt-4"
        >
          For Parents
        </Link>
      </main>
    </ScreenTimeGate>
  );
}
