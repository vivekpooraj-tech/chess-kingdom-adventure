"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadProgress, saveProgress } from "./progressClient";
import { applyAttempt, initialProgress, levelToServe, type Attempt, type ProgressEvent, type ProgressState } from "./progression";
import type { Level } from "./curriculum";

const LOAD_TIMEOUT_MS = 3000;

export interface ProgressionHandle {
  /** True once progress for the active child has loaded (or failed/timed out → fresh state). */
  ready: boolean;
  state: ProgressState;
  /** Level to request from the server right now, honouring entitlement. */
  level: Level;
  /** Apply one finished attempt; returns what changed. Persists best-effort. */
  record: (attempt: Attempt) => ProgressEvent;
}

/**
 * Per-child, per-category progression. Fail-open like the exercise history: if
 * the read is slow or fails, the learner starts at Foundation for this session
 * rather than waiting.
 */
export function useProgression(
  childId: string | null,
  childResolved: boolean,
  moduleId: string,
  isPremium: boolean
): ProgressionHandle {
  const [state, setState] = useState<ProgressState>(initialProgress);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    const timeout = new Promise<ProgressState | null>((resolve) => setTimeout(() => resolve(null), LOAD_TIMEOUT_MS));
    Promise.race([loadProgress(createClient(), childId, moduleId), timeout]).then((loaded) => {
      if (cancelled) return;
      if (loaded) setState(loaded);
      setLoadedFor(childId);
    });
    return () => {
      cancelled = true;
    };
  }, [childId, moduleId]);

  const record = useCallback(
    (attempt: Attempt): ProgressEvent => {
      const { state: next, event } = applyAttempt(stateRef.current, attempt, isPremium);
      stateRef.current = next;
      setState(next);
      if (childId) void saveProgress(createClient(), childId, moduleId, next);
      return event;
    },
    [childId, moduleId, isPremium]
  );

  const ready = childResolved && (childId === null || loadedFor === childId);
  return { ready, state, level: levelToServe(state, isPremium), record };
}
