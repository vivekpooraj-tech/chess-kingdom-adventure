"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadExerciseHistory, recordExerciseSeen } from "./exerciseHistory";
import type { HistoryEntry } from "./exerciseSelection";

/** If the history read has not answered by then, start with no memory. */
const LOAD_TIMEOUT_MS = 3000;

export interface ExerciseHistoryHandle {
  /** True once the first exercise may be chosen: the active child is
   * resolved AND (their history loaded, failed, or timed out). */
  ready: boolean;
  /** Current history (persisted + everything shown this page session). */
  getHistory: () => HistoryEntry[];
  /** Call when an exercise is actually put in front of the child. Updates the
   * local history immediately and persists it best-effort. */
  remember: (exerciseId: string) => void;
}

/**
 * Per-child, per-module exercise history for a drill page.
 *
 * `childResolved` must flip to true once the page has finished resolving the
 * active child, whether or not one was found — so a signed-out / failed
 * lookup does not leave the drill waiting forever (fail open).
 */
export function useExerciseHistory(
  childId: string | null,
  childResolved: boolean,
  moduleId: string
): ExerciseHistoryHandle {
  const historyRef = useRef<HistoryEntry[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    const timeout = new Promise<HistoryEntry[]>((resolve) => setTimeout(() => resolve([]), LOAD_TIMEOUT_MS));
    Promise.race([loadExerciseHistory(createClient(), childId, moduleId), timeout]).then((loaded) => {
      if (cancelled) return;
      // Merge so anything remembered while the read was in flight is kept.
      const seen = new Map<string, number>();
      for (const h of [...loaded, ...historyRef.current]) {
        seen.set(h.exerciseId, Math.max(seen.get(h.exerciseId) ?? 0, h.lastSeenAt));
      }
      historyRef.current = [...seen].map(([exerciseId, lastSeenAt]) => ({ exerciseId, lastSeenAt }));
      setLoadedFor(childId);
    });
    return () => {
      cancelled = true;
    };
  }, [childId, moduleId]);

  const getHistory = useCallback(() => historyRef.current, []);

  const remember = useCallback(
    (exerciseId: string) => {
      const now = Date.now();
      historyRef.current = [
        { exerciseId, lastSeenAt: now },
        ...historyRef.current.filter((h) => h.exerciseId !== exerciseId),
      ];
      if (childId) recordExerciseSeen(createClient(), childId, moduleId, exerciseId);
    },
    [childId, moduleId]
  );

  const ready = childResolved && (childId === null || loadedFor === childId);
  return { ready, getHistory, remember };
}
