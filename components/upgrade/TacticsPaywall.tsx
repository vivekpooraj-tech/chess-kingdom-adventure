"use client";

import { Logo } from "@/components/branding/Logo";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import { TEXT } from "@/lib/designSystem";

const CHECKLIST = [
  "All 21 Tactics lessons",
  "Forks, pins, skewers, and every pattern in between",
  "Full Chess Mind experience",
  "Unlimited games vs Computer and Multiplayer",
];

/**
 * Shown when a free child taps a locked Tactics lesson — same shape as
 * GameLimitPaywall (components/upgrade/GameLimitPaywall.tsx), just with
 * Tactics-specific copy instead of daily-game-limit copy. Reuses
 * UpgradeButton for the actual price/checkout/discount-code flow rather
 * than duplicating it.
 */
export function TacticsPaywall({ onDismiss }: { onDismiss: () => void }) {
  return (
    <ModalOverlay ariaLabel="Unlock the Tactics course">
        <Logo variant="compact" size={48} />
        <p className={`${TEXT.meta} text-premium-gold`}>⚔ Tactics — Full Version</p>
        <p className={TEXT.body}>This lesson is part of the complete Tactics course.</p>

        <ul className="flex flex-col items-start gap-1.5 w-full">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory/80">
              <span className="text-premium-gold" aria-hidden="true">✓</span> {item}
            </li>
          ))}
        </ul>

        <UpgradeButton tone="premium" label="Unlock the Full Version" />

        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] font-classic-body text-sm text-premium-ivory/50 underline underline-offset-2"
        >
          Maybe Later
        </button>
    </ModalOverlay>
  );
}
