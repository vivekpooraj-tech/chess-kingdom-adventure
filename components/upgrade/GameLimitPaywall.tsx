"use client";

import { Logo } from "@/components/branding/Logo";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { TEXT } from "@/lib/designSystem";

const CHECKLIST = [
  "Unlimited games vs Computer",
  "Unlimited Multiplayer",
  "No daily gameplay limits",
  "Full Chess Mind experience",
];

/**
 * Shown when a free child has used their 2 daily games in a category
 * (AI or multiplayer — separate counters, see
 * supabase/migrations/0019_daily_free_game_limits.sql). Reuses UpgradeButton
 * for the actual price/checkout/discount-code flow rather than
 * duplicating it — passing a custom `label` there already renders the
 * regional price as its own line with the discount toggle beneath it.
 */
export function GameLimitPaywall({
  gameType,
  onDismiss,
}: {
  gameType: "ai" | "multiplayer";
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-premium-midnightDeep/80 backdrop-blur-sm flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Unlock unlimited play"
    >
      <div className="max-w-sm w-full bg-premium-navy rounded-premiumCard shadow-premiumGlow border border-premium-gold/20 p-6 flex flex-col items-center gap-4 text-center">
        <Logo variant="compact" size={48} />
        <p className={`${TEXT.meta} text-premium-gold`}>♟ Unlimited Play</p>
        <p className={TEXT.body}>
          You've used your 2 free {gameType === "ai" ? "computer" : "multiplayer"} games for today.
        </p>
        <p className={TEXT.body}>Keep playing without daily limits.</p>

        <ul className="flex flex-col items-start gap-1.5 w-full">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory/80">
              <span className="text-premium-gold" aria-hidden="true">✓</span> {item}
            </li>
          ))}
        </ul>

        <UpgradeButton tone="premium" label="Unlock Unlimited Play" />

        <button
          type="button"
          onClick={onDismiss}
          className="font-classic-body text-sm text-premium-ivory/50 underline underline-offset-2"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
