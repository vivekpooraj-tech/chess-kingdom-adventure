import { Screen } from "@/components/layout/Screen";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function OpeningsLoading() {
  return (
    <>
      <Screen maxWidth="medium">
        <div className="h-9 w-48 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full h-40" />
        <div className="w-full grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      </Screen>
      <PrimaryNav />
    </>
  );
}
