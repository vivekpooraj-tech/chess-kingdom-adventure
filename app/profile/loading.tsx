import { PrimaryNav } from "@/components/nav/PrimaryNav";

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
 * when the real content swaps in, and renders PrimaryNav itself so the nav
 * bar doesn't flicker out and back during the transition.
 */
export default function ProfileLoading() {
  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-8 pb-24">
        <div className="w-full max-w-md h-24 rounded-premiumCard bg-premium-navy animate-pulse" />

        <div className="w-full max-w-md flex flex-col gap-2">
          <div className="h-3 w-20 rounded bg-premium-navy/70 animate-pulse" />
          <div className="h-14 rounded-premiumBtn bg-premium-navy/60 animate-pulse" />
          <div className="h-14 rounded-premiumBtn bg-premium-navy/60 animate-pulse" />
        </div>

        <div className="w-full max-w-md grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-premiumCard bg-premium-navy animate-pulse" />
          ))}
        </div>

        <div className="w-full max-w-md h-36 rounded-premiumCard bg-premium-navy animate-pulse" />

        <div className="w-full max-w-md h-16 rounded-premiumCard bg-premium-navy/70 animate-pulse" />
      </main>
      <PrimaryNav />
    </>
  );
}
