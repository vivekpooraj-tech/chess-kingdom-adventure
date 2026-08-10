"use client";

import { useEffect, useState } from "react";

// Was 280 — that floor forced an overflow at the shortest real landscape
// phone heights (e.g. 812x375), where truly available height after
// reserving chrome comes in under 280px. Lowering it lets the board size
// itself to what's actually there instead of forcing an oversized board
// that pushes the page into a scroll (Phase 16 section 8: "must fit
// without scrolling" in landscape). Still comfortably larger than the old
// pre-Phase-15 fixed sizes (360-680px) at every breakpoint that isn't this
// extreme edge case.
const MIN_SIZE = 240;
const MAX_SIZE = 920;
const DESKTOP_BREAKPOINT = 1024; // matches Tailwind's `lg`
const DESKTOP_SIDE_PANEL_WIDTH = 340; // reserved for GameArenaLayout's side panel + gap
const DESKTOP_MARGIN = 64;
const MOBILE_MARGIN = 24;
// Short landscape phones (rotated sideways) land under DESKTOP_BREAKPOINT
// but GameArenaLayout's own CSS switches them to the same side-by-side
// layout via a real media query (Tailwind's `lg:` is width-only, no
// orientation variant) — this has to match that breakpoint and side-panel
// width exactly, or the hook computes a size that doesn't fit its actual
// container.
const LANDSCAPE_HEIGHT_THRESHOLD = 500;
const LANDSCAPE_SIDE_PANEL_WIDTH = 240;
const LANDSCAPE_MARGIN = 48;

/**
 * Computes a large, viewport-driven board size for actual gameplay screens
 * (Free Play, Online Game, Opening Practice) — NOT for lesson/study boards,
 * which keep their own fixed `size` prop untouched.
 *
 * Conceptually: boardSize = min(availableWidth, availableHeight), where
 * availableWidth reserves room for the desktop side panel (move list/
 * controls) above the `lg` breakpoint, and availableHeight subtracts
 * `reservedHeight` (header, player info rows, clocks, controls) from the
 * viewport. Recomputed on resize. The returned value still passes through
 * ChessBoard's own existing `min(size, 100%, Xvh)` CSS ceiling — this hook
 * only decides what the *first* term of that min() should be; it doesn't
 * replace ChessBoard's own safety caps.
 *
 * SSR-safe: returns a sane fallback until the first client-side measurement
 * in useEffect (window doesn't exist during server render).
 */
export function useArenaBoardSize(reservedHeight: number = 220): number {
  const [size, setSize] = useState(480);

  useEffect(() => {
    function compute() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isDesktop = vw >= DESKTOP_BREAKPOINT;
      const isShortLandscape = !isDesktop && vw > vh && vh <= LANDSCAPE_HEIGHT_THRESHOLD;

      let availableWidth: number;
      if (isDesktop) {
        availableWidth = vw - DESKTOP_SIDE_PANEL_WIDTH - DESKTOP_MARGIN;
      } else if (isShortLandscape) {
        availableWidth = vw - LANDSCAPE_SIDE_PANEL_WIDTH - LANDSCAPE_MARGIN;
      } else {
        availableWidth = vw - MOBILE_MARGIN;
      }
      const availableHeight = vh - reservedHeight;

      const next = Math.floor(Math.min(availableWidth, availableHeight));
      setSize(Math.max(MIN_SIZE, Math.min(MAX_SIZE, next)));
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [reservedHeight]);

  return size;
}
