import { Screen } from "@/components/layout/Screen";

/**
 * Phase 21 — this app has no route-level loading state anywhere (confirmed
 * during the tab-lag audit in an earlier phase), so a click on a dynamic,
 * per-request route like Profile (real auth check + resolveActiveChild +
 * 8 parallel queries, all server-side, before any HTML exists) gave zero
 * visual feedback until that round trip finished. With nothing on screen
 * changing, a normal-length wait reads as "my tap didn't register," which
 * is what was driving the repeat-tapping — the click was always working;
 * nothing ever showed it had.
 *
 * Next.js renders this the instant navigation starts (no data fetching of
 * its own), so it's the fix: real, immediate confirmation the tap landed.
 * Mirrors Profile's real layout shape (header block, two customize rows, a
 * 6-tile stat grid, an openings card, an achievements row) so nothing jumps
 * when the real content swaps in. (The bottom nav / sidebar is persistent —
 * mounted once by AppShell in the root layout — so it no longer needs to
 * be re-rendered here to avoid a flicker.)
 */
export default function ProfileLoading() {
  return (
    <>
      <Screen maxWidth="medium">
        <div className="w-full h-24 rounded-premiumCard bg-premium-navy animate-pulse" />

        <div className="w-full flex flex-col gap-2">
          <div className="h-3 w-20 rounded bg-premium-navy/70 animate-pulse" />
          <div className="h-14 rounded-premiumBtn bg-premium-navy/60 animate-pulse" />
          <div className="h-14 rounded-premiumBtn bg-premium-navy/60 animate-pulse" />
        </div>

        <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-premiumCard bg-premium-navy animate-pulse" />
          ))}
        </div>

        <div className="w-full h-36 rounded-premiumCard bg-premium-navy animate-pulse" />

        <div className="w-full h-16 rounded-premiumCard bg-premium-navy/70 animate-pulse" />
      </Screen>
    </>
  );
}
