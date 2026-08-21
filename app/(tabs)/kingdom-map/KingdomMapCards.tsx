"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lesson } from "@/lib/types";
import { KINGDOM_ZONES, isDayFree, getFreeDayNumbers } from "@/content/kingdomZones";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { LockIcon, CheckIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * The Kingdom Journey, grouped by zone (Phase 10B point 11 — "Pawn Village
 * -> Knight Forest -> ... use visual progression"). All access logic
 * (unlocked / needsPremium / completed) is unchanged from before this
 * redesign — this only changes how it's grouped and presented.
 */
export function KingdomMapCards({
  lessons,
  currentDay,
  completedDays,
  isPremium,
}: {
  lessons: Lesson[];
  currentDay: number;
  completedDays: number[];
  isPremium: boolean;
}) {
  // Every free day across the whole Kingdom, e.g. [1,2,3,6,7,11,12,...].
  // A plain `dayNumber <= currentDay` sequential check would trap a free
  // user at the first premium day forever, since current_day only
  // advances past a day once it's completed and free users can never
  // complete a premium one — so a later zone's free lessons must instead
  // be reachable once every free day *before* them (skipping the
  // unreachable premium days in between) has been completed.
  const freeDayNumbers = getFreeDayNumbers();
  function isLessonReached(dayNumber: number): boolean {
    if (dayNumber <= currentDay) return true;
    if (!isDayFree(dayNumber)) return false;
    return freeDayNumbers.filter((d) => d < dayNumber).every((d) => completedDays.includes(d));
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {KINGDOM_ZONES.map((zone) => {
        const zoneLessons = lessons.filter(
          (l) => l.dayNumber >= zone.dayStart && l.dayNumber <= zone.dayEnd
        );
        if (zoneLessons.length === 0) return null;

        const zoneCompletedCount = zoneLessons.filter((l) =>
          completedDays.includes(l.dayNumber)
        ).length;
        const zoneReached = isLessonReached(zone.dayStart);
        const zoneComplete = zoneCompletedCount === zoneLessons.length;

        return (
          <div key={zone.id} className="flex flex-col gap-2">
            {/* Zone header — aspirational, not punitive, for zones not yet
                reached: same treatment as reached zones, just dimmer and
                without a progress count (nothing to report yet). */}
            <div className={`flex items-center gap-2 ${!zoneReached ? "opacity-50" : ""}`}>
              <span className="text-xl flex-none">{zone.emoji}</span>
              <h3 className={TEXT.subheading}>{zone.name}</h3>
              {zoneComplete && (
                <CheckIcon className="w-4 h-4 text-emerald-400 flex-none" />
              )}
              {zoneReached && !zoneComplete && (
                <span className={`${TEXT.caption} ml-auto`}>
                  {zoneCompletedCount}/{zoneLessons.length}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {zoneLessons.map((lesson) => {
                const reachedByProgress = isLessonReached(lesson.dayNumber);
                const needsPremium = !isDayFree(lesson.dayNumber) && !isPremium;
                const unlocked = reachedByProgress && !needsPremium;
                const completed = completedDays.includes(lesson.dayNumber);

                const row = (
                  <motion.div
                    whileTap={unlocked ? { scale: 0.98 } : {}}
                    className={`flex items-center gap-3 rounded-premiumCard p-4 transition-colors ${
                      completed
                        ? "bg-premium-navy border border-premium-gold/25"
                        : unlocked
                        ? "bg-premium-navy border border-white/5 hover:border-premium-gold/20"
                        : "bg-premium-navy/40 border border-white/5"
                    }`}
                    style={{ opacity: unlocked || completed ? 1 : 0.55 }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-none ${
                        completed
                          ? "bg-premium-gold/20 text-premium-gold"
                          : needsPremium
                          ? "bg-premium-gold/10 text-premium-gold/70"
                          : unlocked
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/5 text-premium-ivory/30"
                      }`}
                    >
                      {completed ? (
                        <CheckIcon className="w-5 h-5" />
                      ) : (
                        <LockIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-classic-display text-sm text-premium-ivory truncate">
                        Day {lesson.dayNumber}: {lesson.title}
                      </p>
                      <p className={`${TEXT.caption} normal-case capitalize`}>
                        {lesson.crystal} Crystal
                        {completed ? " — Recovered" : needsPremium ? " — Premium" : ""}
                      </p>
                    </div>
                  </motion.div>
                );

                // A day needing premium is still a real, reachable link — it
                // goes to the lesson page, which itself redirects to
                // /upgrade if not premium (defense in depth, not just a
                // UI-level lock).
                if (unlocked || needsPremium) {
                  return (
                    <Link key={lesson.dayNumber} href={`/lesson/${lesson.dayNumber}`}>
                      {row}
                    </Link>
                  );
                }

                return (
                  <div key={lesson.dayNumber} className="pointer-events-none">
                    {row}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!isPremium && (
        <div className="flex flex-col items-center gap-3 rounded-premiumCard bg-gradient-to-br from-premium-gold/15 to-premium-navy border border-premium-gold/30 p-5">
          <p className={`${TEXT.body} text-center`}>
            Unlock every day of the adventure, forever — no subscription.
          </p>
          <UpgradeButton tone="premium" />
        </div>
      )}
    </div>
  );
}
