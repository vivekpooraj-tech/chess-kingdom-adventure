"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const LAYOUT_VERSION = "2";

/**
 * Android WebViews often report a CSS width below Tailwind's `md` (768px),
 * especially in portrait on 10" tablets — so media queries alone miss the
 * tablet layout. This sets `data-layout` + `is-phone` / `is-tablet` on
 * <html> from the real innerWidth, which our Tailwind variants read.
 */
function resolveLayout(width: number, height: number) {
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);

  // 10" tablets in portrait can land around 600–750 CSS px wide.
  if (shortEdge >= 600 || longEdge >= 900) {
    return width >= 1024 ? "desktop" : "tablet";
  }
  return "phone";
}

function applyLayout() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const layout = resolveLayout(width, height);
  const root = document.documentElement;

  root.dataset.layout = layout;
  root.dataset.native = Capacitor.isNativePlatform() ? "true" : "false";
  root.classList.toggle("is-phone", layout === "phone");
  root.classList.toggle("is-tablet", layout === "tablet" || layout === "desktop");
}

export function NativeLayoutProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyLayout();

    // One-time reload after a layout deploy so stale WebView HTML/JS isn't stuck.
    if (Capacitor.isNativePlatform()) {
      const key = "chessmind-layout-version";
      const previous = localStorage.getItem(key);
      if (previous !== LAYOUT_VERSION) {
        localStorage.setItem(key, LAYOUT_VERSION);
        window.location.reload();
        return;
      }
    }

    window.addEventListener("resize", applyLayout);
    window.addEventListener("orientationchange", applyLayout);
    return () => {
      window.removeEventListener("resize", applyLayout);
      window.removeEventListener("orientationchange", applyLayout);
    };
  }, []);

  return children;
}
