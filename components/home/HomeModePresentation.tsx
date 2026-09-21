import type { ReactNode } from "react";

/**
 * The mode-aware Home presentation switch (Phase 2.1-A infrastructure;
 * rewritten Phase 2.1-F to remove the first-paint composition flash).
 *
 * ORIGINAL (2.1-A/2.1-E) DESIGN: a "use client" component that called
 * useMode()/useModeVariant() and rendered only the ONE matching child.
 * That was hydration-*safe* (no mismatch: the server and the client's
 * first render both produced classic-pro) but not flash-*free*: React
 * state only corrects to the real mode in a useEffect, which runs AFTER
 * the server-sent HTML has already been painted — so Adult/Kids users
 * visibly saw the Classic/Pro composition for a moment on every
 * navigation, once the three compositions actually diverged (2.1-C/D).
 *
 * FIX: this is now a plain Server Component. All three compositions are
 * rendered into the HTML on every request (unchanged from before — they
 * were already all being built in page.tsx), each wrapped in a sibling
 * `<div>` carrying one of the three `home-mode-panel-*` hook classes.
 * app/modes.css shows exactly one of the three — driven by the SAME
 * `[data-mode]` attribute ModeBootstrapScript already writes onto <html>
 * via a synchronous inline script BEFORE the browser paints any of this
 * body content (see components/mode/ModeBootstrapScript.tsx, already
 * rendered ahead of the page content in app/layout.tsx). Because that
 * attribute is correct before this markup is ever painted, the right
 * composition is visible from the very first pixel — no client
 * component, no useEffect correction, no hydration step of any kind is
 * involved in this decision anymore, so there is nothing left to flash.
 *
 * The hidden two panels use `display: none` (removed from layout and
 * paint); the one visible panel uses `display: contents` so its wrapper
 * div doesn't introduce an extra box between the composition's own
 * top-level sections and .screen-stack's flex `gap` (the wrapper must be
 * layout-transparent, or spacing between Home's sections would break).
 */
export function HomeModePresentation({
  classicPro,
  adult,
  kids,
}: {
  classicPro: ReactNode;
  adult: ReactNode;
  kids: ReactNode;
}) {
  return (
    <>
      <div className="home-mode-panel home-mode-panel-classic-pro">{classicPro}</div>
      <div className="home-mode-panel home-mode-panel-adult">{adult}</div>
      <div className="home-mode-panel home-mode-panel-kids">{kids}</div>
    </>
  );
}
