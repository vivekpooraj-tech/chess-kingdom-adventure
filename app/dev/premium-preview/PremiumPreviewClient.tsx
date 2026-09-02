"use client";

import { useState } from "react";
import Link from "next/link";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { TacticsPaywall } from "@/components/upgrade/TacticsPaywall";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { PremiumCta } from "@/components/premium/PremiumCta";
import { PremiumFeatureModal } from "@/components/premium/PremiumGate";
import { SecondaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";

type Overlay = "game-limit" | "tactics" | "feature" | null;

/**
 * Each button below opens the exact real component a free user would hit
 * (GameLimitPaywall on their 3rd game of the day, TacticsPaywall on a
 * locked lesson) — same props, same pricing/discount-code UI (both use
 * UpgradeButton, which fetches the real regional price from /api/pricing
 * and validates codes against /api/stripe/validate-promo, both read-only).
 * Tapping "Unlock Everything" for real starts a real Stripe checkout —
 * that's the actual button doing what it always does, not something this
 * preview fakes, so only trigger it if you mean to test checkout itself.
 */
export function PremiumPreviewClient() {
  const [overlay, setOverlay] = useState<Overlay>(null);

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
      <div className="text-center max-w-md">
        <p className={`${TEXT.meta} text-red-400`}>DEV TEST MODE — Premium Preview</p>
        <h1 className={`${TEXT.display} mt-1`}>Premium UI Preview</h1>
        <p className={`${TEXT.body} mt-2`}>
          Renders the real premium components for visual checks only — nothing here reads or
          changes premium_status, RLS, or Stripe state.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setOverlay("game-limit")}
          className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between border border-white/5 hover:border-premium-gold/30 transition-colors text-left"
        >
          <div>
            <p className="font-classic-display text-lg text-premium-ivory">Game Limit Paywall</p>
            <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">
              Shown when the daily free-game limit is reached.
            </p>
          </div>
          <span className="text-premium-gold text-lg flex-none">→</span>
        </button>

        <button
          type="button"
          onClick={() => setOverlay("tactics")}
          className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between border border-white/5 hover:border-premium-gold/30 transition-colors text-left"
        >
          <div>
            <p className="font-classic-display text-lg text-premium-ivory">Tactics Paywall</p>
            <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">
              Shown when a free child taps a locked Tactics lesson.
            </p>
          </div>
          <span className="text-premium-gold text-lg flex-none">→</span>
        </button>

        <button
          type="button"
          onClick={() => setOverlay("feature")}
          className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between border border-white/5 hover:border-premium-gold/30 transition-colors text-left"
        >
          <div>
            <p className="font-classic-display text-lg text-premium-ivory">Premium Feature Modal</p>
            <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">
              Generic PremiumGate / PremiumFeatureModal for any locked feature.
            </p>
          </div>
          <span className="text-premium-gold text-lg flex-none">→</span>
        </button>

        <SecondaryCard className="flex flex-col gap-3">
          <p className="font-classic-display text-lg text-premium-ivory self-start">
            Premium CTA (inline block)
          </p>
          <PremiumCta />
        </SecondaryCard>

        <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col items-center gap-3">
          <p className="font-classic-display text-lg text-premium-ivory self-start">
            Upgrade Button (pricing + discount code)
          </p>
          <UpgradeButton tone="premium" />
        </div>
      </div>

      <Link
        href="/kingdom-map"
        className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
      >
        Back to Chess Kingdom
      </Link>

      {overlay === "game-limit" && (
        <GameLimitPaywall gameType="ai" onDismiss={() => setOverlay(null)} />
      )}
      {overlay === "tactics" && <TacticsPaywall onDismiss={() => setOverlay(null)} />}
      {overlay === "feature" && (
        <PremiumFeatureModal
          onDismiss={() => setOverlay(null)}
          intro="This feature is part of Chess Mind Premium."
        />
      )}
    </main>
  );
}
