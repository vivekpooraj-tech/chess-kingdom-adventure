"use client";

import { TEXT } from "@/lib/designSystem";

const REWARDS = [
  { emoji: "⭐", label: "Unlock new levels" },
  { emoji: "📈", label: "Sharpen your thinking" },
  { emoji: "🏆", label: "Earn achievements" },
  { emoji: "🧠", label: "Build a stronger mind" },
] as const;

/**
 * "Rewards on Your Journey" — motivational and presentation-only. There is
 * no separate achievements backend in this app to draw from here (the one
 * real, earned title a child has — `current.achievement` — is already
 * shown in PuzzleProgressPanel), so this section stays general encouragement
 * rather than inventing per-reward tracking that doesn't exist.
 */
export function PuzzleRewards() {
  return (
    <div className="flex flex-col gap-3 rounded-premiumCard border border-premium-gold/20 bg-premium-navy/70 p-4">
      <p className={`${TEXT.meta} text-premium-gold`}>REWARDS ON YOUR JOURNEY</p>
      <div className="grid grid-cols-2 gap-2">
        {REWARDS.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2 rounded-premiumBtn bg-premium-midnight/60 px-2.5 py-2"
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span className={`${TEXT.caption} normal-case`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
