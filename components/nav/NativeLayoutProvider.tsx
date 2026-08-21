"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const LAYOUT_VERSION = "5";

/**
 * Classify tablet vs phone from physical screen size — Android WebViews often
 * report a narrow innerWidth (phone-like) even on 10" tablets, which is why
 * media queries and innerWidth checks kept showing the mobile layout.
 */
function resolveLayout() {
  const screenShort = Math.min(window.screen.width, window.screen.height);
  const screenLong = Math.max(window.screen.width, window.screen.height);
  const viewWidth = window.innerWidth;

  if (screenShort >= 600 || screenLong >= 900) {
    return viewWidth >= 1024 ? "desktop" : "tablet";
  }
  return "phone";
}

function applyLayout() {
  const layout = resolveLayout();
  const root = document.documentElement;

  root.dataset.layout = layout;
  root.dataset.native = Capacitor.isNativePlatform() ? "true" : "false";
  root.classList.toggle("is-phone", layout === "phone");
  root.classList.toggle("is-tablet", layout === "tablet" || layout === "desktop");
}

export function NativeLayoutProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyLayout();

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
