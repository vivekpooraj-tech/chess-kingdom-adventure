import { Screen } from "@/components/layout/Screen";
import { SkeletonRow } from "@/components/ui/Skeleton";

export default function TournamentsLoading() {
  return (
    <Screen maxWidth="medium">
      <div className="h-9 w-56 rounded bg-premium-navy/70 animate-pulse" />
      <div className="h-14 w-full rounded-premiumBtn bg-premium-gold/20 animate-pulse" />
      <div className="w-full flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} className="h-16" />
        ))}
      </div>
    </Screen>
  );
}
