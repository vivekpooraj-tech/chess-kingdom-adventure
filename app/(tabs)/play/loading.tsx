import { TabPageShell } from "@/components/nav/TabPageShell";
import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";

/**
 * V1 P1 fix #3 — Play's own page.tsx is a static server component (no data
 * fetch of its own), so this mostly exists for the instant it takes Next.js
 * to stream the real page in on a slow connection, and to keep the primary
 * "Play" tab from ever being the one tab with zero tap feedback. Mirrors the
 * real layout (heading, three game-mode cards, an online-play card, a
 * "Today" row) with neutral blocks only — no puzzle/game/Daily Challenge
 * data is guessed here.
 */
export default function PlayLoading() {
  return (
    <TabPageShell maxWidth="wide">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-28 rounded bg-premium-navy/70 animate-pulse" />
        <div className="h-4 w-64 max-w-full rounded bg-premium-navy/60 animate-pulse" />
      </div>

      <div
        className="auto-grid mx-auto w-full max-w-3xl"
        style={{ "--grid-min": "16rem" } as React.CSSProperties}
      >
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>

      <SkeletonBlock className="w-full h-40" />

      <div className="w-full flex flex-col gap-2">
        <div className="h-3 w-16 rounded bg-premium-navy/60 animate-pulse" />
        <div
          className="auto-grid items-start"
          style={{ "--grid-min": "20rem" } as React.CSSProperties}
        >
          <SkeletonRow className="h-20" />
          <SkeletonRow className="h-20" />
        </div>
      </div>
    </TabPageShell>
  );
}
