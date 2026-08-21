import { SkeletonRow } from "@/components/ui/Skeleton";

export default function TournamentsLoading() {
  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
      <div className="h-9 w-56 rounded bg-premium-navy/70 animate-pulse" />
      <div className="h-14 w-full max-w-md rounded-premiumBtn bg-premium-gold/20 animate-pulse" />
      <div className="w-full max-w-md flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} className="h-16" />
        ))}
      </div>
    </main>
  );
}
