import { notFound } from "next/navigation";
import { LOCAL_TEST_MODE } from "@/lib/devTestMode";
import { PremiumPreviewClient } from "./PremiumPreviewClient";

/**
 * Phase 20 — a UI-only showcase of the real premium components
 * (GameLimitPaywall, TacticsPaywall, UpgradeButton), for checking their
 * appearance locally without touching any real authorization. None of
 * these components read or write premium_status themselves — see the
 * phase report's premium-architecture audit — so rendering them here
 * doesn't grant, simulate, or fake premium access anywhere else in the
 * app; it's the same components a real free user would see, shown on
 * demand instead of behind a real limit/lock.
 *
 * Returns a real 404 whenever LOCAL_TEST_MODE is off — which, per
 * lib/devTestMode.ts, is unconditionally true in any production build
 * regardless of environment variables — so this route doesn't exist for
 * real users at all, not just "isn't linked."
 */
export default function PremiumPreviewPage() {
  if (!LOCAL_TEST_MODE) notFound();
  return <PremiumPreviewClient />;
}
