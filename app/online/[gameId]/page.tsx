"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getOnlineGame,
  joinOnlineGame,
  submitOnlineMove,
  claimTimeout,
  finishOnlineGame,
  sendReaction,
  applyMatchRating,
  recordOpeningEncounter,
  OnlineGame,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { QUICK_CHAT_PHRASES, EMOJI_REACTIONS } from "@/content/quickChat";
import { ChessBoard } from "@/components/board/ChessBoard";
import { GameArenaLayout } from "@/components/game/GameArenaLayout";
import { ChessClock } from "@/components/game/ChessClock";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OpeningBadge } from "@/components/game/OpeningBadge";
import { GameEndOpeningSummary } from "@/components/game/GameEndOpeningSummary";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { recognizeOpening, OpeningMatch } from "@/lib/openings/recognitionEngine";
import { TEXT } from "@/lib/designSystem";
import { getTimeControl } from "@/content/timeControls";
import type { Color } from "chess.js";

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
      <p className="font-classic-body text-[10px] uppercase tracking-wide text-premium-ivory/50">{label}</p>
      <p className="font-classic-display text-lg text-premium-ivory">
        {before.toLocaleString()} <span className="text-premium-ivory/40">→</span> {after.toLocaleString()}
      </p>
      <p className={`font-classic-body text-sm font-semibold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-300" : "text-premium-ivory/60"}`}>
        {deltaText}
      </p>
    </div>
  );
}

