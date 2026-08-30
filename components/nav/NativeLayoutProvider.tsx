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
      // One-time reload after an app update bumps LAYOUT_VERSION, so the new
      // layout rules take effect without the user relaunching. Guarded hard
      // against a reload loop: if localStorage doesn't actually persist in
      // this WebView (some devices drop it on force-stop), an unguarded
      // check would reload on every single launch — and every reload is
      // another full cold-start auth round trip. sessionStorage survives a
      // reload but not an app restart, so this reloads at most once per
      // launch, and only if we can confirm the write stuck.
      try {
        const versionKey = "chessmind-layout-version";
        const reloadGuardKey = "chessmind-layout-reloaded";
        const previous = localStorage.getItem(versionKey);
        if (previous !== LAYOUT_VERSION && !sessionStorage.getItem(reloadGuardKey)) {
          localStorage.setItem(versionKey, LAYOUT_VERSION);
          sessionStorage.setItem(reloadGuardKey, "1");
          if (localStorage.getItem(versionKey) === LAYOUT_VERSION) {
            window.location.reload();
            return;
          }
        }
      } catch {
        // localStorage/sessionStorage unavailable — skip the reload
        // entirely rather than risk a loop.
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
