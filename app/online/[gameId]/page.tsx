"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getOnlineGame,
  joinOnlineGame,
  claimTimeout,
  createInviteGame,
  sendReaction,
  applyMatchRating,
  recordOpeningEncounter,
  markGameClientReady,
  abandonMatchedGame,
  OnlineGame,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { QUICK_CHAT_PHRASES, EMOJI_REACTIONS, DRAW_OFFER_PREFIX } from "@/content/quickChat";
import { ChessBoard } from "@/components/board/ChessBoard";
import {
  INITIAL as REMATCH_INITIAL,
  reduce as rematchReduce,
  shouldCreateGame,
  isRematchCreator,
  describe as describeRematch,
  OFFER_TTL_MS,
  type RematchContext,
} from "@/lib/online/rematch";
import { GameArenaLayout } from "@/components/game/GameArenaLayout";
import { PlayerCard } from "@/components/game/PlayerCard";
import { WorldArenaChrome } from "@/components/world/WorldArenaChrome";
import { readSelectedLocation } from "@/lib/world/passport";
import type { WorldLocationId } from "@/lib/world/locations";
import { LiveChessClock } from "@/components/game/ChessClock";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OpeningBadge } from "@/components/game/OpeningBadge";
import { MoveList } from "@/components/game/MoveList";
import { GameEndOpeningSummary } from "@/components/game/GameEndOpeningSummary";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { PostGameAnalysis } from "@/components/game/analysis/PostGameAnalysis";
import { playMoveSound } from "@/lib/sound/moveSound";
import { buildOnlineGameRecord } from "@/lib/analysis/gameRecord";
import { recognizeOpening, OpeningMatch } from "@/lib/openings/recognitionEngine";
import { TEXT } from "@/lib/designSystem";
import { getTimeControl } from "@/content/timeControls";
import { Chess } from "chess.js";
import type { Color, Square } from "chess.js";

/**
 * Numeric-only rating result — no skill labels (Beginner/Intermediate/
 * etc.) anywhere in this app's rating display. Shows the server-calculated
 * before/after values from apply_match_rating() exactly as computed, e.g.
 * "1,247 -> 1,271" with a "+24"/"-28" delta line underneath.
 */
function RatingDeltaRow({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before;
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="font-classic-body text-[11px] uppercase tracking-wide text-premium-ivory/50">{label}</p>
      <p className="font-classic-display text-lg text-premium-ivory">
        {before.toLocaleString()} <span className="text-premium-ivory/40">→</span> {after.toLocaleString()}
      </p>
      <p className={`font-classic-body text-sm font-semibold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-300" : "text-premium-ivory/60"}`}>
        {deltaText}
      </p>
    </div>
  );
}


/**
 * Ask the server to finish this game.
 *
 * The client sends an INTENT and never a winner. The server replays the stored
 * moves with chess.js and decides the result itself, so a browser cannot
 * declare a checkmate that did not happen or pick who won. See
 * app/api/online/[gameId]/complete/route.ts.
 */
