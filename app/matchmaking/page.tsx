"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  findOrCreateMatch,
  cancelMatchmaking,
  getFreeGameStatus,
  hasRatingHistory,
  FreeGameStatus,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { TEXT } from "@/lib/designSystem";

type ViewState =
  | { status: "loading" }
  | { status: "idle"; rating: number }
  | { status: "searching"; rating: number }
  | { status: "error"; rating: number; message: string };

export default function MatchmakingPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [gameStatus, setGameStatus] = useState<FreeGameStatus | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isFirstTimer, setIsFirstTimer] = useState(false);
  const childIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      childIdRef.current = child.id;

      const [status, hasHistory] = await Promise.all([
        getFreeGameStatus(supabase, child.id),
        hasRatingHistory(supabase, child.id).catch(() => true),
      ]);
      setGameStatus(status);
      setIsFirstTimer(!hasHistory);
      setView({ status: "idle", rating: child.rating });
    }
    load();
  }, [router]);

  // Leave the queue if the child navigates away mid-search, so they don't
  // stay matchable after giving up on this screen.
  useEffect(() => {
    return () => {
      if (view.status === "searching" && childIdRef.current) {
        const supabase = createClient();
        cancelMatchmaking(supabase, childIdRef.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.status]);

  async function findOpponent() {
    if (view.status !== "idle" || !childIdRef.current) return;
    const rating = view.rating;
    const childId = childIdRef.current;

    // find_or_create_match itself checks free-multiplayer eligibility
    // BEFORE joining the queue or creating anything (see
    // supabase/migrations/0019_daily_free_game_limits.sql) — this call is
    // the "before creating/joining a match" check, not a separate step.
    const supabase = createClient();
    let result;
    try {
      result = await findOrCreateMatch(supabase, childId, rating);
    } catch (err) {
      setView({ status: "error", rating, message: "Couldn't start matchmaking — please try again." });
      return;
    }

    if (result.blocked) {
      const fresh = await getFreeGameStatus(supabase, childId);
      setGameStatus(fresh);
      setShowPaywall(true);
      return;
    }

    if (result.matched && result.gameId) {
      router.push(`/online/${result.gameId}`);
      return;
    }

    setView({ status: "searching", rating });

    // Not matched yet — wait for someone else's find_or_create_match call
    // to claim our queue row (see the migration for why this is race-safe).
    const channel = supabase
      .channel(`matchmaking_${childIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matchmaking_queue",
          filter: `child_id=eq.${childIdRef.current}`,
        },
        (payload) => {
          const row = payload.new as { status: string; matched_game_id: string | null };
          if (row.status === "matched" && row.matched_game_id) {
            supabase.removeChannel(channel);
            router.push(`/online/${row.matched_game_id}`);
          }
        }
      )
      .subscribe();
  }

  async function cancelSearch() {
    if (view.status !== "searching" || !childIdRef.current) return;
    const supabase = createClient();
    await cancelMatchmaking(supabase, childIdRef.current).catch(() => {});
    setView({ status: "idle", rating: view.rating });
  }

  if (view.status === "loading") {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className={`${TEXT.display} text-center`}>Play Someone New</h1>

      <PrimaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-1">
          <p className={TEXT.caption}>Your Rating</p>
          <p className="font-classic-display text-3xl text-premium-gold">{view.rating.toLocaleString()}</p>
          {isFirstTimer && (
            <p className={`${TEXT.caption} normal-case mt-1 max-w-[220px]`}>
              You're starting at 400. Win games to climb the ratings.
            </p>
          )}
        </div>

        {gameStatus && !gameStatus.isPremium && (
          <div className="flex flex-col items-center gap-0.5">
            <p className={TEXT.caption}>Multiplayer</p>
            <p className={TEXT.body}>{gameStatus.mpRemaining} of 2 free games remaining today</p>
          </div>
        )}

        {view.status === "idle" && (
          <>
            <p className={TEXT.body}>
              We'll find you the closest-rated opponent available, anywhere in the world.
            </p>
            <Button tone="premium" size="lg" onClick={findOpponent}>
              Find Opponent →
            </Button>
          </>
        )}

        {view.status === "searching" && (
          <>
            <p className={`${TEXT.body} animate-pulse`}>Searching for an opponent...</p>
            <Button tone="premium" variant="ghost" onClick={cancelSearch}>
              Cancel Search
            </Button>
          </>
        )}

        {view.status === "error" && (
          <p className="font-classic-body text-sm text-red-300">{view.message}</p>
        )}
      </PrimaryCard>

      <p className={`${TEXT.caption} normal-case max-w-sm text-center`}>
        These games are with players you don't know, so chat and emoji reactions are
        turned off here to keep things safe.
      </p>

      <Link
        href="/kingdom-map"
        className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
      >
        Back to Home
      </Link>

      {showPaywall && <GameLimitPaywall gameType="multiplayer" onDismiss={() => setShowPaywall(false)} />}
    </main>
  );
}
