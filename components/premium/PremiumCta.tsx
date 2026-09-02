"use client";

import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { PREMIUM_HEADLINE_BENEFITS } from "@/lib/premium/capabilities";
import { PREMIUM_DURATION_LABEL } from "@/lib/premium/entitlement";
import { BRAND } from "@/lib/brand";
import { TEXT } from "@/lib/designSystem";

/**
 * The canonical Chess Mind Premium upsell block — premium navy/gold, calm,
 * parent-credible, no "BUY NOW" pressure. Renders inline (inside any card or
 * the PremiumGate fallback); GameLimitPaywall / TacticsPaywall keep their
 * context-specific modal copy and reuse UpgradeButton directly.
 *
 * `benefits` defaults to the short headline set (PREMIUM_HEADLINE_BENEFITS)
 * — keep any override short so it still lands on a 320px screen.
 */
export function PremiumCta({
  heading = `Unlock ${BRAND.name} Premium`,
  intro,
  benefits = PREMIUM_HEADLINE_BENEFITS,
  compact = false,
}: {
  heading?: string;
  intro?: string;
  benefits?: readonly string[];
  /** Drop the benefit list — for tight spots where only the price + button fit. */
  compact?: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <div className="flex flex-col items-center gap-1">
        <p className={`${TEXT.meta} text-premium-gold`}>♛ Premium</p>
        <h2 className={`${TEXT.heading} text-premium-ivory`}>{heading}</h2>
      </div>

      <p className={`${TEXT.body} max-w-xs`}>
        {intro ?? `Unlock everything for ${PREMIUM_DURATION_LABEL} with one payment — no recurring subscription.`}
      </p>

      {!compact && (
        <ul className="flex w-full max-w-xs flex-col gap-1.5 text-left">
          {benefits.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 font-classic-body text-sm text-premium-ivory/80"
            >
              <span className="text-premium-gold" aria-hidden="true">
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <UpgradeButton tone="premium" />
    </div>
  );
}
