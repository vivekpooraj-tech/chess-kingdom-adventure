"use client";

import { UtilityNavIcons } from "./UtilityNavIcons";

/**
 * Phone's persistent Learn + More entry point. Phone has no shared
 * `.app-topbar` chrome (that class is tablet/desktop only, and its CSS
 * reserves layout height via `--topbar-h` in ways already tuned for many
 * other screens' board-sizing math — extending it to phone was considered
 * and rejected as an unnecessarily wide change for this phase). Instead,
 * this renders the same icons in a small `position: fixed` element that
 * reserves no layout space at all, so it cannot affect any existing
 * height calculation anywhere in the app.
 *
 * Visibility is CSS-driven off `html[data-layout]`, the same first-paint-
 * flash-free mechanism every other breakpoint-conditional chrome piece in
 * this app already uses (see .app-topbar itself) — hidden by default,
 * shown only for `data-layout="phone"` (globals.css).
 */
export function PhoneUtilityIcons() {
  return (
    <div
      className="phone-utility-icons world-shell fixed z-40 rounded-full bg-premium-midnightDeep/90 backdrop-blur-md border border-premium-gold/10 px-1 py-0.5"
      style={{
        // Top-right, not top-left: nearly every page's own heading/brand
        // text starts top-left, so a fixed element there collides with page
        // content at scroll-top (found during this phase's own visual QA).
        // Top-right stays clear of that on every screen checked.
        top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
        right: "calc(env(safe-area-inset-right, 0px) + 0.5rem)",
      }}
    >
      <UtilityNavIcons />
    </div>
  );
}
