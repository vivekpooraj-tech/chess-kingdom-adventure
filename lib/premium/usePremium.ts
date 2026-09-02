"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FREE_STATE, type PremiumState } from "@/lib/premium/entitlement";

export interface PremiumEntitlementSummary {
  provider: string;
  amountMinor: number | null;
  currency: string | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  status: string;
}

export interface UsePremiumResult {
  state: PremiumState;
  entitlement: PremiumEntitlementSummary | null;
  loading: boolean;
  /** Re-reads server-authoritative status (GET /api/premium/status). */
  refresh: () => Promise<void>;
  /** Runs the DB re-derive + re-read (POST /api/premium/refresh) — the
   * "restore Premium" action. */
  restore: () => Promise<void>;
}

/**
 * Reads the parent account's Premium status from the server. Never derives
 * Premium from a URL param or localStorage — /api/premium/status is the only
 * source. Safe to call from any client component; components that already
 * have a server-fetched `isPremium` prop don't need this.
 */
export function usePremium(initial?: PremiumState): UsePremiumResult {
  const [state, setState] = useState<PremiumState>(initial ?? FREE_STATE);
  const [entitlement, setEntitlement] = useState<PremiumEntitlementSummary | null>(null);
  const [loading, setLoading] = useState(!initial);
  const alive = useRef(true);

  const load = useCallback(async (endpoint: "status" | "refresh") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/premium/${endpoint}`, {
        method: endpoint === "refresh" ? "POST" : "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!alive.current || !data || typeof data.isPremium !== "boolean") return;
      // Both endpoints return an already-resolved PremiumState.
      setState({
        isPremium: data.isPremium,
        expiresAt: data.expiresAt ?? null,
        isExpired: !!data.isExpired,
        daysRemaining: data.daysRemaining ?? null,
      });
      if ("entitlement" in data) setEntitlement(data.entitlement ?? null);
    } catch {
      // keep whatever we had
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!initial) load("status");
    return () => {
      alive.current = false;
    };
  }, [initial, load]);

  return {
    state,
    entitlement,
    loading,
    refresh: () => load("status"),
    restore: () => load("refresh"),
  };
}
