"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChildCached, localDateString } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { getDailyChallenge, DailyChallengeState } from "@/lib/supabase/dailyChallengeQueries";

// Module-level (not component state) so it survives unmount/remount --
// this card renders on both Home and Play, and before the persistent tab
// shell fix, EVERY navigation between them re-ran the full session ->
// active-child -> daily-challenge chain from zero, even when nothing had
// changed. A short TTL keeps it feeling live (e.g. after actually solving
// the puzzle and coming back) without repeating the same 3 network calls
// on every Home<->Play flip within a few seconds. Deliberately a plain
// module variable, not a new caching dependency -- this data is small,
// single-purpose, and doesn't need React Query's invalidation machinery.
const CACHE_TTL_MS = 30_000;
let cache: { date: string; state: DailyChallengeState | "unavailable"; fetchedAt: number } | null = null;

interface DailyChallengeCardProps {
  /**
   * Pass this when the parent already resolved the active child server-side
   * (Kingdom Map does, right before rendering this card) -- skips the
   * client session + resolveActiveChild round trip entirely instead of
   * re-deriving information the page already has. Omit it (Play, which has
   * no server-side data fetching of its own) to fall back to the card's
   * own client-side resolution, which still benefits from
   * resolveActiveChildCached() if another client component in the same tab
   * resolved this user's active child recently.
   */
  childId?: string;
}

/**
 * Self-contained by default (resolves its own active child, same pattern as
 * InviteFriendButton) so it drops into any already-auth-gated page —
 * currently Kingdom Map and Play — without those pages needing to thread a
 * child id down, unless they already have one to give it (see childId
 * above). Fetches this child's personalized Daily Challenge via the
 * get_daily_challenge RPC (supabase/migrations/0025_daily_challenge_progression.sql)
 * instead of the old dayOfYear-rotation getDailyPuzzle(), which is gone.
 */
export function DailyChallengeCard({ childId }: DailyChallengeCardProps = {}) {
  const today = localDateString();
  const cached = cache && cache.date === today && Date.now() - cache.fetchedAt < CACHE_TTL_MS ? cache : null;
  const [state, setState] = useState<DailyChallengeState | "loading" | "unavailable">(cached?.state ?? "loading");

  useEffect(() => {
    if (cached) return; // fresh enough -- skip the round trip entirely
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();

        let resolvedChildId = childId;
        if (!resolvedChildId) {
          // getVerifiedUser() reads the already-verified session locally
          // instead of getUser()'s network round trip to Supabase's Auth
          // server, and retries once on a transient failure — this card is
          // purely supplementary display (see the catch below), not a
          // security boundary; every real data read is still enforced by
          // RLS regardless of what the client believes its identity is.
          const user = await getVerifiedUser(supabase);
          if (!user) {
            if (!cancelled) setState("unavailable");
            return;
          }
          const resolution = await resolveActiveChildCached(supabase, user.id, getActiveChildIdClient());
          if (resolution.needsSelection || !resolution.child) {
            if (!cancelled) setState("unavailable");
            return;
          }
          resolvedChildId = resolution.child.id;
        }

        const challenge = await getDailyChallenge(supabase, resolvedChildId, today);
        cache = { date: today, state: challenge, fetchedAt: Date.now() };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") {
    return (
      <div
        className="w-full rounded-premiumCard bg-premium-ivory/50 p-5 h-[76px] animate-pulse"
        aria-hidden="true"
      />
    );
  }
  if (state === "unavailable") return null;

  const solved = state.result === "solved";

  return (
    <Link
      href={`/puzzles?id=${state.puzzleId}&daily=1`}
      className="w-full h-full rounded-premiumCard bg-premium-ivory p-5 flex items-center gap-4 shadow-premiumCard border border-premium-gold/20 active:scale-[0.98] transition-transform duration-100"
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
