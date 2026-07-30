"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lesson } from "@/lib/types";
import { FREE_DAY_LIMIT } from "@/content/lessons";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";

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
  return (
    <div className="relative w-full max-w-md">
      {lessons.map((lesson) => {
        const reachedByProgress = lesson.dayNumber <= currentDay;
        const needsPremium = lesson.dayNumber > FREE_DAY_LIMIT && !isPremium;
        const unlocked = reachedByProgress && !needsPremium;
        const completed = completedDays.includes(lesson.dayNumber);

        const card = (
          <motion.div
            whileTap={unlocked ? { scale: 0.96 } : {}}
            className="flex items-center gap-4 rounded-card bg-white/85 shadow-toy p-5 mb-4"
            style={{ opacity: unlocked ? 1 : 0.5 }}
          >
            <div className="w-16 h-16 rounded-full bg-kingdom-gold/80 flex items-center justify-center text-3xl">
              {completed ? "💎" : needsPremium ? "⭐" : unlocked ? "✨" : "🔒"}
            </div>
            <div>
              <p className="font-display text-lg text-kingdom-night">
                Day {lesson.dayNumber}: {lesson.title}
              </p>
              <p className="font-body text-sm text-kingdom-night/60 capitalize">
                {lesson.crystal} Crystal{" "}
                {completed ? "— Recovered!" : needsPremium ? "— Premium" : ""}
              </p>
            </div>
          </motion.div>
        );

        // A day needing premium is still a real, reachable link — it goes
        // to the lesson page, which itself redirects to /upgrade if not
        // premium (defense in depth, not just a UI-level lock).
        if (unlocked || needsPremium) {
          return (
            <Link key={lesson.dayNumber} href={`/lesson/${lesson.dayNumber}`}>
              {card}
            </Link>
          );
        }

        return (
          <div key={lesson.dayNumber} className="pointer-events-none">
            {card}
          </div>
        );
      })}

      {!isPremium && (
        <div className="flex flex-col items-center gap-3 rounded-card bg-kingdom-gold/10 p-5 mb-4">
          <p className="font-body text-kingdom-night/70 text-center">
            Unlock every day of the adventure, forever — no subscription.
          </p>
          <UpgradeButton />
        </div>
      )}

      <div className="flex items-center gap-4 rounded-card bg-white/40 p-5 opacity-40">
        <div className="w-16 h-16 rounded-full bg-kingdom-night/10 flex items-center justify-center text-3xl">
          🔒
        </div>
        <p className="font-display text-lg text-kingdom-night/60">
          Days {lessons.length + 1}–30 unlock as the adventure grows!
        </p>
      </div>
    </div>
  );
}
