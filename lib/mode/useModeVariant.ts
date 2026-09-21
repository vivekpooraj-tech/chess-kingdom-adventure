"use client";

import { useMode } from "./useMode";
import type { ModeId } from "./modes";

/**
 * Generic hydration-safe "pick one of three, by mode" primitive.
 *
 * Extracted from the pattern components/home/OllieModeLine.tsx introduced
 * for Ollie's copy (Phase 2) so any future component — not just text —
 * can swap content by mode without re-deriving the hydration-safety
 * argument each time. Built directly on useMode(), the app's single
 * mode-detection mechanism (no second source of truth):
 *
 *   - useMode()'s own React state starts at DEFAULT_MODE ("classic-pro")
 *     and is corrected from localStorage in an effect after mount.
 *   - Server-rendered output therefore ALWAYS matches
 *     variants["classic-pro"] — the same value this hook returns on the
 *     client's first render, before the effect runs — so there is no
 *     hydration mismatch by construction, regardless of what `variants`
 *     contains.
 *   - Once the effect corrects the mode, this hook's return value updates
 *     to the real variant, exactly like OllieModeLine's own text swap.
 */
export function useModeVariant<T>(variants: Record<ModeId, T>): T {
  const { mode } = useMode();
  return variants[mode];
}
