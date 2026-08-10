"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getOnlineGame,
  joinOnlineGame,
  appendGameMove,
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
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OpeningBadge } from "@/components/game/OpeningBadge";
import { GameEndOpeningSummary } from "@/components/game/GameEndOpeningSummary";
import { recognizeOpening, OpeningMatch } from "@/lib/openings/recognitionEngine";
import { useArenaBoardSize } from "@/lib/hooks/useArenaBoardSize";
import { TEXT } from "@/lib/designSystem";
import type { Color } from "chess.js";

export default function OnlineGamePage() {
  const params = useParams<{ gameId: string }>();
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [game, setGame] = useState<OnlineGame | null | "loading">("loading");
  const [newRating, setNewRating] = useState<number | null>(null);
  const [openingMatch, setOpeningMatch] = useState<OpeningMatch | null>(null);
  const [dismissedOpeningId, setDismissedOpeningId] = useState<string | null>(null);
  const seenOpeningIdsRef = useRef<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());
  // Called unconditionally (rules of hooks) — only matters once the game
  // is actually active, reserving room for the arena header + reaction
  // rows above/below the board.
  const arenaBoardSize = useArenaBoardSize(200);

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
  // see appendGameMove's doc comment for why that's necessary here.
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
    const joined = await joinOnlineGame(supabase, params.gameId, childId!);
    if (joined) {
      const fresh = await getOnlineGame(supabase, params.gameId);
      setGame(fresh);
    } else {
      // Someone else claimed the guest slot first — refresh to show reality.
      const fresh = await getOnlineGame(supabase, params.gameId);
      setGame(fresh);
    }
  }

  async function handleMove(fen: string, san: string) {
    await appendGameMove(supabaseRef.current, params.gameId, fen, san);
  }

  async function handleGameOver(result: { isCheckmate: boolean; isDraw: boolean; winner: Color | null }) {
    const winner = result.isDraw ? "draw" : result.winner;
    if (winner) {
      await finishOnlineGame(supabaseRef.current, params.gameId, winner);
      if (game && game !== "loading" && game.match_type === "random") {
        const supabase = supabaseRef.current;
        await applyMatchRating(supabase, params.gameId).catch(() => {});
        const { data } = await supabase.from("children").select("rating").eq("id", childId!).single();
        if (data) setNewRating(data.rating);
      }
    }
  }

  async function handleReaction(text: string) {
    await sendReaction(supabaseRef.current, params.gameId, isHost, text);
  }

  // --- Waiting for a friend (host's view) ---
  if (game.status === "waiting" && isHost) {
    const inviteUrl = typeof window !== "undefined" ? window.location.href : "";
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl animate-floaty">⏳</span>
          <h1 className={TEXT.heading}>Waiting for a friend to join!</h1>
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
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">⚔️</span>
          <h1 className={TEXT.heading}>You've been challenged to a game!</h1>
          <Button tone="premium" onClick={handleJoin}>Join This Game →</Button>
        </SecondaryCard>
      </main>
    );
  }

  // --- Finished ---
  if (game.status === "finished") {
    const myColor: Color = isHost ? game.host_color : game.host_color === "w" ? "b" : "w";
    const iWon = game.winner === myColor;
    const isDraw = game.winner === "draw";
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6">
        <PrimaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">{isDraw ? "🤝" : iWon ? "🏆" : "🤔"}</span>
          <h1 className={TEXT.heading}>
            {isDraw ? "It's a Draw!" : iWon ? "You Won!" : "Better Luck Next Time!"}
          </h1>
          {game.match_type === "random" && newRating !== null && (
            <p className={TEXT.body}>
              Your rating is now <span className="text-premium-gold font-semibold">{newRating}</span>
            </p>
          )}
          <Link href="/kingdom-map">
            <Button tone="premium">Back to the Kingdom Map →</Button>
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
    // Random-match opponents are strangers, not people the child already
    // knows via an invite link — no chat/emoji there, matching the app's
    // no-open-contact-with-strangers policy (see docs/01-PRD.md).
    const showSocial = game.match_type !== "random";

    return (
      <GameArenaLayout
        title={game.match_type === "random" ? "Random Match" : "Friend Match"}
        onExit={() => router.push("/kingdom-map")}
        opponentRow={
          <div className="flex items-center justify-between w-full font-classic-body text-sm text-premium-ivory/70">
            <span className="flex items-center gap-2">
              <span className="text-xl">⚔️</span> Opponent
            </span>
            {showSocial && theirReaction && (
              <span className="bg-premium-navy border border-premium-gold/20 rounded-full px-3 py-1 text-premium-ivory">
                {theirReaction}
              </span>
            )}
          </div>
        }
        playerRow={
          <div className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory">
            <span className="text-xl">♟️</span>
            You — {myColor === "w" ? "White" : "Black"}
          </div>
        }
        board={
          <ChessBoard
            fen={game.fen}
            playableColor={myColor}
            size={arenaBoardSize}
            arenaMode
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={(opts) => handleMove(opts.fen, opts.san)}
            onGameOver={handleGameOver}
          />
        }
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
