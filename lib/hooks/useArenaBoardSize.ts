"use client";

import { useEffect, useState } from "react";
import {
  computeChessFocusBoardSize,
  isChessFocusSideBySide,
  CHESS_FOCUS_SIDE_PANEL_WIDTH,
} from "@/lib/chessFocus/computeBoardSize";
import { getViewportMetrics } from "@/lib/viewport";

/**
 * @deprecated Prefer ChessFocusLayout, which measures chrome in the DOM.
 * Kept for pages not yet migrated to ChessFocusLayout.
 */
export function useArenaBoardSize(reservedHeight: number = 220): number {
  const [size, setSize] = useState(480);

  useEffect(() => {
    function compute() {
      const metrics = getViewportMetrics();
      const sideBySide = isChessFocusSideBySide(metrics.width, metrics.height);
      const next = computeChessFocusBoardSize({
        viewportWidth: metrics.width,
        viewportHeight: metrics.height,
        boardColumnChromeHeight: reservedHeight,
        stackedPanelHeight: sideBySide ? 0 : reservedHeight * 0.45,
        isSideBySide: sideBySide,
        sidePanelWidth: CHESS_FOCUS_SIDE_PANEL_WIDTH,
      });
      setSize(next);
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
  }, [reservedHeight]);

  return size;
}
