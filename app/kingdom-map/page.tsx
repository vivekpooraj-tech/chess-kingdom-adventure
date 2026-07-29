import Link from "next/link";
import { redirect } from "next/navigation";
import { LESSONS } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateChild, getCompletedDays } from "@/lib/supabase/queries";
import { KingdomMapCards } from "./KingdomMapCards";

export default async function KingdomMapPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const child = await getOrCreateChild(supabase, user.id);
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const completedDays = await getCompletedDays(supabase, child.id);
  const buddy = BUDDIES.find((b) => b.id === child.buddy_id) ?? BUDDIES[0];

  return (
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
      />
    </main>
  );
}
