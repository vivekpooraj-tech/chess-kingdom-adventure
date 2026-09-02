"use client";

import type { ReactNode } from "react";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import { PremiumCta } from "@/components/premium/PremiumCta";
import type { PremiumCapability } from "@/lib/premium/capabilities";

/**
 * Wrap a Premium-only surface. Free accounts get `fallback` (a calm
 * PremiumCta by default); Premium accounts get `children` unchanged.
 *
 * `isPremium` must come from a server-authoritative source — a Server
 * Component prop, or the usePremium() hook (which reads /api/premium/status).
 * Never pass a value derived from a URL param or localStorage.
 *
 * Do NOT wrap core chess play, the Daily Challenge, free lesson days, or the
 * daily Puzzle Trainer allowance — see lib/premium/capabilities.ts ALWAYS_FREE.
 */
export function PremiumGate({
  isPremium,
  children,
  fallback,
  heading,
  intro,
}: {
  isPremium: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  /** Passed to the default PremiumCta fallback. */
  heading?: string;
  intro?: string;
  /** Documentation only — which capability this gate protects. */
  capability?: PremiumCapability;
}) {
  if (isPremium) return <>{children}</>;
  return <>{fallback ?? <PremiumCta heading={heading} intro={intro} />}</>;
}

/**
 * Modal variant — for "tapped a locked feature" moments. Same PremiumCta
 * content inside the shared ModalOverlay (which handles scroll + safe areas).
 */
export function PremiumFeatureModal({
  onDismiss,
  heading,
  intro,
}: {
  onDismiss: () => void;
  heading?: string;
  intro?: string;
}) {
  return (
    <ModalOverlay ariaLabel="Unlock Chess Mind Premium">
      <PremiumCta heading={heading} intro={intro} />
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-[44px] font-classic-body text-sm text-premium-ivory/50 underline underline-offset-2"
      >
        Maybe later
      </button>
    </ModalOverlay>
  );
}
