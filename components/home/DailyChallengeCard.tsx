"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, localDateString } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { getDailyChallenge, DailyChallengeState } from "@/lib/supabase/dailyChallengeQueries";

/**
 * Self-contained (resolves its own active child, same pattern as
 * InviteFriendButton) so it drops into any already-auth-gated page —
 * currently Kingdom Map and Play — without those pages needing to thread a
 * child id down. Fetches this child's personalized Daily Challenge via the
 * get_daily_challenge RPC (supabase/migrations/0025_daily_challenge_progression.sql)
 * instead of the old dayOfYear-rotation getDailyPuzzle(), which is gone.
 */
export function DailyChallengeCard() {
  const [state, setState] = useState<DailyChallengeState | "loading" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        // getVerifiedUser() reads the already-verified session locally
        // instead of getUser()'s network round trip to Supabase's Auth
        // server, and retries once on a transient failure — this card is
        // purely supplementary display (see the catch below), not a
        // security boundary; every real data read is still enforced by RLS
        // regardless of what the client believes its identity is.
        const user = await getVerifiedUser(supabase);
        if (!user) {
          if (!cancelled) setState("unavailable");
          return;
        }
        const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        if (resolution.needsSelection || !resolution.child) {
          if (!cancelled) setState("unavailable");
          return;
        }
        const challenge = await getDailyChallenge(supabase, resolution.child.id, localDateString());
        if (!cancelled) setState(challenge);
      } catch {
        // Quietly hide the card rather than interrupt a page that already
        // handled its own auth gate — this is a small supplementary card,
        // not the page's primary content.
        if (!cancelled) setState("unavailable");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div
        className="w-full max-w-md rounded-premiumCard bg-premium-ivory/50 p-5 h-[76px] animate-pulse"
        aria-hidden="true"
      />
    );
  }
  if (state === "unavailable") return null;

  const solved = state.result === "solved";

  return (
    <Link
      href={`/puzzles?id=${state.puzzleId}&daily=1`}
      className="w-full max-w-md rounded-premiumCard bg-premium-ivory p-5 flex items-center gap-4 shadow-premiumCard border border-premium-gold/20 active:scale-[0.98] transition-transform duration-100"
    >
      <div className="w-12 h-12 rounded-full bg-premium-midnight flex items-center justify-center text-xl flex-none">
        {solved ? "✓" : "♟️"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-classic-body text-[10px] uppercase tracking-wider text-premium-goldMuted font-semibold">
          Daily Challenge
        </p>
        <p className="font-classic-display text-base text-premium-midnight truncate">
          {solved ? "Complete for today" : `♟ Checkmate in ${state.mateIn}`}
        </p>
        <p className="font-classic-body text-xs text-premium-midnight/60 truncate">{state.theme}</p>
      </div>
      <span className="font-classic-body text-xs font-semibold text-premium-midnight border border-premium-midnight/30 rounded-full px-3 py-1.5 flex-none">
        {solved ? "Review →" : "Solve →"}
      </span>
    </Link>
  );
}
