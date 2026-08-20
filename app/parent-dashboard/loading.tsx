import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function ParentDashboardLoading() {
  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-16">
      <div className="h-9 w-56 rounded bg-premium-navy/70 animate-pulse" />
      <SkeletonBlock className="w-full max-w-md h-32" />
      <SkeletonBlock className="w-full max-w-md h-48" />
      <SkeletonBlock className="w-full max-w-md h-40" />
    </main>
  );
}
