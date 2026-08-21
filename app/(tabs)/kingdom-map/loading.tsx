import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";

/**
 * Home (mobile UI/UX redesign) — kingdom-map is the app's post-login
 * landing route and the heaviest single query load in the app (10 parallel
 * reads + an achievement-award write), so it was the single biggest
 * contributor to "navigation feels laggy" with no loading.tsx at all
 * (confirmed: this was the only route in the whole app missing one before
 * Profile got fixed in an earlier phase — every OTHER heavy route,
 * including this one, still had nothing). Mirrors the real dashboard shape
 * (header, hero card, daily challenge, destination grid, stats, journey
 * list) so nothing jumps when real content swaps in.
 */
export default function HomeLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-6 bg-premium-midnight px-6 pt-8 pb-24">
      <div className="h-9 w-40 rounded bg-premium-navy/70 animate-pulse" />
      <SkeletonBlock className="w-full max-w-md h-28" />
      <SkeletonBlock className="w-full max-w-md h-32" />
      <SkeletonBlock className="w-full max-w-md h-20" />
      <div className="w-full max-w-md grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>
      <SkeletonRow className="w-full max-w-md h-16" />
      <div className="w-full max-w-md flex flex-col gap-2">
        <SkeletonRow className="h-16" />
        <SkeletonRow className="h-16" />
        <SkeletonRow className="h-16" />
      </div>
    </main>
  );
}
