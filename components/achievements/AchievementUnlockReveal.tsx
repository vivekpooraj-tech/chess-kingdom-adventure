"use client";

import { motion } from "framer-motion";
import { AchievementDef } from "@/content/achievements";

/**
 * A single-achievement unlock moment (Phase 11 point 16) — the same visual
 * language as AchievementBadges' unlock animation, just standalone for the
 * Reward screen instead of inside the full grid. Only ever rendered when an
 * achievement was actually earned this lesson (see the Reward step, which
 * gets its `achievement` prop from evaluateAndAwardAchievements' real
 * return value — never a guess).
 */
export function AchievementUnlockReveal({ achievement }: { achievement: AchievementDef }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 16 }}
      className="w-full rounded-premiumCard bg-gradient-to-br from-premium-gold/15 to-premium-navy border border-premium-gold/40 shadow-premiumGlow p-5 flex flex-col items-center gap-2 text-center"
    >
      <p className="font-classic-body text-[10px] uppercase tracking-wider text-premium-gold font-semibold">
        Achievement Unlocked
      </p>
      <motion.div
        initial={{ scale: 0.4, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-premium-gold/20 border border-premium-gold/50 flex items-center justify-center text-3xl"
      >
        {achievement.emoji}
      </motion.div>
      <p className="font-classic-display text-lg text-premium-ivory">{achievement.title}</p>
      <p className="font-classic-body text-sm text-premium-ivory/60">{achievement.description}</p>
    </motion.div>
  );
}
