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
    <div className="flex w-full flex-col gap-5 rounded-premiumCard bg-premium-navy p-5 shadow-premiumCard">
      <h2 className={TEXT.heading}>
        Achievements <span className="text-premium-ivory/40 text-base">({earnedKeys.length}/{ACHIEVEMENTS.length})</span>
      </h2>

      {CATEGORY_ORDER.map((category) => {
        const inCategory = ACHIEVEMENTS.filter((a) => a.category === category);
        if (inCategory.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-2">
            <p className={TEXT.meta}>{CATEGORY_LABELS[category]}</p>
            {/* Content-aware: a cell is never narrower than a badge + label
                room, so the row picks 4 / 5 / 6 / 8+ columns from the space
                it actually has — no fixed count that can crush the badges. */}
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 3.5rem), 1fr))" }}
            >
              {inCategory.map((a) => {
                const earned = earnedSet.has(a.key);
                const justEarned = earned && justEarnedSet.has(a.key);
                return (
                  <div
                    key={a.key}
                    title={earned ? a.description : "Not earned yet"}
                    className="flex min-w-0 flex-col items-center gap-1 text-center"
                  >
                    <motion.div
                      initial={justEarned ? { scale: 0.4, opacity: 0 } : false}
                      animate={justEarned ? { scale: 1, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`flex h-12 w-12 flex-none items-center justify-center rounded-full border text-xl ${
                        earned
                          ? justEarned
                            ? "bg-premium-gold/25 border-premium-gold shadow-premiumGlow"
                            : "bg-premium-gold/15 border-premium-gold/50"
                          : "bg-white/5 border-white/10 grayscale opacity-40"
                      }`}
                    >
                      {earned ? a.emoji : "🔒"}
                    </motion.div>
                    <span className="w-full break-words font-classic-body text-[11px] leading-tight text-premium-ivory/50">
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
