import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/lessons";
import { getZoneForDay } from "@/content/kingdomZones";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChildCached, getCompletedDays } from "@/lib/supabase/queries";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { KingdomMapCards } from "../KingdomMapCards";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";

/**
 * Chess Kingdom Journey (Phase 3, reframed in Phase 8A) — the old day-by-day
 * story quest. Moved off Home's main flow in Phase 3 so Home's single
 * primary action could be Chess School V2 without two curricula competing
 * for the same "what do I do next" moment; reframed again in Phase 8A
 * (V1 Closeout) as a retrospective story map rather than an active second
 * course, since the V1 Chess School page that used to double this content
 * is now dormant (see app/chess-school/legacy/page.tsx) and Chess School V2
 * is the app's only structured curriculum.
 *
 * Nothing about the underlying data changes: same lessons, same
 * children.current_day / child_lesson_progress tracking, same
 * KingdomMapCards component, unchanged. Only the framing copy below and the
 * More-page entry (app/(tabs)/more/page.tsx) changed.
 */
export default async function KingdomJourneyPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;

  const [completedDays, { data: parent }] = await Promise.all([
    getCompletedDays(supabase, child.id),
    supabase.from("parents").select(PARENT_PREMIUM_COLUMNS).eq("auth_user_id", user.id).single(),
  ]);
  const isPremium = resolvePremiumState(parent).isPremium;
  const currentZone = getZoneForDay(Math.min(child.current_day, LESSONS.length));

  return (
    <TabPageShell>
      <div>
        <h1 className={TEXT.display}>Kingdom Story Map {currentZone.emoji}</h1>
        <p className={`${TEXT.body} mt-2`}>
          Look back on the story you played through, day by day. Chess School is your course now —
          this is just the map of how you got here.
        </p>
      </div>
      <KingdomMapCards
        lessons={LESSONS}
        currentDay={child.current_day}
        completedDays={completedDays}
        isPremium={isPremium}
      />
    </TabPageShell>
  );
}
