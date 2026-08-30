"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

// Bump when the layout classification rules change so installed WebViews
// re-run them once on next launch instead of waiting for a manual relaunch.
const LAYOUT_VERSION = "6";

// A device is a tablet only when its SHORT physical edge is tablet-sized —
// Android's own `sw600dp` convention. The previous rule also flagged any
// device whose LONG edge was >= 900, which swept in essentially every modern
// tall phone (Pixel/Galaxy/Motorola 20:9 screens, iPhone Pro Max) and applied
// the tablet layout inside a ~400px viewport. Short-edge only: a phone is
// never >= ~430px on its short edge, a real 7"+ tablet always is.
const TABLET_MIN_SHORT_EDGE = 600;
// Desktop split is viewport-driven (a resizable window), not device-driven.
const DESKTOP_MIN_WIDTH = 1024;

type Layout = "phone" | "tablet" | "desktop";

function resolveLayout(): Layout {
  const shortEdge = Math.min(window.screen.width, window.screen.height);
  if (shortEdge < TABLET_MIN_SHORT_EDGE) return "phone";
  return window.innerWidth >= DESKTOP_MIN_WIDTH ? "desktop" : "tablet";
}

function applyLayout() {
  const layout = resolveLayout();
  const root = document.documentElement;

  root.dataset.layout = layout;
  root.dataset.native = Capacitor.isNativePlatform() ? "true" : "false";
  // is-phone / is-tablet are kept ONLY for: native board-sizing math
  // (lib/viewport.ts) and a few navigation cosmetics. They must NOT gate
  // grid columns or content width — CSS (container/auto-fit grids, clamp)
  // owns layout responsiveness now.
  root.classList.toggle("is-phone", layout === "phone");
  root.classList.toggle("is-tablet", layout !== "phone");
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

    // The phone/tablet decision is screen-based and never changes for a
    // device, so it doesn't need a listener. Only the tablet<->desktop
    // split can change at runtime (a resized window), and only when the
    // 1024px threshold is actually crossed — a matchMedia listener fires
    // exactly then, instead of doing work on every resize frame.
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const onChange = () => applyLayout();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return children;
}
