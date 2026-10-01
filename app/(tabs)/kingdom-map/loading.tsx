import { Screen } from "@/components/layout/Screen";
import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";

/**
 * Home loading skeleton — mirrors the redesigned kingdom-map layout so
 * content does not jump when the real dashboard streams in.
 */
export default function HomeLoading() {
  return (
    <Screen maxWidth="full">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <SkeletonRow className="h-7 w-36" />
            <SkeletonRow className="h-4 w-48" />
          </div>
          <SkeletonBlock className="h-14 w-full sm:w-56" />
        </div>

        <div className="home-hero-grid">
          <div className="flex flex-col gap-3">
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-44 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
          </div>
        </div>

        <SkeletonRow className="h-4 w-16" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-36 w-full" />

        <SkeletonRow className="h-4 w-20" />
        <SkeletonBlock className="h-28 w-full" />

        <SkeletonRow className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-16" />
        </div>

        <SkeletonBlock className="h-28 w-full" />
        <SkeletonRow className="h-4 w-24" />
      </div>
    </Screen>
  );
}
