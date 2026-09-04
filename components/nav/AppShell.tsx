"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isChessFocusActive, subscribeChessFocus } from "@/lib/chessFocus/focusMode";
import { isAppChromeRoute } from "./navConfig";
import { PrimaryNav } from "./PrimaryNav";
import { SideNav } from "./SideNav";
import { AppTopBar } from "./AppTopBar";

const COLLAPSE_KEY = "chessmind-sidenav-collapsed";

/**
 * The single persistent navigation frame for Chess Mind (UI-2A).
 *
 * Mounted once in the root layout, wrapping every route. It COMPOSES the
 * existing page-shell system — it never wraps a route in extra layout that
 * would change its geometry:
 *
 *  - Bare routes (auth, onboarding, welcome, splash, the full-screen game /
 *    lesson / customize screens) and any route while chess-focus mode is
 *    active  →  children pass straight through, untouched.
 *
 *  - App routes (the ~26 pages that previously each rendered their own
 *    <PrimaryNav/>)  →  wrapped in the responsive frame:
 *      phone   : children + bottom PrimaryNav               (unchanged)
 *      tablet  : sticky AppTopBar + children + bottom PrimaryNav
 *      desktop : fixed SideNav + sticky AppTopBar + children, NO bottom bar,
 *                content column inset by the sidebar width.
 *
 * Which of the three renders is decided ENTIRELY by CSS off
 * `html[data-layout]` (set pre-hydration by LayoutBootstrapScript) — this
 * component renders all the pieces and lets globals.css show the right
 * ones, so there is no first-paint flash and no SSR/CSR mismatch.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [focusActive, setFocusActive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Mirror focus mode (same source as the old TabShellNav).
  useEffect(() => {
    setFocusActive(isChessFocusActive());
    return subscribeChessFocus(() => setFocusActive(isChessFocusActive()));
  }, []);

  // Sidebar collapse preference. The pre-paint ShellBootstrapScript already
  // set `html[data-sidenav]` for a flash-free first paint; this just brings
  // it into React state so the toggle works.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* localStorage unavailable — stay expanded */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.sidenav = next ? "collapsed" : "expanded";
      return next;
    });
  }, []);

  const showChrome = isAppChromeRoute(pathname) && !focusActive;

  if (!showChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <SideNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="app-shell-content">
        <AppTopBar />
        {children}
      </div>
      <PrimaryNav />
    </>
  );
}
