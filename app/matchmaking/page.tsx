"use client";

import { useEffect, useRef, useState } from "react";
import { TIME_CONTROLS, DEFAULT_TIME_CONTROL_ID } from "@/content/timeControls";

/**
 * The speeds offered for random matchmaking at launch.
 *
 * A deliberate subset of TIME_CONTROLS. Every speed is its own queue, so
 * offering all seven would split an already small player base into seven thin
 * pools and make matches slower and worse for everyone. Friend invites still
 * offer the full set, where fragmentation does not apply because both players
 * are already agreed.
 *
 * Bullet is absent on purpose — see 0035 and scripts/test-online-clocks.js.
 */
const LAUNCH_CONTROLS = ["3+0", "5+0", "10+0", "15+10"];
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  findOrCreateMatch,
  supportsTimeControlMatchmaking,
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
  // The speed the player wants. Only offered when the server can honour it
  // (migration 0035); a picker that is silently ignored is worse than none.
  const [timeControlId, setTimeControlId] = useState<string>(DEFAULT_TIME_CONTROL_ID);
  const [canPickSpeed, setCanPickSpeed] = useState(false);
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

      void supportsTimeControlMatchmaking(supabase)
        .then((ok) => setCanPickSpeed(ok))
        .catch(() => setCanPickSpeed(false));

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
      result = await findOrCreateMatch(supabase, childId, rating, timeControlId);
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
              We&apos;ll find you the closest-rated opponent available, anywhere in the world.
            </p>

            {canPickSpeed && (
              <div className="w-full flex flex-col gap-3">
                {(["Blitz", "Rapid"] as const).map((category) => (
                  <div key={category} className="flex flex-col gap-2">
                    <p className={`${TEXT.meta} text-premium-gold`}>{category}</p>
                    <div
                      role="radiogroup"
                      aria-label={`${category} time controls`}
                      className="grid grid-cols-3 gap-2"
                    >
                      {TIME_CONTROLS.filter(
                        (t) => t.description === category && LAUNCH_CONTROLS.includes(t.id)
                      ).map((t) => {
                        const active = t.id === timeControlId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setTimeControlId(t.id)}
                            className={`min-h-[48px] rounded-premiumBtn border px-2 font-classic-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 ${
                              active
                                ? "border-premium-gold bg-premium-gold/15 text-premium-ivory"
                                : "border-white/12 bg-premium-navy/70 text-premium-ivory/75 hover:border-premium-gold/30"
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className={TEXT.caption}>
                  You are only matched with players who chose the same time control.
                </p>
              </div>
            )}

            <Button tone="premium" size="lg" onClick={findOpponent}>
              Find Opponent →
            </Button>
          </>
        )}

        {view.status === "searching" && (
          <>
            <p className={`${TEXT.body} animate-pulse`}>
              Searching for an opponent
              {canPickSpeed ? ` at ${TIME_CONTROLS.find((t) => t.id === timeControlId)?.label ?? ""}` : ""}
              ...
            </p>
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
        className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
      >
        Back to Home
      </Link>

      {showPaywall && <GameLimitPaywall gameType="multiplayer" onDismiss={() => setShowPaywall(false)} />}
    </main>
  );
}
