"use client";

import { useEffect, useState } from "react";
import { usePremium } from "@/lib/premium/usePremium";
import { createClient } from "@/lib/supabase/client";
import { dailyLimitFor, isDailyLimitReached, remainingToday } from "@/lib/entitlement";
import { getTrainYourMindUsageToday, recordTrainYourMindUse } from "./dailyUsage";

export interface TrainYourMindDailyLimit {
  /** True until Premium status is known — callers should not show a locked
   * state while this is true, to avoid a free-looking flash of "limit
   * reached" for a Premium child on a slow connection. */
  loading: boolean;
  isPremium: boolean;
  usedToday: number;
  /** null means unlimited (Premium). */
  limit: number | null;
  remaining: number | null;
  reached: boolean;
  /** Call once per completed activity — records the use server-side
   * (Phase 5) and syncs local state with the server's authoritative
   * response. Public interface unchanged from Phase 4; internals now talk
   * to supabase/migrations/0044_train_your_mind_daily_usage.sql's RPC
   * instead of localStorage. */
  recordUse: () => void;
}

/**
 * Train Your Mind's free daily limit — 3 activities per category per day,
 * unlimited on Premium. The limit itself is still configured in
 * lib/entitlement/dailyLimits.ts (unchanged); the actual enforcement is now
 * server-side (Phase 5) via record_train_your_mind_use(), not a client-side
 * localStorage count (Phase 4) — a child can no longer reset their count by
 * clearing site data, switching browsers, or switching devices.
 */
export function useTrainYourMindDailyLimit(
  childId: string | null,
  moduleId: string
): TrainYourMindDailyLimit {
  const { state, loading: premiumLoading } = usePremium();
  const [usedToday, setUsedToday] = useState(0);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    getTrainYourMindUsageToday(createClient(), childId, moduleId).then((count) => {
      if (!cancelled) setUsedToday(count);
    });
    return () => {
      cancelled = true;
    };
  }, [childId, moduleId]);

  const limit = dailyLimitFor("trainYourMindPerCategory", state.isPremium);
  const reached = !!childId && !premiumLoading && isDailyLimitReached(usedToday, limit);

  function recordUse() {
    if (!childId) return;
    // Optimistic bump for instant feedback; recordTrainYourMindUse() below
    // corrects it to the server's authoritative count a moment later (e.g.
    // if another device already used up today's quota).
    setUsedToday((n) => n + 1);
    recordTrainYourMindUse(createClient(), childId, moduleId).then((result) => {
      setUsedToday(result.usedToday);
    });
  }

  return {
    loading: premiumLoading,
    isPremium: state.isPremium,
    usedToday,
    limit,
    remaining: remainingToday(usedToday, limit),
    reached,
    recordUse,
  };
}
