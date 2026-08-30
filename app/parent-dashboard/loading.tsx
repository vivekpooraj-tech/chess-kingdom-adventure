import { Screen } from "@/components/layout/Screen";
import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function ParentDashboardLoading() {
  return (
    <Screen maxWidth="compact">
      <div className="h-9 w-56 rounded bg-premium-navy/70 animate-pulse" />
      <SkeletonBlock className="w-full h-32" />
      <SkeletonBlock className="w-full h-48" />
      <SkeletonBlock className="w-full h-40" />
    </Screen>
  );
}
