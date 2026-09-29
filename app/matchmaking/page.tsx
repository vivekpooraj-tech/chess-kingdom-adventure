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
  getMatchmakingQueueStatus,
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
  // Guards against navigating twice when the immediate check, the Realtime
  // event, and the bounded fallback poll (see findOpponent) could all
  // independently resolve to the same match.
  const hasNavigatedRef = useRef(false);
  // Live handles for the two things findOpponent() starts, so cancelSearch()
  // and the unmount cleanup below can tear them down without needing their
  // own copies — a single 5s interval and a single channel, never more than
  // one of either at a time.
  const fallbackIntervalRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

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
  // stay matchable after giving up on this screen. Also stops the fallback
  // poll and drops the Realtime channel — nothing from this search should
  // keep running once the screen is gone.
  useEffect(() => {
    return () => {
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
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
    hasNavigatedRef.current = false;

    // Single atomic guard shared by all three detection paths below — first
    // one to find a match wins, the other two become no-ops. Also the one
    // place that tears down the fallback timer and the Realtime channel, so
    // neither keeps running past a successful navigation.
    const navigateToMatch = (gameId: string) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      router.push(`/online/${gameId}`);
    };

    // 1. IMMEDIATE CHECK — closes the startup race without depending on the
    // Realtime channel ever reaching SUBSCRIBED. Another player's own
    // find_or_create_match call can claim our queue row in the time between
    // our RPC call returning and this line running; this reads our row's
    // current, authoritative state directly, before any Realtime channel
    // even exists yet.
    try {
      const immediate = await getMatchmakingQueueStatus(supabase, childId);
      if (immediate?.status === "matched" && immediate.matchedGameId) {
        navigateToMatch(immediate.matchedGameId);
        return;
      }
    } catch {
      // Realtime and the bounded fallback below still cover us either way.
    }

    // 2. REALTIME — the primary, low-latency path once matched. Same
    // channel/filter/event shape as before; not redesigned.
    const channel = supabase
      .channel(`matchmaking_${childId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matchmaking_queue",
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          const row = payload.new as { status: string; matched_game_id: string | null };
          if (row.status === "matched" && row.matched_game_id) {
            navigateToMatch(row.matched_game_id);
          }
        }
      )
      .subscribe((status) => {
        // CHANNEL_ERROR / TIMED_OUT / CLOSED are deliberately not handled
        // with a reconnect here — the bounded fallback below is the
        // recovery path for a connection that degrades or silently stops
        // delivering, confirmed necessary by a real two-device production
        // test where a live, previously-open subscription never delivered
        // an UPDATE that arrived ~15s after it connected. Nothing to do
        // here but not throw.
        void status;
      });
    channelRef.current = channel;

    // 3. BOUNDED FALLBACK — a single 5s interval, purely a backstop for a
    // delayed/disconnected/silently-missed Realtime event. Not unbounded
    // polling: it always stops itself the moment a match is found (via
    // navigateToMatch's own teardown), the search is cancelled
    // (cancelSearch), or the component unmounts (the cleanup effect above)
    // — never more than one interval alive at a time.
    fallbackIntervalRef.current = window.setInterval(() => {
      getMatchmakingQueueStatus(supabase, childId)
        .then((row) => {
          if (row?.status === "matched" && row.matchedGameId) {
            navigateToMatch(row.matchedGameId);
          }
        })
        .catch(() => {
          // A transient failure here isn't fatal — Realtime or the next
          // tick still cover us.
        });
    }, 5000);
  }

  async function cancelSearch() {
    if (view.status !== "searching" || !childIdRef.current) return;
    if (fallbackIntervalRef.current) {
      window.clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    const supabase = createClient();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
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
