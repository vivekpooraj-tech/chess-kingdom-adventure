"use client";

import { useCallback, useEffect, useState } from "react";
import { usePremium } from "@/lib/premium/usePremium";
import { createClient } from "@/lib/supabase/client";
import { dailyLimitFor, isDailyLimitReached, remainingToday } from "@/lib/entitlement";
import { getTrainYourMindUsage, recordTrainYourMindCompletion, type CompletionOutcome } from "./dailyUsage";
import type { TrainModule } from "./dailyLimitRules";

export interface TrainYourMindDailyLimit {
  /** True until Premium status is known — callers should not show a locked state while this
   * is true, so a Premium child never flashes a "limit reached" card. */
  loading: boolean;
  isPremium: boolean;
  /** Completed exercises today IN THIS CATEGORY (the server's count). */
  usedToday: number;
  /** null means unlimited (Premium). */
  limit: number | null;
  remaining: number | null;
  /** FREE and every slot used today in this category. Never true for Premium. */
  reached: boolean;
  /**
   * Record that the learner completed one exercise in this category. Sends the completion
   * to the server, which refuses a 4th free one, and adopts the server's authoritative
   * count. Resolves with the outcome (null if the server could not be reached — the learner
   * is then not blocked). The same `key` sent twice counts once.
   */
  recordCompletion: (key: string, exerciseId?: string) => Promise<CompletionOutcome | null>;
  /** Adopt a limit state learned elsewhere (e.g. the serve route said it is reached). */
  markReached: () => void;
}

/**
 * Train Your Mind's free daily limit for ONE category — 3 completed exercises per child per
 * day in that category (each of the eight categories has its own 3), unlimited on Premium.
 *
 * The count lives in the database (migration 0055), not in React state or browser storage:
 * refreshing, opening another browser, or using another device cannot reset it. The state
 * held here is only a mirror of what the server last said.
 */
export function useTrainYourMindDailyLimit(childId: string | null, moduleId: TrainModule): TrainYourMindDailyLimit {
  const { state, loading: premiumLoading } = usePremium();
  const [usedToday, setUsedToday] = useState(0);
  const [serverPremium, setServerPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    getTrainYourMindUsage(createClient(), childId, moduleId).then((snap) => {
      if (cancelled || !snap) return;
      setUsedToday(snap.usedToday);
      setServerPremium(snap.isPremium);
    });
    return () => {
      cancelled = true;
    };
  }, [childId, moduleId]);

  const isPremium = serverPremium ?? state.isPremium;
  const limit = dailyLimitFor("trainYourMindPerCategory", isPremium);
  const reached = !!childId && !premiumLoading && isDailyLimitReached(usedToday, limit);

  const recordCompletion = useCallback(
    async (key: string, exerciseId?: string) => {
      if (!childId) return null;
      const outcome = await recordTrainYourMindCompletion(createClient(), childId, moduleId, key, exerciseId);
      if (outcome) {
        setUsedToday(outcome.usedToday);
        setServerPremium(outcome.isPremium);
      }
      return outcome;
    },
    [childId, moduleId]
  );

  const markReached = useCallback(() => {
    setUsedToday((n) => Math.max(n, dailyLimitFor("trainYourMindPerCategory", false) ?? 3));
  }, []);

  return {
    loading: premiumLoading,
    isPremium,
    usedToday,
    limit,
    remaining: remainingToday(usedToday, limit),
    reached,
    recordCompletion,
    markReached,
  };
}
