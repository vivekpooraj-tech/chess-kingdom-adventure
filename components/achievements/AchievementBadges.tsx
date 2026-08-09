"use client";

import { motion } from "framer-motion";
import { ACHIEVEMENTS, AchievementCategory } from "@/content/achievements";
import { TEXT } from "@/lib/designSystem";

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  learning: "Learning",
  thinking: "Thinking",
  playing: "Playing",
  exploration: "Exploration",
};

const CATEGORY_ORDER: AchievementCategory[] = ["learning", "thinking", "playing", "exploration"];

export function AchievementBadges({
  earnedKeys,
  justEarnedKeys = [],
}: {
  earnedKeys: string[];
  /** Achievements earned on THIS visit — gets a subtle unlock animation
   * instead of rendering identically to badges earned long ago. */
  justEarnedKeys?: string[];
}) {
  const earnedSet = new Set(earnedKeys);
  const justEarnedSet = new Set(justEarnedKeys);

  return (
    <div className="w-full max-w-lg rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col gap-5">
      <h2 className={TEXT.heading}>
        Achievements <span className="text-premium-ivory/40 text-base">({earnedKeys.length}/{ACHIEVEMENTS.length})</span>
      </h2>

      {CATEGORY_ORDER.map((category) => {
        const inCategory = ACHIEVEMENTS.filter((a) => a.category === category);
        if (inCategory.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-2">
            <p className={TEXT.meta}>{CATEGORY_LABELS[category]}</p>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
              {inCategory.map((a) => {
                const earned = earnedSet.has(a.key);
                const justEarned = earned && justEarnedSet.has(a.key);
                return (
                  <div
                    key={a.key}
                    title={earned ? a.description : "Not earned yet"}
                    className="flex flex-col items-center gap-1 text-center"
                  >
                    <motion.div
                      initial={justEarned ? { scale: 0.4, opacity: 0 } : false}
                      animate={justEarned ? { scale: 1, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border ${
                        earned
                          ? justEarned
                            ? "bg-premium-gold/25 border-premium-gold shadow-premiumGlow"
                            : "bg-premium-gold/15 border-premium-gold/50"
                          : "bg-white/5 border-white/10 grayscale opacity-40"
                      }`}
                    >
                      {earned ? a.emoji : "🔒"}
                    </motion.div>
                    <span className="font-classic-body text-[9px] text-premium-ivory/50 leading-tight">
                      {a.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
