"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { ListItemRow } from "@/components/ui/Card";
import { CHESS_MIND_CATEGORIES, getChessMindCategory } from "@/content/chessMindCategories";
import { getDailyChallengeCategoryId } from "@/lib/chessMind/dailyChallenge";
import { getUnlockedKingdomBonuses, UnlockedBonus } from "@/lib/chessMind/kingdomUnlocks";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getChessMindStatsByModule,
  getChessMindStreak,
  getTodayChessMindModules,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { FlameIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

export default function ChessMindPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);
  const [todayModules, setTodayModules] = useState<string[]>([]);
  const [bonuses, setBonuses] = useState<UnlockedBonus[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        setLoaded(true);
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (!resolution.child) {
        setLoaded(true);
        return;
      }
      const childId = resolution.child.id;
      const [statsResult, streakResult, todayResult] = await Promise.all([
        getChessMindStatsByModule(supabase, childId).catch(() => ({})),
        getChessMindStreak(supabase, childId).catch(() => 0),
        getTodayChessMindModules(supabase, childId).catch(() => []),
      ]);
      setStats(statsResult);
      setStreak(streakResult);
      setTodayModules(todayResult);
      setBonuses(getUnlockedKingdomBonuses(statsResult));
      setLoaded(true);
    }
    load();
  }, []);

  const dailyCategoryId = getDailyChallengeCategoryId();
  const dailyCategory = getChessMindCategory(dailyCategoryId);
  const dailyDoneToday = todayModules.includes(dailyCategoryId);

  const playable = CHESS_MIND_CATEGORIES.filter((c) => c.href);
  // "Continue Training" nudges toward whichever playable category has the
  // least practice behind it — real signal from real solve counts, not a
  // guess, and it naturally rotates once every category has some history.
  const continueCategory = [...playable].sort(
    (a, b) => (stats[a.id] ?? 0) - (stats[b.id] ?? 0)
  )[0];

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className={TEXT.display}>Chess Mind</h1>
          <p className={`${TEXT.body} mt-2`}>Train the way you think about chess.</p>
          <p className={`${TEXT.caption} normal-case mt-2`}>
            Pattern recognition, calculation, visualization, memory, and spatial reasoning —
            good practice for the game, not a claim about IQ.
          </p>
        </div>

        {loaded && streak > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-premium-navy border border-premium-gold/30 px-4 py-1.5">
            <FlameIcon className="w-4 h-4 text-premium-gold" />
            <span className="font-classic-body text-sm text-premium-ivory">
              {streak}-day streak
            </span>
          </div>
        )}

        {dailyCategory?.href && (
          <Link
            href={dailyCategory.href}
            className="w-full max-w-md rounded-premiumCard bg-gradient-to-br from-premium-gold/20 to-premium-navy border border-premium-gold/40 shadow-premiumCard p-5 flex items-center gap-4"
          >
            <span className="text-4xl">{dailyCategory.emoji}</span>
            <div className="flex-1">
              <p className={`${TEXT.meta} text-premium-gold`}>
                Today&apos;s Challenge {dailyDoneToday ? "· Done ✓" : ""}
              </p>
              <p className="font-classic-display text-lg text-premium-ivory">{dailyCategory.title}</p>
            </div>
            <span className="font-classic-display text-sm font-semibold text-premium-midnightDeep bg-premium-gold rounded-full px-4 py-2 flex-none">
              Start
            </span>
          </Link>
        )}

        {continueCategory?.href && (
          <Link
            href={continueCategory.href}
            className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex items-center gap-4"
          >
            <span className="text-2xl">{continueCategory.emoji}</span>
            <div className="flex-1">
              <p className="font-classic-body text-[10px] font-semibold text-premium-ivory/50 uppercase tracking-wide">
                Continue Training
              </p>
              <p className="font-classic-display text-base text-premium-ivory">
                {continueCategory.title}
              </p>
            </div>
            <span className="text-premium-ivory/40 text-lg">→</span>
          </Link>
        )}

        {bonuses.length > 0 && (
          <div className="w-full max-w-md rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-4 flex flex-col gap-2">
            <p className="font-classic-body text-xs font-semibold text-premium-gold uppercase tracking-wide">
              Kingdom Bonuses Unlocked
            </p>
            {bonuses.map((b) => (
              <Link
                key={b.zoneId}
                href="/kingdom-map"
                className="font-classic-body text-sm text-premium-ivory/80 underline underline-offset-2"
              >
                {b.label} →
              </Link>
            ))}
          </div>
        )}

        {/* A flat list of rows, not a stack of up to 10 individually-
            shadowed cards — ListItemRow (design system, components/ui/
            Card.tsx) keeps the same content but reads as one list, not a
            wall of identical boxes. The three feature cards above (Daily
            Challenge, Continue Training, Kingdom Bonuses) stay full cards —
            they're genuinely different, higher-priority content, not list
            entries. */}
        <div className="w-full max-w-md flex flex-col gap-1.5">
          {CHESS_MIND_CATEGORIES.map((cat) => {
            const score = stats[cat.id] ?? 0;
            if (!cat.href) {
              return (
                <ListItemRow key={cat.id} className="opacity-50">
                  <span className="text-2xl">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                    <p className="font-classic-body text-xs text-premium-ivory/50">{cat.description}</p>
                  </div>
                  <span className="font-classic-body text-[10px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap">
                    SOON
                  </span>
                </ListItemRow>
              );
            }
            return (
              <ListItemRow key={cat.id} href={cat.href}>
                <span className="text-2xl">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                  <p className="font-classic-body text-xs text-premium-ivory/50">{cat.description}</p>
                  {score > 0 && (
                    <p className="font-classic-body text-[11px] text-premium-gold/80 mt-1">
                      {cat.title} Score: {score}
                    </p>
                  )}
                </div>
                <span className="text-premium-gold text-lg">→</span>
              </ListItemRow>
            );
          })}
        </div>

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
