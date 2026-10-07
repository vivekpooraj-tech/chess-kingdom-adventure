"use client";

import { Logo } from "@/components/branding/Logo";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import { TEXT } from "@/lib/designSystem";

const CHECKLIST = [
  "All 21 Tactics lessons",
  "Extra learning features",
  "Full Chess Mind experience",
];

/**
 * Safety-net Premium prompt for Play vs Computer, shown only if the server
 * ever refuses to start a computer game (it does not today: daily game limits
 * were removed in supabase/migrations/0047_remove_free_game_daily_limits.sql).
 * Playing chess is free; the copy must never imply Premium is needed to play.
 * Reuses UpgradeButton for the actual price/checkout/discount-code flow rather
 * than duplicating it.
 */
export function GameLimitPaywall({
  onDismiss,
}: {
  gameType?: "ai";
  onDismiss: () => void;
}) {
  return (
    <ModalOverlay ariaLabel="Chess Mind Premium">
        <Logo variant="compact" size={48} />
        <p className={`${TEXT.meta} text-premium-gold`}>♟ Chess Mind Premium</p>
        <p className={TEXT.body}>Chess games are free. Premium adds more ways to learn.</p>

        <ul className="flex flex-col items-start gap-1.5 w-full">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory/80">
              <span className="text-premium-gold" aria-hidden="true">✓</span> {item}
            </li>
          ))}
        </ul>

        <UpgradeButton tone="premium" label="Explore Premium" />

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
