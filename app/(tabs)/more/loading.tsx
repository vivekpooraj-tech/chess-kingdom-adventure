import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";

export default function MoreLoading() {
  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
      <div className="h-9 w-24 rounded bg-premium-navy/70 animate-pulse" />
      <SkeletonBlock className="w-full max-w-md h-24" />
      <div className="w-full max-w-md flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} className="h-16" />
        ))}
      </div>
    </main>
  );
}
