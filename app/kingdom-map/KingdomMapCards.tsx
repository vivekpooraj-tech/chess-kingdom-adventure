"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lesson } from "@/lib/types";

export function KingdomMapCards({
  lessons,
  currentDay,
  completedDays,
}: {
  lessons: Lesson[];
  currentDay: number;
  completedDays: number[];
}) {
  return (
    <div className="relative w-full max-w-md">
      {lessons.map((lesson) => {
        const unlocked = lesson.dayNumber <= currentDay;
        const completed = completedDays.includes(lesson.dayNumber);
        return (
          <Link
            key={lesson.dayNumber}
            href={unlocked ? `/lesson/${lesson.dayNumber}` : "#"}
            className={!unlocked ? "pointer-events-none" : ""}
          >
            <motion.div
              whileTap={unlocked ? { scale: 0.96 } : {}}
              className="flex items-center gap-4 rounded-card bg-white/85 shadow-toy p-5 mb-4"
              style={{ opacity: unlocked ? 1 : 0.5 }}
            >
              <div className="w-16 h-16 rounded-full bg-kingdom-gold/80 flex items-center justify-center text-3xl">
                {completed ? "💎" : unlocked ? "✨" : "🔒"}
              </div>
              <div>
                <p className="font-display text-lg text-kingdom-night">
                  Day {lesson.dayNumber}: {lesson.title}
                </p>
                <p className="font-body text-sm text-kingdom-night/60 capitalize">
                  {lesson.crystal} Crystal {completed && "— Recovered!"}
                </p>
              </div>
            </motion.div>
          </Link>
        );
      })}

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
