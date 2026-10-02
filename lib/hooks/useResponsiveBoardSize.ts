"use client";

import { useEffect, useState } from "react";
import { getViewportMetrics } from "@/lib/viewport";

/**
 * Scales a lesson/training screen's own fixed board size up on tablet-class
 * viewports, while leaving it exactly unchanged on phones. Unlike
 * useArenaBoardSize/ChessFocusLayout (which solve the harder side-by-side
 * gameplay-column problem by measuring the surrounding chrome), these
 * screens each already have a single `size` tuned for phones — this hook
 * only asks "is there meaningfully more room than a phone has, and if so,
 * how much of it can this board safely take without swallowing the
 * question/answer UI below or beside it?"
 *
 * The short viewport edge (not raw width) decides phone vs. tablet, so a
 * landscape phone is never misread as a tablet. getViewportMetrics() already
 * corrects for Android WebViews that misreport a tablet's innerWidth as
 * phone-sized, so that correction does not need to be duplicated here.
 *
 * SSR/hydration: starts at `baseSize` (matching what the server rendered,
 * since the server has no viewport to measure) and only grows after mount,
 * once the real viewport is known — never a hydration mismatch.
 */
export function useResponsiveBoardSize(
  baseSize: number,
  options?: {
    /** Hard ceiling for this screen's own layout (side panel, caption,
     * answer controls). Defaults to a generous cap for a single-column
     * screen; pass a tighter value for a screen that shares its row with
     * other content. */
    maxSize?: number;
    /** Short viewport edge (px) at and above which a screen counts as
     * tablet-class rather than phone-class. */
    minTabletEdge?: number;
    /** Share of viewport width/height a screen may claim. Defaults to the
     * values tuned against the general tablet case; a screen whose own
     * layout already reserves generous room for its surrounding UI (and
     * whose container has been widened to match) can opt into a larger
     * share here without changing what every other screen gets. */
    widthMultiplier?: number;
    heightMultiplier?: number;
  }
): number {
  const maxSize = options?.maxSize ?? 640;
  const minTabletEdge = options?.minTabletEdge ?? 650;
  const widthMultiplier = options?.widthMultiplier ?? 0.75;
  const heightMultiplier = options?.heightMultiplier ?? 0.8;

  const [size, setSize] = useState(baseSize);

  useEffect(() => {
    function compute() {
      const { width, height } = getViewportMetrics();
      const shortEdge = Math.min(width, height);

      if (shortEdge < minTabletEdge) {
        setSize(baseSize);
        return;
      }

      // Tablet or larger: let the board take a healthy share of the
      // viewport, bounded so there's always room left for the
      // question/answer UI (below it in portrait, beside it in landscape)
      // and never past this screen's own maxSize. Never shrinks below the
      // phone base size.
      const candidate = Math.min(width * widthMultiplier, height * heightMultiplier, maxSize);
      setSize(Math.max(baseSize, Math.round(candidate)));
    }

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    window.visualViewport?.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      window.visualViewport?.removeEventListener("resize", compute);
    };
  }, [baseSize, maxSize, minTabletEdge, widthMultiplier, heightMultiplier]);

  return size;
}
