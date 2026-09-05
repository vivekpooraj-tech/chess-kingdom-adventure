"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "./themes";

/**
 * Read and change the active theme.
 *
 * Deliberately a hook over `<html data-theme>` + localStorage rather than a
 * React context provider. A provider would put every themed subtree into one
 * re-render on change and would need to wrap the whole app; here the DOM
 * attribute IS the state, CSS does the repaint, and only the settings UI
 * subscribes. Nothing else in the app pays anything for theming.
 *
 * Initial state matches the server render (the default) and is corrected in an
 * effect. That is safe because the pre-hydration ThemeBootstrapScript has
 * already applied the real theme to <html>, so what the user SEES is correct
 * from the first paint — this only syncs React's copy for the settings UI.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(stored)) setThemeState(stored);
    } catch {
      /* storage unavailable — stay on the default */
    }
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    const root = document.documentElement;

    // Brief, scoped transition so the swap feels deliberate rather than a
    // jump-cut. Removed straight after so it never affects normal interaction.
    root.classList.add("cm-theme-switching");
    window.setTimeout(() => root.classList.remove("cm-theme-switching"), 260);

    if (next === DEFAULT_THEME) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the theme still applies for this session */
    }
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
