import { Screen } from "@/components/layout/Screen";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/**
 * Streamed instantly by Next.js while page.tsx does its data fetching, so
 * the parent never sees a blank screen. Mirrors the real dashboard's shape
 * (title · children manager · a run of stat/insight cards) closely enough
 * that the swap-in isn't a jarring reflow.
 */
export default function ParentDashboardLoading() {
  return (
    <Screen maxWidth="compact">
      <div className="h-12 w-full rounded bg-premium-navy/70 animate-pulse mb-2" />
      <div className="h-9 w-56 rounded bg-premium-navy/70 animate-pulse" />
      <SkeletonBlock className="w-full h-28" />
      <SkeletonBlock className="w-full h-24" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonBlock className="w-full h-40" />
      <SkeletonBlock className="w-full h-32" />
      <SkeletonBlock className="w-full h-32" />
    </Screen>
  );
}
