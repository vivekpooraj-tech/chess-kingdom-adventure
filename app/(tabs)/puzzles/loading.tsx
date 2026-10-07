import { TabPageShell } from "@/components/nav/TabPageShell";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/**
 * Navigation-lag fix: Puzzles had no route-level loading boundary, so a tap on the tab showed
 * the previous page until the route's server round trip finished (Profile, Play and Home all
 * have one, which is why they feel fast). Shapes only — no puzzle or progress data is guessed.
 */
export default function PuzzlesLoading() {
  return (
    <TabPageShell maxWidth="wide">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-32 rounded bg-premium-navy/70 animate-pulse" />
        <div className="h-4 w-56 max-w-full rounded bg-premium-navy/60 animate-pulse" />
      </div>
      <SkeletonBlock className="mx-auto h-72 w-full max-w-md" />
      <SkeletonBlock className="h-16 w-full" />
    </TabPageShell>
  );
}