async function requestCompletion(
  gameId: string,
  intent: "resign" | "claim_result" | "accept_draw"
): Promise<void> {
  try {
    await fetch(`/api/online/${gameId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent }),
    });
  } catch {
    // The Realtime subscription still carries the result if the server settled
    // it; a failed request must not wedge the board.
  }
}

// A game row only ever moves forward: waiting/matched → active → finished,
// and moves are append-only. Rows reach this page from Realtime, polls,
// RPC responses and post-action refetches, which can resolve in any order —
// anything older than what is already on screen must be dropped, or a late
// response can undo an opponent's move or put a started game back on the
// "Waiting for opponent" screen.
const STATUS_RANK: Record<OnlineGame["status"], number> = { waiting: 0, matched: 0, active: 1, finished: 2 };

function isOlderRow(current: OnlineGame | null | "loading", next: OnlineGame): boolean {
  if (!current || current === "loading" || current.id !== next.id) return false;
  const rankDiff = STATUS_RANK[next.status] - STATUS_RANK[current.status];
  if (rankDiff !== 0) return rankDiff < 0;
  return next.moves.length < current.moves.length;
}

export default function OnlineGamePage() {
  const params = useParams<{ gameId: string }>();
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  /* The player's live rating, taken straight off the child row resolveActiveChild
   * already fetched — children.rating IS the current rating. The game row's
   * host_rating_before/guest_rating_before are null for the whole game (verified
   * on live active games); apply_match_rating only fills them once the result
   * settles, so they are a post-game record, not a live value.
   *
   * No opponent equivalent exists: the children table's only RLS policy is
   * "parent can manage own children", so the opponent's row is invisible to this
   * session and there is no RPC that exposes it. Rather than show a wrong or
   * invented number, the opponent card simply carries no rating. */
  const [myRating, setMyRating] = useState<number | null>(null);

  /*
   * Chess Mind World — decorative only.
   *
   * The location is the per-device choice the player already made on the World
   * hub (passport's selected location). Free Play takes it from `?world=`
   * because it is entered through playHereHref; an online game arrives from an
   * invite link or from matchmaking, so there is no URL of ours to carry it.
   * Reusing the stored choice means no new storage, no new registry and no new
   * URL contract.
   *
   * It is read once, on the client, and never leaves this component: it is not
   * sent to the server, not part of game state, and not a dependency of any
   * effect that moves, clocks, rates or settles a game. readSelectedLocation()
   * validates against the registry and returns null for anything unknown, so a
   * stale or hand-edited id renders no World rather than a broken one.
   */
  const [worldLocationId, setWorldLocationId] = useState<WorldLocationId | null>(null);
  useEffect(() => {
    setWorldLocationId(readSelectedLocation());
  }, []);
  const [game, setGame] = useState<OnlineGame | null | "loading">("loading");
  // The opponent's move that produced the CURRENT `game.fen`, passed to
  // ChessBoard so it can animate that move instead of jumping straight to
  // the new position — set only for a genuine opponent move (see the
  // Realtime handler below, same condition already used for the move
  // sound), never for our own move's server echo. Purely visual; ChessBoard
  // itself verifies it against the authoritative fen before trusting it.
  const [remoteMove, setRemoteMove] = useState<{ from: Square; to: Square; promotion?: string } | null>(
    null
  );
  const [openingMatch, setOpeningMatch] = useState<OpeningMatch | null>(null);
  const [dismissedOpeningId, setDismissedOpeningId] = useState<string | null>(null);
  const seenOpeningIdsRef = useRef<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());
  const [joinBlocked, setJoinBlocked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // "matched" (random-match ready-gate) waiting screen: the cancel option is
  // deliberately withheld for a bit — showing it immediately would read as
  // "this is already broken" for the normal case where the opponent's client
  // is simply a couple of seconds behind. No polling: a single bounded
  // setTimeout, cleared on unmount/status change.
  const [showAbandonOption, setShowAbandonOption] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  // Rematch lives entirely in an ephemeral Realtime broadcast on the channel
  // this page already opens for moves — no extra subscription, no new table.
  const [rematch, setRematch] = useState<RematchContext>(REMATCH_INITIAL);
  const rematchRef = useRef<RematchContext>(REMATCH_INITIAL);
  rematchRef.current = rematch;
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);
  // Fallback sync. Realtime is still the primary path for every row change;
  // the poll only fetches while the channel isn't live (a fresh socket's
  // join can lag tens of seconds behind page load) or while the ready gate
  // is still open, so a missed UPDATE can't strand this client.
  const syncPollRef = useRef<number | null>(null);
  const channelLiveRef = useRef(false);
  const readyRetryUsedRef = useRef(false);
  const readyChildIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  // The specific draw-offer token (see DRAW_OFFER_PREFIX) the local player
  // has already dismissed — each offer is uniquely timestamped, so a new
  // offer after a declined one always compares as different and reappears.
  const [dismissedDrawOffer, setDismissedDrawOffer] = useState<string | null>(null);
  // Both refs exist solely so the postgres_changes handler below (a stable
  // closure created once per params.gameId, never re-subscribed on every
  // render) can read the LATEST game/color without adding them as effect
  // deps — same pattern already used by rematchRef above. Needed to tell an
  // opponent's move apart from the server's own echo of our move (which
  // fires this same UPDATE event) without inventing any new realtime
  // mechanism: it's the identical row data submit_online_move already
  // writes, just kept fresh for imperative use inside the handler.
  const gameRef = useRef<OnlineGame | null | "loading">(game);
  gameRef.current = game;
  const myColorRef = useRef<Color | null>(null);

  // Every server row goes through here instead of a bare setGame.
  function applyFreshGame(next: OnlineGame | null) {
    setGame((current) => (next && isOlderRow(current, next) ? current : next));
  }

  // Load the current child + initial game state, then subscribe to live
  // updates (the opponent's moves and reactions arrive this way).
  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;
    readyRetryUsedRef.current = false;
    channelLiveRef.current = false;

    // The single entry point for a server row from Realtime, polling or the
    // SUBSCRIBED catch-up. gameRef is advanced immediately (not on the next
    // render) so two rows landing in the same tick — e.g. a poll response and
    // the Realtime UPDATE for the same move — are compared against each
    // other, and the opponent's move is sounded/animated exactly once.
    const applyServerRow = (next: OnlineGame) => {
      const prev = gameRef.current;
      if (isOlderRow(prev, next)) return;
      // A move was added to the row (moves.length grew). The mover is
      // whoever's turn it was BEFORE this update — i.e. the opposite of
      // next.current_turn, which already flips after every accepted
      // move. If that mover isn't us, this is the opponent's move
      // arriving — the one case ChessBoard's own applyMove() can never
      // see, since it only re-keys off a new `fen` prop rather than
      // running the move through chess.js locally. Skipped for our own
      // move's server echo (already sounded locally, optimistically, at
      // the moment we made it) to avoid a duplicate.
      if (
        prev &&
        prev !== "loading" &&
        prev.id === next.id &&
        next.moves.length > prev.moves.length &&
        myColorRef.current
      ) {
        const moverColor: Color = next.current_turn === "w" ? "b" : "w";
        if (moverColor !== myColorRef.current) {
          // Priority: checkmate > capture > normal move. Both signals
          // read directly off the server-generated SAN already stored
          // in game.moves — standard chess notation appends "#" for a
          // checkmating move and "x" for a capture — the same
          // authoritative string the move list/opening recognizer
          // already trust, not a new inference.
          const lastSan = next.moves[next.moves.length - 1];
          playMoveSound(
            lastSan.includes("#") ? "checkmate" : lastSan.includes("x") ? "capture" : "move"
          );
          // Same authoritative data the sound above already trusts —
          // replay the known-good SAN from the position we had before
          // this update to recover the from/to/promotion ChessBoard
          // needs to animate this move, rather than inventing anything.
          // Only a single-ply gap can be replayed from prev.fen; a larger
          // jump (several missed updates) just snaps to the new position.
          // A replay failure here only costs the animation (ChessBoard
          // falls back to its normal instant-jump); it can never affect
          // game state, which `next` (server-authoritative) already is.
          try {
            const replay = new Chess(prev.fen);
            const result = next.moves.length === prev.moves.length + 1 ? replay.move(lastSan) : null;
            setRemoteMove(
              result
                ? { from: result.from as Square, to: result.to as Square, promotion: result.promotion }
                : null
            );
          } catch {
            setRemoteMove(null);
          }
        } else {
          // This is the server echo of our OWN move — already animated
          // optimistically the moment we made it, and never re-animated
          // from a remoteMove that would now be stale.
          setRemoteMove(null);
        }
      }
      gameRef.current = next;
      applyFreshGame(next);
    };

    const fetchAndApply = async () => {
      const row = await getOnlineGame(supabase, params.gameId);
      if (!cancelled && row) applyServerRow(row);
      return row;
    };

    // Deliberately not tied to the channel reaching SUBSCRIBED: on a fresh
    // Realtime socket the join can lag tens of seconds behind page load. Each
    // tick is a no-op (no request) while the channel is live and the game has
    // left the ready gate; it stops for good once the game is settled.
    const stopSyncPoll = () => {
      if (syncPollRef.current !== null) {
        window.clearInterval(syncPollRef.current);
        syncPollRef.current = null;
      }
    };
    syncPollRef.current = window.setInterval(() => {
      const current = gameRef.current;
      if (cancelled || current === "loading") return;
      if (current && current.status === "finished") {
        // Keep listening without a live channel only until the rating
        // settlement (a later write) has landed on the row.
        if (channelLiveRef.current || current.match_type !== "random" || current.rating_applied) {
          stopSyncPoll();
          return;
        }
      }
      if (channelLiveRef.current && current && current.status !== "matched") return;
      fetchAndApply().catch(() => {
        // Next tick, or the Realtime listener, still covers this.
      });
    }, 3000);

    async function load() {
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
      if (cancelled) return;
      readyChildIdRef.current = resolution.child!.id;
      setChildId(resolution.child!.id);
      setBoardSkinId(resolution.child!.board_skin_id);
      setPieceSetId(resolution.child!.piece_set_id);
      setMyRating(typeof resolution.child!.rating === "number" ? resolution.child!.rating : null);

      const initial = await getOnlineGame(supabase, params.gameId);
      if (cancelled) return;
      if (initial) applyServerRow(initial);
      else applyFreshGame(null);

      // Random-match readiness gate (0048_random_match_ready_gate.sql):
      // signal that this client has the game screen open. A no-op on the
      // server for anything that isn't a match_type="random" game currently
      // status="matched" — safe to call unconditionally on every mount,
      // including a remount/reconnect. If this call is the second
      // participant's (both sides now ready), the RPC's own response already
      // carries the authoritative active state, so it's applied immediately
      // here rather than waiting on this client's own Realtime echo of the
      // change it just caused.
      if (initial && initial.match_type === "random" && initial.status === "matched") {
        try {
          const ready = await markGameClientReady(supabase, params.gameId, resolution.child!.id);
          if (cancelled) return;
          if (ready.status === "active") {
            setGame((prev) =>
              prev && prev !== "loading" && prev.status === "matched"
                ? {
                    ...prev,
                    status: "active",
                    started_at: ready.startedAt,
                    last_move_at: ready.lastMoveAt,
                    white_time_ms: ready.whiteTimeMs,
                    black_time_ms: ready.blackTimeMs,
                    current_turn: ready.currentTurn,
                  }
                : prev
            );
          }
        } catch {
          // Never break the page over this — the sync poll above, the
          // Realtime subscription below, and a later remount all give the
          // ready signal another chance to land.
        }
      }
    }
    load();

    const channel = supabase
      .channel(`online_game_${params.gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "online_games",
          filter: `id=eq.${params.gameId}`,
        },
        (payload) => {
          const next = payload.new as Partial<OnlineGame>;
          // An UPDATE can omit large unchanged columns (moves/fen are
          // TOASTed once a game gets long); never render a partial row.
          if (!Array.isArray(next.moves) || typeof next.fen !== "string") {
            fetchAndApply().catch(() => {});
            return;
          }
          applyServerRow(next as OnlineGame);
        }
      )
      // Same channel, so this costs no additional Realtime connection.
      .on("broadcast", { event: "rematch" }, ({ payload }) => {
        const kind = payload?.kind;
        if (kind === "offer") setRematch((c) => rematchReduce(c, { type: "OFFER_REMOTE" }));
        else if (kind === "decline") setRematch((c) => rematchReduce(c, { type: "DECLINE_REMOTE" }));
        else if (kind === "created" && typeof payload?.gameId === "string") {
          setRematch((c) => rematchReduce(c, { type: "CREATED", gameId: payload.gameId }));
        }
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status !== "SUBSCRIBED") {
          // CHANNEL_ERROR / TIMED_OUT / CLOSED: Realtime will rejoin on its
          // own; the sync poll covers whatever is missed until it does.
          channelLiveRef.current = false;
          return;
        }
        channelLiveRef.current = true;
        // Fires on the first join and again after every reconnect — the
        // moments an UPDATE sent while the channel wasn't joined is lost.
        void (async () => {
          try {
            const fresh = await fetchAndApply();
            if (cancelled || !fresh || fresh.match_type !== "random" || fresh.status !== "matched") return;

            // One extra ready signal, not a loop. The mount-time call can
            // fail silently; this covers that without repeating on every tick.
            if (!readyRetryUsedRef.current && readyChildIdRef.current) {
              readyRetryUsedRef.current = true;
              const ready = await markGameClientReady(supabase, params.gameId, readyChildIdRef.current);
              if (!cancelled && ready.status !== "matched") await fetchAndApply();
            }
          } catch {
            // The sync poll still observes a later row.
          }
        })();
      });
    channelRef.current = channel;

    return () => {
      cancelled = true;
      channelLiveRef.current = false;
      stopSyncPoll();
      supabase.removeChannel(channel);
    };
  }, [params.gameId, router]);

  // Bounded wait before offering to abandon a random match stuck in
  // "matched" (opponent's client hasn't signalled ready yet). One timer, not
  // a poll: it doesn't re-check anything, it just reveals a button after a
  // fixed delay. Resets whenever the game leaves "matched" (becomes active,
  // or this effect re-runs on a fresh "matched" game after a rematch).
  useEffect(() => {
    setShowAbandonOption(false);
    if (game === "loading" || !game || game.match_type !== "random" || game.status !== "matched") {
      return;
    }
    const id = window.setTimeout(() => setShowAbandonOption(true), 20_000);
    return () => window.clearTimeout(id);
  }, [game === "loading" || !game ? null : game.status, game === "loading" || !game ? null : game.match_type]);

  // A random match the OTHER player abandoned pre-start (abandon_matched_game,
  // 0048_random_match_ready_gate.sql) arrives here as status="finished" with
  // winner=null and started_at=null — a combination that can only mean "this
  // never started," since every real result (checkmate, resignation, timeout)
  // sets a winner, and every game whose clock ever ran has a non-null
  // started_at. The normal finished-game screen has no concept of a
  // null-winner result and would otherwise read as a loss. Redirect instead of
  // rendering it, exactly the same way handleAbandonMatched already does for
  // the player who triggered the abandon.
  useEffect(() => {
    if (
      game !== "loading" &&
      game &&
      game.match_type === "random" &&
      game.status === "finished" &&
      game.winner === null &&
      game.started_at === null
    ) {
      router.push("/kingdom-map");
    }
  }, [game, router]);

  // Navigate once the rematch game exists. Both sides run this; whoever is
  // told first simply goes.
  useEffect(() => {
    if (rematch.state === "ready" && rematch.newGameId) {
      router.push(`/online/${rematch.newGameId}`);
    }
  }, [rematch.state, rematch.newGameId, router]);

  // An unanswered offer expires, so a stale one cannot commit someone minutes
  // later to a game they have forgotten about.
  useEffect(() => {
    if (rematch.state !== "offered" && rematch.state !== "received") return;
    const t = window.setTimeout(
      () => setRematch((c) => rematchReduce(c, { type: "EXPIRE" })),
      OFFER_TTL_MS
    );
    return () => window.clearTimeout(t);
  }, [rematch.state]);

  // Only the player who just had Black creates the game, and only once. That
  // single rule is what makes two simultaneous clicks produce one game.
  useEffect(() => {
    const g = game !== "loading" && game ? game : null;
    if (!g || !childId) return;
    const isHost = g.host_child_id === childId;
    const myColor: "w" | "b" = isHost ? g.host_color : g.host_color === "w" ? "b" : "w";
    if (!shouldCreateGame(rematchRef.current, isRematchCreator(myColor))) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    (async () => {
      try {
        const result = await createInviteGame(
          supabaseRef.current,
          childId,
          g.time_control ?? "10+0"
        );
        if (!result.id) {
          creatingRef.current = false;
          setRematch((c) => rematchReduce(c, { type: "DECLINE_LOCAL" }));
          return;
        }
        channelRef.current?.send({
          type: "broadcast",
          event: "rematch",
          payload: { kind: "created", gameId: result.id },
        });
        setRematch((c) => rematchReduce(c, { type: "CREATED", gameId: result.id! }));
      } catch {
        creatingRef.current = false;
        setRematch((c) => rematchReduce(c, { type: "DECLINE_LOCAL" }));
      }
    })();
  }, [rematch.state, game, childId]);

  function offerRematch() {
    channelRef.current?.send({
      type: "broadcast",
      event: "rematch",
      payload: { kind: "offer" },
    });
    setRematch((c) => rematchReduce(c, { type: "OFFER_LOCAL" }));
  }

  function declineRematch() {
    channelRef.current?.send({
      type: "broadcast",
      event: "rematch",
      payload: { kind: "decline" },
    });
    setRematch((c) => rematchReduce(c, { type: "DECLINE_LOCAL" }));
  }

  // Opening recognition reads game.moves (synced from the DB, appended to by
  // whichever player made each move) rather than ChessBoard's own history —
  // see submitOnlineMove's doc comment for why that's necessary here.
  useEffect(() => {
    if (!game || game === "loading" || !childId) return;
    const match = recognizeOpening(game.moves);
    if (match && match.opening.id !== dismissedOpeningId) {
      setOpeningMatch(match);
    } else if (!match) {
      setOpeningMatch(null);
    }
    if (match && !seenOpeningIdsRef.current.has(match.opening.id)) {
      seenOpeningIdsRef.current.add(match.opening.id);
      recordOpeningEncounter(supabaseRef.current, childId, match.opening.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, childId]);

  // Enforces timeouts against opponents who stop responding — polls the
  // server, which independently re-derives whether time has genuinely run
  // out from its own clock (clock_timestamp() in claim_timeout) before
  // acting, so this poll can't be used to force a false timeout.
  useEffect(() => {
    if (game === "loading" || !game || game.status !== "active" || !game.time_control || !childId) return;
    const id = setInterval(async () => {
      const result = await claimTimeout(supabaseRef.current, params.gameId, childId);
      if (result.status === "finished") {
        const fresh = await getOnlineGame(supabaseRef.current, params.gameId);
        applyFreshGame(fresh);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [game, childId, params.gameId]);

  if (game === "loading" || !childId) {
    return <main className="min-h-screen" />;
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">🔍</span>
          <p className={TEXT.body}>
            This game link isn't valid, or the game no longer exists.
          </p>
          <Link href="/kingdom-map">
            <Button tone="premium">Back to the Kingdom Map →</Button>
          </Link>
        </SecondaryCard>
      </main>
    );
  }

  const isHost = game.host_child_id === childId;
  const isGuest = game.guest_child_id === childId;
  const canJoin = !isHost && !isGuest && game.status === "waiting" && !game.guest_child_id;

  async function handleJoin() {
    const supabase = supabaseRef.current;
    const result = await joinOnlineGame(supabase, params.gameId, childId!);
    if (result.blocked) {
      // Either the host or the guest has used their 2 free multiplayer
      // games today — see supabase/migrations/0019_daily_free_game_limits.sql.
      // Nothing was created; stay on this screen and show the paywall.
      setJoinBlocked(true);
      return;
    }
    // Either joined successfully, or someone else claimed the guest slot
    // first — either way, refetch to show reality.
    const fresh = await getOnlineGame(supabase, params.gameId);
    applyFreshGame(fresh);
  }

  async function handleAbandonMatched() {
    if (!childId || abandoning) return;
    setAbandoning(true);
    try {
      await abandonMatchedGame(supabaseRef.current, params.gameId, childId);
      // No winner is recorded for an abandoned pre-start match, so there's
      // nothing meaningful for the "finished" screen to show — leave for
      // Home rather than rendering a null-result game-over state.
      router.push("/kingdom-map");
    } catch {
      setAbandoning(false);
    }
  }

  /**
   * Send the move INTENT only.
   *
   * The board's own fen/san are not sent and are not authoritative: the server
   * replays the stored history, validates from/to itself, and generates the
   * official SAN and FEN. Previously those client values were written straight
   * into the row, so a browser could store any position it liked.
   *
   * expectedPly is optimistic concurrency — a double-click, a retry or a second
   * tab acting on a stale board is refused rather than applied to a position
   * the player was not actually looking at.
   *
   * If the server rejects (illegal, not your turn, stale), the authoritative
   * state arrives over the existing Realtime subscription and the board
   * re-syncs from it; nothing local is treated as truth.
   */
  async function handleMove(from: string, to: string) {
    const current = game !== "loading" && game ? game.moves.length : undefined;
    try {
      const res = await fetch(`/api/online/${params.gameId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, expectedPly: current }),
      });
      if (!res.ok) {
        // Re-sync from the server rather than leaving a rejected move on screen.
        const fresh = await getOnlineGame(supabaseRef.current, params.gameId);
        if (fresh) applyFreshGame(fresh);
        return;
      }
      // Take the server's accepted position now instead of waiting for our
      // own Realtime echo. On a slow link the opponent's reply can arrive
      // first, and the board can only animate it from the position that
      // includes our move. The echo still lands afterwards with exact clock
      // values; only a row exactly one ply ahead of what's shown is merged.
      const body = await res.json().catch(() => null);
      if (body?.ok && typeof body.fen === "string" && typeof body.san === "string" && typeof body.plies === "number") {
        setGame((prev) => {
          if (!prev || prev === "loading" || prev.moves.length !== body.plies - 1) return prev;
          return {
            ...prev,
            fen: body.fen,
            moves: [...prev.moves, body.san],
            current_turn: body.turn,
            white_time_ms: typeof body.whiteTimeMs === "number" ? body.whiteTimeMs : prev.white_time_ms,
            black_time_ms: typeof body.blackTimeMs === "number" ? body.blackTimeMs : prev.black_time_ms,
            last_move_at: new Date().toISOString(),
          };
        });
      }
    } catch {
      const fresh = await getOnlineGame(supabaseRef.current, params.gameId).catch(() => null);
      if (fresh) applyFreshGame(fresh);
    }
  }

  async function handleGameOver(result: { isCheckmate: boolean; isDraw: boolean; winner: Color | null }) {
    const winner = result.isDraw ? "draw" : result.winner;
    if (winner) {
      // The board's own verdict is only a prompt: the server replays the moves
      // and decides for itself whether this really is mate or a draw.
      await requestCompletion(params.gameId, "claim_result");
      if (game && game !== "loading" && game.match_type === "random") {
        const supabase = supabaseRef.current;
        // Idempotent server-side (rating_applied) — safe even if the
        // opponent's client gets there first. Whichever call actually does
        // the work persists before/after values on the game row itself
        // (host_rating_before/after, guest_rating_before/after), so a
        // direct refetch here gets the real numbers for BOTH players
        // regardless of who triggered the settlement. The existing
        // Realtime subscription will also pick this row update up on its
        // own; this refetch just avoids waiting on that round trip.
        await applyMatchRating(supabase, params.gameId).catch(() => {});
        const fresh = await getOnlineGame(supabase, params.gameId);
        if (fresh) applyFreshGame(fresh);
      }
    }
  }

  async function handleReaction(text: string) {
    await sendReaction(supabaseRef.current, params.gameId, isHost, text);
  }

  // --- Random match found, waiting for both clients to be ready ---
  // (0048_random_match_ready_gate.sql) — invite/tournament games never have
  // status="matched" at all, so this only ever renders for match_type="random".
  // No ticking clock here on purpose: the clock genuinely hasn't started yet.
  if (game.status === "matched") {
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl animate-floaty">⏳</span>
          <h1 className={TEXT.heading}>Waiting for opponent to load...</h1>
          <p className={TEXT.caption}>The clock starts the moment you're both here.</p>
          {showAbandonOption && (
            <Button tone="premium" variant="ghost" onClick={handleAbandonMatched} disabled={abandoning}>
              {abandoning ? "Leaving..." : "This is taking a while — Leave"}
            </Button>
          )}
        </SecondaryCard>
      </main>
    );
  }

  // --- Waiting for a friend (host's view) ---
  if (game.status === "waiting" && isHost) {
    const inviteUrl = typeof window !== "undefined" ? window.location.href : "";
    const hostTimeControl = game.time_control ? getTimeControl(game.time_control) : null;
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl animate-floaty">⏳</span>
          <h1 className={TEXT.heading}>Waiting for a friend to join!</h1>
          {hostTimeControl && (
            <p className={TEXT.caption}>
              Time Control: <span className="text-premium-ivory">{hostTimeControl.label}</span> ({hostTimeControl.description})
            </p>
          )}
          <p className={TEXT.caption}>Share this link with them:</p>
          <input
            readOnly
            value={inviteUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            aria-label="Invite link"
            className="w-full text-center text-sm rounded-premiumBtn px-3 py-2 border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body"
          />
          <Button
            tone="premium"
            variant="ghost"
            onClick={() => navigator.clipboard?.writeText(inviteUrl)}
          >
            Copy Link
          </Button>
        </SecondaryCard>
      </main>
    );
  }

  // --- Someone else's open game, not yet joined ---
  if (canJoin) {
    const joinTimeControl = game.time_control ? getTimeControl(game.time_control) : null;
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">⚔️</span>
          <h1 className={TEXT.heading}>You've been challenged to a game!</h1>
          {joinTimeControl && (
            <p className={TEXT.caption}>
              Time Control: <span className="text-premium-ivory">{joinTimeControl.label}</span> ({joinTimeControl.description})
            </p>
          )}
          {joinBlocked ? (
            <>
              <p className={TEXT.body}>Your 2 free multiplayer games for today are used.</p>
              <Button tone="premium" onClick={() => setShowPaywall(true)}>
                Unlock Unlimited Play
              </Button>
            </>
          ) : (
            <Button tone="premium" onClick={handleJoin}>Accept Game →</Button>
          )}
        </SecondaryCard>
        {showPaywall && <GameLimitPaywall gameType="multiplayer" onDismiss={() => setShowPaywall(false)} />}
      </main>
    );
  }

  // A pre-start abandon (see the redirect effect above) — render nothing
  // while that effect's router.push takes effect, rather than flashing the
  // normal finished-game screen for a result that was never played.
  if (
    game.match_type === "random" &&
    game.status === "finished" &&
    game.winner === null &&
    game.started_at === null
  ) {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  // --- Finished ---
  if (game.status === "finished") {
    const myColor: Color = isHost ? game.host_color : game.host_color === "w" ? "b" : "w";
    const iWon = game.winner === myColor;
    const isDraw = game.winner === "draw";

    // Game Review — reuses PostGameAnalysis (no second review
    // implementation). Online games only persist the SAN list, so
    // buildOnlineGameRecord replays it to recover per-move positions.
    if (showReview) {
      const backHref = game.tournament_id ? `/play/tournaments/${game.tournament_id}` : "/kingdom-map";
      return (
        <PostGameAnalysis
          record={buildOnlineGameRecord({
            sanMoves: game.moves,
            playerColor: myColor,
            winner: game.winner,
            opponentLabel: game.match_type === "random" ? "Online Opponent" : "Friend Match",
            openingName: openingMatch?.opening.name ?? null,
            startedAt: game.last_move_at ?? new Date().toISOString(),
            endedAt: game.last_move_at ?? new Date().toISOString(),
          })}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
          childId={childId}
          source="online"
          onPlayAgain={() => router.push("/play")}
          onBack={() => router.push(backHref)}
        />
      );
    }
    // A clock reaching exactly 0 only ever happens via submit_online_move's
    // or claim_timeout's timeout branch (finish_online_game_by_result, used
    // for checkmate/draw, never touches the clock columns) — so this is a
    // real, server-derived signal, not a guess, and needs no schema change.
    const expiredColor: "w" | "b" | null =
      game.time_control && !isDraw
        ? game.white_time_ms === 0
          ? "w"
          : game.black_time_ms === 0
          ? "b"
          : null
        : null;
    const isTimeout = expiredColor !== null;
    const reasonText = isTimeout
      ? expiredColor === myColor
        ? "You ran out of time."
        : "Your opponent ran out of time."
      : null;
    const myRatingBefore = isHost ? game.host_rating_before : game.guest_rating_before;
    const myRatingAfter = isHost ? game.host_rating_after : game.guest_rating_after;
    const opponentRatingBefore = isHost ? game.guest_rating_before : game.host_rating_before;
    const opponentRatingAfter = isHost ? game.guest_rating_after : game.host_rating_after;
    // typeof-number, not `!== null`: if this code ever runs against a
    // database that hasn't had the rating-columns migration applied yet,
    // select("*") simply omits those keys and they come back `undefined`
    // rather than `null` — `undefined !== null` is true, which would pass
    // the old check and then crash on `.toLocaleString()` below.
    const ratingSettled =
      game.match_type === "random" &&
      typeof myRatingBefore === "number" &&
      typeof myRatingAfter === "number" &&
      typeof opponentRatingBefore === "number" &&
      typeof opponentRatingAfter === "number";
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6">
        <PrimaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">{isDraw ? "🤝" : iWon ? "🏆" : "🤔"}</span>
          <h1 className={TEXT.heading}>
            {isDraw ? "It's a Draw!" : iWon ? "You Won!" : "Better Luck Next Time!"}
          </h1>
          {reasonText && <p className={TEXT.caption}>{reasonText}</p>}
          {ratingSettled && (
            <div className="w-full flex flex-col gap-3">
              <RatingDeltaRow label="You" before={myRatingBefore!} after={myRatingAfter!} />
              <RatingDeltaRow label="Opponent" before={opponentRatingBefore!} after={opponentRatingAfter!} />
            </div>
          )}
          {/* Rematch. Offering is also how you accept — an offer from both
              sides IS the agreement, which is why two simultaneous clicks
              cannot conflict. */}
          {game.match_type === "random" && (
            <div className="flex w-full flex-col gap-2">
              {rematch.state === "idle" && (
                <Button tone="premium" onClick={offerRematch}>
                  Rematch
                </Button>
              )}
              {rematch.state === "received" && (
                <div className="flex gap-2">
                  <Button tone="premium" onClick={offerRematch} className="flex-1">
                    Accept rematch
                  </Button>
                  <Button tone="premium" variant="ghost" onClick={declineRematch}>
                    Decline
                  </Button>
                </div>
              )}
              {(rematch.state === "offered" ||
                rematch.state === "agreed" ||
                rematch.state === "ready") && (
                <p className={TEXT.caption} role="status">
                  {describeRematch(rematch)}
                </p>
              )}
              {(rematch.state === "declined" || rematch.state === "expired") && (
                <>
                  <p className={TEXT.caption} role="status">
                    {describeRematch(rematch)}
                  </p>
                  <Button tone="premium" variant="ghost" onClick={offerRematch}>
                    Offer again
                  </Button>
                </>
              )}
            </div>
          )}

          {game.moves.length > 0 && (
            <Button tone="premium" onClick={() => setShowReview(true)}>
              Review Game →
            </Button>
          )}
          <Link href={game.tournament_id ? `/play/tournaments/${game.tournament_id}` : "/kingdom-map"}>
            <Button tone="premium" variant={game.moves.length > 0 ? "ghost" : "primary"}>
              {game.tournament_id ? "Back to Tournament →" : "Back to the Kingdom Map →"}
            </Button>
          </Link>

          {/* Where the game leads next. Until now the only way out of this
              screen was back to the map, which ended the improvement loop at
              exactly the moment there was something to learn from: the game
              became unreachable as soon as this screen was dismissed. */}
          <div className="flex w-full items-center justify-center gap-4 border-t border-white/10 pt-3">
            <Link
              href="/games"
              className="flex min-h-[44px] items-center font-classic-body text-sm text-premium-ivory/70 underline underline-offset-4"
            >
              Your games
            </Link>
            <Link
              href="/stats"
              className="flex min-h-[44px] items-center font-classic-body text-sm text-premium-ivory/70 underline underline-offset-4"
            >
              Your Chess
            </Link>
          </div>
        </PrimaryCard>

        {/* Only populated if this session was present for the live game —
            online_games' move history exists, but there's no way to
            recover which opening was played from a page load that lands
            directly on an already-finished game. */}
        {openingMatch && <GameEndOpeningSummary match={openingMatch} />}
      </main>
    );
  }

  // --- Active game ---
  if (game.status === "active" && (isHost || isGuest)) {
    const myColor: Color = isHost ? game.host_color : game.host_color === "w" ? "b" : "w";
    myColorRef.current = myColor;
    const myReactionRaw = isHost ? game.host_reaction : game.guest_reaction;
    const theirReactionRaw = isHost ? game.guest_reaction : game.host_reaction;
    // A draw offer rides the same reaction column (see DRAW_OFFER_PREFIX's
    // doc comment) but is an internal signal, not chat — never shown as a
    // plain reaction bubble.
    const myReaction = myReactionRaw && !myReactionRaw.startsWith(DRAW_OFFER_PREFIX) ? myReactionRaw : null;
    const theirReaction = theirReactionRaw && !theirReactionRaw.startsWith(DRAW_OFFER_PREFIX) ? theirReactionRaw : null;
    const pendingDrawOffer =
      theirReactionRaw &&
      theirReactionRaw.startsWith(DRAW_OFFER_PREFIX) &&
      theirReactionRaw !== dismissedDrawOffer
        ? theirReactionRaw
        : null;
    // Random-match and tournament opponents are strangers, not people the
    // child already knows via an invite link — no chat/emoji there,
    // matching the app's no-open-contact-with-strangers policy (see
    // docs/01-PRD.md). Group Tournament opponents get the same treatment
    // as Random Match for the same reason. Resign/draw stay available to
    // everyone regardless — those are game controls, not social contact.
    const showSocial = game.match_type !== "random" && game.match_type !== "tournament";
    const opponentColor: Color = myColor === "w" ? "b" : "w";
    const hasClock = game.time_control !== null && game.white_time_ms !== null && game.black_time_ms !== null;

    /* One clock description per side, built once and handed to BOTH the digits
     * and the progress bar. They are two views of the same server-authoritative
     * numbers, never two countdowns — see lib/game/useRemainingMs.ts. */
    const clockFor = (color: Color) =>
      hasClock
        ? {
            baseMs: (color === "w" ? game.white_time_ms : game.black_time_ms)!,
            lastSyncAt: game.last_move_at,
            isRunning: game.current_turn === color,
            gameActive: game.status === "active",
            totalMs: game.initial_time_ms,
          }
        : undefined;
    const myClock = clockFor(myColor);
    const opponentClock = clockFor(opponentColor);

    async function handleResign() {
      // No winner is sent: the server makes the OPPONENT of whoever resigned
      // the winner, so a resigning player cannot name themselves.
      await requestCompletion(params.gameId, "resign");
    }
    async function handleOfferDraw() {
      await sendReaction(supabaseRef.current, params.gameId, isHost, `${DRAW_OFFER_PREFIX}${Date.now()}`);
    }
    async function handleAcceptDraw() {
      await requestCompletion(params.gameId, "accept_draw");
    }

    const arenaTitle =
      game.match_type === "random"
        ? "Random Match"
        : game.match_type === "tournament"
        ? `Tournament — Round ${game.round_number}`
        : "Friend Match";

    return (
      <>
      <GameArenaLayout
        title={arenaTitle}
        /* Chess Mind World, full-bleed behind the arena — the same mount Free
         * Play uses, for the same reason: rendered inside the board slot the
         * scene was scoped to the board's own box and the opaque board covered
         * 83% of it. `boardMeta` is a free slot inside the shell; a fixed
         * child of it escapes to the viewport, and -z-10 keeps it above the
         * shell's background but below every piece of UI. Renders no space,
         * takes none, and the board's geometry is untouched. */
        boardMeta={
          worldLocationId ? <WorldArenaChrome locationId={worldLocationId} /> : undefined
        }
        onExit={() =>
          router.push(game.tournament_id ? `/play/tournaments/${game.tournament_id}` : "/kingdom-map")
        }
        opponentRow={
          <PlayerCard
            icon="⚔️"
            label="Opponent"
            isOpponent
            isActive={game.current_turn === opponentColor && game.status === "active"}
            clock={opponentClock}
          >
            <span className="flex items-center gap-2">
              {showSocial && theirReaction && (
                <span className="bg-premium-navy border border-premium-gold/20 rounded-full px-3 py-1 text-premium-ivory">
                  {theirReaction}
                </span>
              )}
              {opponentClock && <LiveChessClock {...opponentClock} />}
            </span>
          </PlayerCard>
        }
        playerRow={
          <PlayerCard
            icon="♟️"
            label={`You — ${myColor === "w" ? "White" : "Black"}`}
            rating={myRating}
            isActive={game.current_turn === myColor && game.status === "active"}
            clock={myClock}
          >
            {myClock && <LiveChessClock {...myClock} />}
          </PlayerCard>
        }
        renderBoard={(boardSize) => (
          /* `w-full` is load-bearing, not decoration. ChessBoard in focusMode is
             `min(size, 100%)`, so a shrink-to-fit wrapper makes the parent's
             width depend on the child while the child's 100% depends on the
             parent — the board collapsed to 101px at 1024x768. Giving the
             wrapper the column's width breaks the circularity, which is why
             Free Play's wrapper is w-full too. */
          <div className="relative w-full flex flex-col items-center">
            <ChessBoard
              fen={game.fen}
              playableColor={myColor}
              size={boardSize}
              focusMode
              boardSkinId={boardSkinId}
              pieceSetId={pieceSetId}
              onMove={(opts) => handleMove(opts.from, opts.to)}
              onGameOver={handleGameOver}
              remoteMove={remoteMove ?? undefined}
            />
          </div>
        )}
        sidePanel={
          <>
            {pendingDrawOffer && (
              <div className="rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-3 flex flex-col gap-2">
                <p className="font-classic-body text-sm text-premium-ivory">Your opponent offered a draw.</p>
                <div className="flex gap-2">
                  <Button tone="premium" size="md" className="flex-1" onClick={handleAcceptDraw}>
                    Accept
                  </Button>
                  <Button
                    tone="premium"
                    variant="ghost"
                    size="md"
                    className="flex-1"
                    onClick={() => setDismissedDrawOffer(pendingDrawOffer)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-premiumCard bg-premium-navy p-3 flex flex-col gap-2 shadow-premiumCard">
              {resignConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="font-classic-body text-sm text-premium-ivory">Resign this game?</p>
                  <div className="flex gap-2">
                    <Button
                      tone="premium"
                      variant="danger"
                      size="md"
                      className="flex-1"
                      onClick={handleResign}
                    >
                      Yes, Resign
                    </Button>
                    <Button
                      tone="premium"
                      variant="ghost"
                      size="md"
                      className="flex-1"
                      onClick={() => setResignConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    tone="premium"
                    variant="ghost"
                    size="md"
                    className="flex-1"
                    onClick={handleOfferDraw}
                  >
                    Offer Draw
                  </Button>
                  <Button
                    tone="premium"
                    variant="danger"
                    size="md"
                    className="flex-1"
                    onClick={() => setResignConfirm(true)}
                  >
                    Resign
                  </Button>
                </div>
              )}
            </div>

            {openingMatch && (
              <OpeningBadge
                match={openingMatch}
                onDismiss={() => {
                  setDismissedOpeningId(openingMatch.opening.id);
                  setOpeningMatch(null);
                }}
              />
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-premiumCard bg-premium-navy p-3 shadow-premiumCard">
              <p className="font-classic-body text-[11px] uppercase tracking-wide text-premium-ivory/40">
                Moves
              </p>
              <MoveList history={game.moves} />
            </div>

            {showSocial && (
              <div className="rounded-premiumCard bg-premium-navy p-3 flex flex-col gap-2 shadow-premiumCard">
                <div className="flex flex-wrap gap-2">
                  {EMOJI_REACTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleReaction(e)}
                      className="text-xl bg-premium-navyLight border border-white/10 rounded-full w-9 h-9 flex items-center justify-center hover:border-premium-gold/30 active:scale-90 transition-[border-color,transform] duration-100"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_CHAT_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      onClick={() => handleReaction(phrase)}
                      className="text-xs bg-premium-navyLight border border-white/10 text-premium-ivory/80 rounded-full px-3 py-1.5 font-classic-body hover:border-premium-gold/30 active:scale-95 transition-[border-color,transform] duration-100"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
                {myReaction && (
                  <p className={TEXT.caption}>You sent: {myReaction}</p>
                )}
              </div>
            )}
          </>
        }
      />
      </>
    );
  }

  return <main className="min-h-screen" />;
}
