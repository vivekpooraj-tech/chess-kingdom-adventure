import { Screen, type ScreenMaxWidth } from "@/components/layout/Screen";

/**
 * The shared "a Chess Mind screen is loading" placeholder.
 *
 * Several routes are client components that must resolve identity (auth +
 * active child) before they know what to render — the Chess Mind
 * exercises, the Academy video page, the Piece Library, a tournament.
 * Route-level `loading.tsx` only covers the navigation → mount gap; this
 * covers the component's OWN "still resolving" window, which used to
 * render a bare black `<main/>`.
 *
 * Deliberately generic: page chrome (premium ground, fluid gutter, nav
 * clearance — all from `<Screen>`) plus a settling title and two blocks,
 * NOT a per-page shape match. It only has to read as "loading", never as
 * blank or broken. `prefers-reduced-motion` collapses the pulse to a
 * static tint via the global rule in globals.css.
 */
export function ScreenSkeleton({ maxWidth = "compact" }: { maxWidth?: ScreenMaxWidth }) {
  return (
    <Screen maxWidth={maxWidth}>
      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-2.5">
        <div className="h-7 w-36 max-w-full rounded-premiumBtn bg-premium-navy animate-pulse" />
        <div className="h-3.5 w-48 max-w-full rounded bg-premium-navy/60 animate-pulse" />
      </div>
      <div className="mx-auto aspect-[5/4] w-full max-w-md rounded-premiumCard bg-premium-navy animate-pulse" />
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
        <div className="h-20 w-full rounded-premiumCard bg-premium-navy/80 animate-pulse" />
        <div className="h-11 w-40 rounded-premiumBtn bg-premium-navy/70 animate-pulse" />
      </div>
    </Screen>
  );
}
