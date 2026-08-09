import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LESSONS } from "@/content/lessons";
import { AVATARS } from "@/content/avatars";
import { OPENINGS } from "@/content/openings";
import { getZoneForDay } from "@/content/kingdomZones";
import { createClient } from "@/lib/supabase/server";
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
} from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { HomeHeader } from "@/components/home/HomeHeader";
import { AchievementBadges } from "@/components/achievements/AchievementBadges";
import { ListItemRow } from "@/components/ui/Card";
import { getPieceSet } from "@/content/pieceSets";
import { getBoardSkin } from "@/content/boardSkins";
import { TEXT } from "@/lib/designSystem";

function StatTile({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-1">
      <span className="text-xl">{emoji}</span>
      <p className="font-classic-display text-2xl text-premium-ivory">{value}</p>
      <p className="font-classic-body text-[11px] text-premium-ivory/50">{label}</p>
    </div>
  );
}

export default async function ProfilePage() {
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
  const earnedKeys = await getEarnedAchievementKeys(supabase, child.id);
  const puzzleStats = await getPuzzleAccuracyStats(supabase, child.id);
  const completedAcademyIds = await getCompletedAcademyContentIds(supabase, child.id);
  const openingEncounters = await getOpeningEncounters(supabase, child.id);
  const chessMindTotalSolved = await getChessMindTotalSolved(supabase, child.id);
  const onlineWins = await getOnlineWinsCount(supabase, child.id);
  const chessMindStreak = await getChessMindStreak(supabase, child.id).catch(() => 0);

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

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-8 pb-24">
        <HomeHeader
          displayName={child.display_name}
          avatar={avatar}
          zone={currentZone}
          currentDay={child.current_day}
          totalDays={LESSONS.length}
          rating={child.rating}
          streak={chessMindStreak}
        />

        <div className="w-full max-w-md flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Customize</p>
          <ListItemRow href="/kingdom-map/customize">
            <span className="text-2xl flex-none">{pieceSet.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-classic-display text-sm text-premium-ivory">Change Pieces</p>
              <p className={`${TEXT.caption} normal-case`}>Currently {pieceSet.name}</p>
            </div>
            <span className="text-premium-gold text-lg flex-none">→</span>
          </ListItemRow>
          <ListItemRow href="/kingdom-map/customize">
            <span className="text-2xl flex-none">{boardSkin.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-classic-display text-sm text-premium-ivory">Change Board</p>
              <p className={`${TEXT.caption} normal-case`}>Currently {boardSkin.name}</p>
            </div>
            <span className="text-premium-gold text-lg flex-none">→</span>
          </ListItemRow>
        </div>

        <div className="w-full max-w-md grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile emoji="🗺️" value={`${completedDays.length}/${LESSONS.length}`} label="Kingdom Journey" />
          <StatTile emoji="🏛️" value={`${completedAcademyIds.length}`} label="Academy Completed" />
          <StatTile emoji="🧩" value={`${puzzleStats.puzzlesSolved}`} label="Puzzles Solved" />
          <StatTile emoji="🧠" value={`${chessMindTotalSolved}`} label="Chess Mind Solved" />
          <StatTile emoji="🧭" value={`${discovered.length}`} label="Openings Discovered" />
          <StatTile emoji="🥇" value={`${onlineWins}`} label="Online Wins" />
        </div>

        <div className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-classic-display text-base text-premium-ivory">Openings Discovered</p>
            <Link href="/academy/openings" className="font-classic-body text-xs text-premium-gold underline underline-offset-2">
              Explore Openings →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="font-classic-display text-xl text-premium-ivory">{discovered.length}</p>
              <p className="font-classic-body text-[10px] text-premium-ivory/50">Discovered</p>
            </div>
            <div>
              <p className="font-classic-display text-xl text-premium-ivory">{gambitsDiscovered}</p>
              <p className="font-classic-body text-[10px] text-premium-ivory/50">Gambits</p>
            </div>
            <div>
              <p className="font-classic-display text-xl text-premium-ivory">
                {studied.length}/{OPENINGS.length}
              </p>
              <p className="font-classic-body text-[10px] text-premium-ivory/50">Studied</p>
            </div>
          </div>

          {recentlyDiscovered.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-classic-body text-[10px] uppercase tracking-wider text-premium-gold/70 font-semibold">
                Recently Discovered
              </p>
              <div className="flex flex-wrap gap-2">
                {recentlyDiscovered.map((o) => (
                  <span
                    key={o.id}
                    className={`font-classic-body text-[11px] rounded-full px-3 py-1 border ${
                      o.isGambit
                        ? "border-red-400/30 text-red-300"
                        : "border-premium-gold/30 text-premium-gold"
                    }`}
                  >
                    {o.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <AchievementBadges earnedKeys={earnedKeys} />

        <Link
          href="/kingdom-map"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Kingdom Map
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}
