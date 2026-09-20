"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODE, MODE_STORAGE_KEY, isModeId, type ModeId } from "./modes";

/**
 * Read and change the active presentation mode.
 *
 * Deliberately a hook over `<html data-mode>` + localStorage, mirroring
 * lib/theme/useTheme.ts exactly — a React context would put every mode-aware
 * subtree into one re-render on change and would need to wrap the whole app;
 * here the DOM attribute IS the state, CSS does the repaint, and only the
 * settings UI subscribes.
 *
 * PERSISTENCE (Phase 1): localStorage, per-device — the same mechanism as
 * theme, and for the same reason (zero schema risk, no extra query on every
 * navigation, no hydration flash while a DB value loads). This is a
 * DELIBERATE, EXPLICITLY-FLAGGED LIMITATION, not an oversight: mode
 * conceptually belongs to a child (like board_skin_id/piece_set_id, which
 * ARE persisted server-side via updateChildBoardSkin/updateChildPieceSet in
 * lib/supabase/queries.ts), so it will not follow a child across devices
 * until a `children.mode_id` column is added in a future phase. That is a
 * genuine schema change and was deliberately deferred rather than made
 * unilaterally here — see the Phase 1 report for the explicit recommendation.
 *
 * Initial state matches the server render (the default) and is corrected in
 * an effect, exactly as useTheme does — safe because the pre-hydration
 * ModeBootstrapScript has already applied the real mode to <html>, so what
 * the user SEES is correct from the first paint; this only syncs React's copy
 * for the settings UI.
 */
export function useMode() {
  const [mode, setModeState] = useState<ModeId>(DEFAULT_MODE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (isModeId(stored)) setModeState(stored);
    } catch {
      /* storage unavailable — stay on the default */
    }
  }, []);

  const setMode = useCallback((next: ModeId) => {
    const root = document.documentElement;

    // Brief, scoped transition, independent of theme's own
    // cm-theme-switching class — see app/modes.css.
    root.classList.add("cm-mode-switching");
    window.setTimeout(() => root.classList.remove("cm-mode-switching"), 260);

    if (next === DEFAULT_MODE) root.removeAttribute("data-mode");
    else root.setAttribute("data-mode", next);

    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the mode still applies for this session */
    }
    setModeState(next);
  }, []);

  return { mode, setMode };
}
