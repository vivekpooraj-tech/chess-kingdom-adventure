import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function OpeningsLoading() {
  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="h-9 w-48 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full max-w-md h-40" />
        <div className="w-full max-w-md grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      </main>
      <PrimaryNav />
    </>
  );
}
