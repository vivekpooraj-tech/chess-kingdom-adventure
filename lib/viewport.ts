export type ViewportMetrics = {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  visualViewportWidth: number | null;
  visualViewportHeight: number | null;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: "portrait" | "landscape";
};

/**
 * Reliable viewport dimensions for layout math. Android WebViews on tablets
 * often report a phone-sized innerWidth — fall back to physical screen size
 * when html.is-tablet is set and inner dims look wrong. Prefer visualViewport
 * when available (keyboard / WebView chrome adjustments).
 */
export function getViewportMetrics(): ViewportMetrics {
  if (typeof window === "undefined") {
    return {
      width: 390,
      height: 844,
      innerWidth: 390,
      innerHeight: 844,
      visualViewportWidth: null,
      visualViewportHeight: null,
      screenWidth: 390,
      screenHeight: 844,
      devicePixelRatio: 1,
      orientation: "portrait",
    };
  }

  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;
  const vv = window.visualViewport;
  const visualViewportWidth = vv?.width ?? null;
  const visualViewportHeight = vv?.height ?? null;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  let width = visualViewportWidth ?? innerWidth;
  let height = visualViewportHeight ?? innerHeight;

  const isTablet = document.documentElement.classList.contains("is-tablet");
  if (isTablet) {
    const portrait = width <= height;
    const logicalW = portrait ? Math.min(screenWidth, screenHeight) : Math.max(screenWidth, screenHeight);
    const logicalH = portrait ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight);

    if (Math.max(width, height) < Math.max(logicalW, logicalH) * 0.85) {
      width = logicalW;
      height = logicalH;
    }
  }

  return {
    width,
    height,
    innerWidth,
    innerHeight,
    visualViewportWidth,
    visualViewportHeight,
    screenWidth,
    screenHeight,
    devicePixelRatio: window.devicePixelRatio,
    orientation: width > height ? "landscape" : "portrait",
  };
}

/** @deprecated use getViewportMetrics().width/height */
export function getViewportSize(): { width: number; height: number } {
  const m = getViewportMetrics();
  return { width: m.width, height: m.height };
}

/** @deprecated use isChessFocusSideBySide from computeBoardSize */
export function isArenaSideBySide(width: number, height: number): boolean {
  return width > height && width >= 480;
}
