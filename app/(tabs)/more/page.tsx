import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AVATARS } from "@/content/avatars";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChildCached } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { ListItemRow } from "@/components/ui/Card";
import { SignOutRow } from "@/components/more/SignOutRow";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";

/**
 * More (mobile UI/UX redesign) — the 5th primary tab. Chess Kingdom moved
 * OFF of Profile as its access point a while ago; this goes one step
 * further and gives Profile itself a proper "hub" in front of it, so
 * Profile can stay focused on stats/achievements (per the redesign brief)
 * while settings-adjacent and occasional-use destinations (customize,
 * parent dashboard, sign out) live somewhere with its own tab instead of
 * being buried inside Profile's scroll.
 */
export default async function MorePage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;
  const avatar = AVATARS.find((a) => a.id === child.avatar_id);

  return (
    <TabPageShell>
      <div>
        <h1 className={TEXT.display}>More</h1>
      </div>

      <Link
        href="/profile"
        className="w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center gap-4 border border-white/5 hover:border-premium-gold/30 active:scale-[0.98] transition-[border-color,transform] duration-100"
      >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-none"
            style={{
              background: avatar
                ? `linear-gradient(135deg, ${avatar.colorFrom}, ${avatar.colorTo})`
                : "#28315A",
            }}
          >
            {avatar?.emoji ?? "🧑"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-classic-display text-lg text-premium-ivory truncate">{child.display_name}</p>
            <RatingBadge rating={child.rating} size="sm" className="mt-1" />
          </div>
          <span className="text-premium-gold text-lg flex-none">→</span>
        </Link>

      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-6">
        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Your Chess Mind</p>
          <div className="flex flex-col gap-1.5">
            <ListItemRow href="/profile">
              <span className="text-2xl flex-none">📊</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">Full Profile & Achievements</p>
                <p className={`${TEXT.caption} normal-case`}>Stats, badges, openings discovered</p>
              </div>
              <span className="text-premium-gold text-lg flex-none">→</span>
            </ListItemRow>
            <ListItemRow href="/kingdom-map#journey">
              <span className="text-2xl flex-none">🗺️</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">Chess Kingdom Journey</p>
                <p className={`${TEXT.caption} normal-case`}>Your 30-day beginner adventure</p>
              </div>
              <span className="text-premium-gold text-lg flex-none">→</span>
            </ListItemRow>
            <ListItemRow href="/kingdom-map/customize">
              <span className="text-2xl flex-none">🎨</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">Customize Board & Pieces</p>
                <p className={`${TEXT.caption} normal-case`}>Change your set and board skin</p>
              </div>
              <span className="text-premium-gold text-lg flex-none">→</span>
            </ListItemRow>
          </div>
        </section>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Family</p>
          <div className="flex flex-col gap-1.5">
            <ListItemRow href="/parent-gate?next=/parent-dashboard">
              <span className="text-2xl flex-none">👨‍👩‍👧</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">For Parents</p>
                <p className={`${TEXT.caption} normal-case`}>Screen time, premium, progress reports</p>
              </div>
              <span className="text-premium-gold text-lg flex-none">→</span>
            </ListItemRow>
          </div>
        </section>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Account</p>
          <SignOutRow />
        </section>
      </div>
    </TabPageShell>
  );
}
