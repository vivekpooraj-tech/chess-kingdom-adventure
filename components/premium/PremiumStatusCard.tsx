"use client";

import { useState } from "react";
import { SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PremiumCta } from "@/components/premium/PremiumCta";
import { usePremium } from "@/lib/premium/usePremium";
import { formatExpiryDate, PREMIUM_DURATION_LABEL, type PremiumState } from "@/lib/premium/entitlement";
import { getFreeDayNumbers } from "@/content/kingdomZones";
import { TEXT } from "@/lib/designSystem";

/**
 * Parent Dashboard account/plan section. Server-authoritative: seeded with
 * the state the page already resolved, then re-reads /api/premium/status on
 * mount and offers a "Refresh" that re-derives the account flag from the
 * verified premium_entitlements rows (POST /api/premium/refresh).
 *
 * Parent-only surface (the dashboard is behind the parent gate) — no Stripe
 * internals shown, just plan / expiry / upgrade.
 */
export function PremiumStatusCard({ initial }: { initial: PremiumState }) {
  const { state, entitlement, restore } = usePremium(initial);
  const [restoring, setRestoring] = useState(false);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);

  const expiryLabel = formatExpiryDate(state.expiresAt);
  const freeLessonCount = getFreeDayNumbers().length;

  async function handleRestore() {
    setRestoring(true);
    setRestoreNote(null);
    try {
      await restore();
      setRestoreNote("Account refreshed.");
    } catch {
      setRestoreNote("Couldn't refresh right now — try again in a moment.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <SecondaryCard className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`${TEXT.heading}`}>Plan</h2>
        <span
          className={
            state.isPremium
              ? "rounded-full bg-premium-gold/15 px-3 py-1 font-classic-body text-xs font-semibold text-premium-gold"
              : "rounded-full bg-premium-midnightDeep px-3 py-1 font-classic-body text-xs text-premium-ivory/60"
          }
        >
          {state.isPremium ? "Premium — active" : state.isExpired ? "Premium — expired" : "Free plan"}
        </span>
      </div>

      {state.isPremium ? (
        <>
          <p className={TEXT.body}>
            All Premium features are unlocked
            {expiryLabel ? ` until ${expiryLabel}` : ""}.
          </p>
          {state.daysRemaining != null && state.daysRemaining <= 30 && (
            <p className={`${TEXT.caption} text-premium-gold`}>
              {state.daysRemaining} day{state.daysRemaining === 1 ? "" : "s"} left — renew any time
              with one more {PREMIUM_DURATION_LABEL} payment.
            </p>
          )}
          {entitlement?.purchasedAt && (
            <p className={TEXT.caption}>
              Purchased {formatExpiryDate(entitlement.purchasedAt)} · one-time payment
            </p>
          )}
          {(state.daysRemaining != null && state.daysRemaining <= 45) && (
            <div className="pt-1">
              <PremiumCta compact heading="Extend your Premium" />
            </div>
          )}
        </>
      ) : (
        <>
          <p className={TEXT.body}>
            {state.isExpired
              ? "Your Premium has ended. The core adventure is still yours — renew to bring back unlimited puzzles, deeper analysis and the full AI Coach."
              : `Free plan — the first lessons of every Kingdom zone are available (${freeLessonCount} lessons), plus the Daily Challenge and ${"3"} Puzzle Trainer puzzles a day.`}
          </p>
          <div className="pt-1">
            <PremiumCta heading={state.isExpired ? "Renew Chess Mind Premium" : undefined} />
          </div>
        </>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button tone="premium" variant="ghost" size="md" onClick={handleRestore} disabled={restoring}>
          {restoring ? "Refreshing…" : "Refresh account"}
        </Button>
        {restoreNote && <span className={TEXT.caption}>{restoreNote}</span>}
      </div>
    </SecondaryCard>
  );
}
