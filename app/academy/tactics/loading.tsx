import { Screen } from "@/components/layout/Screen";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";

export default function TacticsLoading() {
  return (
    <>
      <Screen maxWidth="medium">
        <div className="h-9 w-40 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full h-24" />
        <div className="w-full flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} className="h-16" />
          ))}
        </div>
      </Screen>
      <PrimaryNav />
    </>
  );
}
