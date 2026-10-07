import { Screen } from "@/components/layout/Screen";

/** Instant feedback on tap (every other tab has one). Shapes only. */
export default function WatchLoading() {
  return (
    <Screen maxWidth="wide">
      <div className="flex flex-col gap-3" role="status" aria-label="Finding live chess">
        <div className="h-9 w-48 rounded bg-premium-navy/70 animate-pulse" />
        <div className="h-4 w-64 max-w-full rounded bg-premium-navy/60 animate-pulse" />
        <div className="h-28 w-full rounded-premiumCard bg-premium-navy animate-pulse" />
      </div>
    </Screen>
  );
}