export default function OnlineGamePage() {
  const params = useParams<{ gameId: string }>();
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [game, setGame] = useState<OnlineGame | null | "loading">("loading");
  const [openingMatch, setOpeningMatch] = useState<OpeningMatch | null>(null);
  const [dismissedOpeningId, setDismissedOpeningId] = useState<string | null>(null);
  const seenOpeningIdsRef = useRef<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());
  const [joinBlocked, setJoinBlocked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  // Locally-ticked DISPLAY ONLY values, re-derived from server-authoritative
  // state (game.white_time_ms/black_time_ms/last_move_at/current_turn) on
  // every render of the effect below — never the source of truth. The
  // server enforces timing via submit_online_move/claim_timeout regardless
  // of what these show.
  const [displayWhiteMs, setDisplayWhiteMs] = useState<number | null>(null);
  const [displayBlackMs, setDisplayBlackMs] = useState<number | null>(null);

  // Load the current child + initial game state, then subscribe to live
  // updates (the opponent's moves and reactions arrive this way).
  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      setChildId(resolution.child!.id);
      setBoardSkinId(resolution.child!.board_skin_id);
      setPieceSetId(resolution.child!.piece_set_id);

      const initial = await getOnlineGame(supabase, params.gameId);
      if (cancelled) return;
      setGame(initial);
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
          setGame(payload.new as OnlineGame);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [params.gameId, router]);

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

  // Local display countdown — re-anchored to the server's own numbers every
  // time `game` changes (a fresh Realtime UPDATE resets the effect below),
  // and ticked every 250ms in between purely for a smooth-looking clock.
  // Refreshing/closing the browser just re-runs this from the DB's current
  // state; nothing about actual remaining time lives in the client.
  useEffect(() => {
    if (game === "loading" || !game || !game.time_control) {
      setDisplayWhiteMs(null);
      setDisplayBlackMs(null);
      return;
    }
    function tick() {
      if (game === "loading" || !game) return;
      const elapsed = game.last_move_at ? Date.now() - new Date(game.last_move_at).getTime() : 0;
      let w = game.white_time_ms ?? 0;
      let b = game.black_time_ms ?? 0;
      if (game.status === "active") {
        if (game.current_turn === "w") w = Math.max(0, w - elapsed);
        else if (game.current_turn === "b") b = Math.max(0, b - elapsed);
      }
      setDisplayWhiteMs(w);
      setDisplayBlackMs(b);
    }
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game]);

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
        setGame(fresh);
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
    setGame(fresh);
  }

  async function handleMove(fen: string, san: string) {
    // If this rejects because the mover's own server-tracked clock had
    // already hit zero, the Realtime UPDATE from the server-side finish
    // (inside submit_online_move) will land momentarily and flip the view
    // to the "finished" branch below — no separate handling needed here.
    await submitOnlineMove(supabaseRef.current, params.gameId, childId!, fen, san);
  }

  async function handleGameOver(result: { isCheckmate: boolean; isDraw: boolean; winner: Color | null }) {
    const winner = result.isDraw ? "draw" : result.winner;
    if (winner) {
      await finishOnlineGame(supabaseRef.current, params.gameId, childId!, winner);
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
        if (fresh) setGame(fresh);
      }
    }
  }

  async function handleReaction(text: string) {
    await sendReaction(supabaseRef.current, params.gameId, isHost, text);
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

  // --- Finished ---
  if (game.status === "finished") {
    const myColor: Color = isHost ? game.host_color : game.host_color === "w" ? "b" : "w";
    const iWon = game.winner === myColor;
    const isDraw = game.winner === "draw";
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
          <Link href={game.tournament_id ? `/play/tournaments/${game.tournament_id}` : "/kingdom-map"}>
            <Button tone="premium">
              {game.tournament_id ? "Back to Tournament →" : "Back to the Kingdom Map →"}
            </Button>
          </Link>
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
    const myReaction = isHost ? game.host_reaction : game.guest_reaction;
    const theirReaction = isHost ? game.guest_reaction : game.host_reaction;
    // Random-match and tournament opponents are strangers, not people the
    // child already knows via an invite link — no chat/emoji there,
    // matching the app's no-open-contact-with-strangers policy (see
    // docs/01-PRD.md). Group Tournament opponents get the same treatment
    // as Random Match for the same reason.
    const showSocial = game.match_type !== "random" && game.match_type !== "tournament";
    const opponentColor: Color = myColor === "w" ? "b" : "w";
    const myMs = myColor === "w" ? displayWhiteMs : displayBlackMs;
    const opponentMs = opponentColor === "w" ? displayWhiteMs : displayBlackMs;
    const hasClock = game.time_control !== null && myMs !== null && opponentMs !== null;
    const arenaTitle =
      game.match_type === "random"
        ? "Random Match"
        : game.match_type === "tournament"
        ? `Tournament — Round ${game.round_number}`
        : "Friend Match";

    return (
      <GameArenaLayout
        title={arenaTitle}
        onExit={() =>
          router.push(game.tournament_id ? `/play/tournaments/${game.tournament_id}` : "/kingdom-map")
        }
        opponentRow={
          <div className="flex items-center justify-between w-full font-classic-body text-sm text-premium-ivory/70">
            <span className="flex items-center gap-2">
              <span className="text-xl">⚔️</span> Opponent
            </span>
            <span className="flex items-center gap-2">
              {showSocial && theirReaction && (
                <span className="bg-premium-navy border border-premium-gold/20 rounded-full px-3 py-1 text-premium-ivory">
                  {theirReaction}
                </span>
              )}
              {hasClock && <ChessClock ms={opponentMs!} active={game.current_turn === opponentColor} />}
            </span>
          </div>
        }
        playerRow={
          <div className="flex items-center justify-between w-full font-classic-body text-sm text-premium-ivory">
            <span className="flex items-center gap-2">
              <span className="text-xl">♟️</span>
              You — {myColor === "w" ? "White" : "Black"}
            </span>
            {hasClock && <ChessClock ms={myMs!} active={game.current_turn === myColor} />}
          </div>
        }
        renderBoard={(boardSize) => (
          <ChessBoard
            fen={game.fen}
            playableColor={myColor}
            size={boardSize}
            arenaMode
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={(opts) => handleMove(opts.fen, opts.san)}
            onGameOver={handleGameOver}
          />
        )}
        sidePanel={
          <>
            {openingMatch && (
              <OpeningBadge
                match={openingMatch}
                onDismiss={() => {
                  setDismissedOpeningId(openingMatch.opening.id);
                  setOpeningMatch(null);
                }}
              />
            )}

            {showSocial && (
              <div className="rounded-premiumCard bg-premium-navy p-3 flex flex-col gap-2 shadow-premiumCard">
                <div className="flex flex-wrap gap-2">
                  {EMOJI_REACTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleReaction(e)}
                      className="text-xl bg-premium-navyLight border border-white/10 rounded-full w-9 h-9 flex items-center justify-center hover:border-premium-gold/30 transition-colors"
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
                      className="text-xs bg-premium-navyLight border border-white/10 text-premium-ivory/80 rounded-full px-3 py-1.5 font-classic-body hover:border-premium-gold/30 transition-colors"
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
    );
  }

  return <main className="min-h-screen" />;
}
