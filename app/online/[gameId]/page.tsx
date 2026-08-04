"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getOnlineGame,
  joinOnlineGame,
  updateGameFen,
  finishOnlineGame,
  sendReaction,
  OnlineGame,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { QUICK_CHAT_PHRASES, EMOJI_REACTIONS } from "@/content/quickChat";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Color } from "chess.js";

export default function OnlineGamePage() {
  const params = useParams<{ gameId: string }>();
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [game, setGame] = useState<OnlineGame | null | "loading">("loading");
  const supabaseRef = useRef(createClient());

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

  if (game === "loading" || !childId) {
    return <main className="min-h-screen" />;
  }

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">🔍</span>
          <p className="font-display text-lg text-kingdom-night">
            This game link isn't valid, or the game no longer exists.
          </p>
          <Link href="/kingdom-map">
            <Button>Back to the Kingdom Map →</Button>
          </Link>
        </Card>
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

  async function handleMove(fen: string) {
    await updateGameFen(supabaseRef.current, params.gameId, fen);
  }

  async function handleGameOver(result: { isCheckmate: boolean; isDraw: boolean; winner: Color | null }) {
    const winner = result.isDraw ? "draw" : result.winner;
    if (winner) {
      await finishOnlineGame(supabaseRef.current, params.gameId, winner);
    }
  }

  async function handleReaction(text: string) {
    await sendReaction(supabaseRef.current, params.gameId, isHost, text);
  }

  // --- Waiting for a friend (host's view) ---
  if (game.status === "waiting" && isHost) {
    const inviteUrl = typeof window !== "undefined" ? window.location.href : "";
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl animate-floaty">⏳</span>
          <h1 className="font-display text-xl text-kingdom-night">
            Waiting for a friend to join!
          </h1>
          <p className="font-body text-sm text-kingdom-night/60">
            Share this link with them:
          </p>
          <input
            readOnly
            value={inviteUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full text-center text-sm rounded-btn px-3 py-2 border-2 border-kingdom-night/10 font-body"
          />
          <Button
            variant="ghost"
            onClick={() => navigator.clipboard?.writeText(inviteUrl)}
          >
            Copy Link
          </Button>
        </Card>
      </main>
    );
  }

  // --- Someone else's open game, not yet joined ---
  if (canJoin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">⚔️</span>
          <h1 className="font-display text-xl text-kingdom-night">
            You've been challenged to a game!
          </h1>
          <Button onClick={handleJoin}>Join This Game →</Button>
        </Card>
      </main>
    );
  }

  // --- Finished ---
  if (game.status === "finished") {
    const myColor: Color = isHost ? game.host_color : game.host_color === "w" ? "b" : "w";
    const iWon = game.winner === myColor;
    const isDraw = game.winner === "draw";
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
          <span className="text-5xl">{isDraw ? "🤝" : iWon ? "🏆" : "🤔"}</span>
          <h1 className="font-display text-xl text-kingdom-night">
            {isDraw ? "It's a Draw!" : iWon ? "You Won!" : "Better Luck Next Time!"}
          </h1>
          <Link href="/kingdom-map">
            <Button>Back to the Kingdom Map →</Button>
          </Link>
        </Card>
      </main>
    );
  }

  // --- Active game ---
  if (game.status === "active" && (isHost || isGuest)) {
    const myColor: Color = isHost ? game.host_color : game.host_color === "w" ? "b" : "w";
    const myReaction = isHost ? game.host_reaction : game.guest_reaction;
    const theirReaction = isHost ? game.guest_reaction : game.host_reaction;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 py-8">
        <h1 className="font-display text-xl text-kingdom-night">
          Playing as {myColor === "w" ? "White" : "Black"}
        </h1>

        {theirReaction && (
          <p className="font-body text-lg bg-white/80 rounded-card px-4 py-2 shadow-toy">
            {theirReaction}
          </p>
        )}

        <ChessBoard
          fen={game.fen}
          playableColor={myColor}
          size={380}
          onMove={(opts) => handleMove(opts.fen)}
          onGameOver={handleGameOver}
        />

        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {EMOJI_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => handleReaction(e)}
              className="text-2xl bg-white/70 rounded-full w-10 h-10 flex items-center justify-center shadow-sm"
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {QUICK_CHAT_PHRASES.map((phrase) => (
            <button
              key={phrase}
              onClick={() => handleReaction(phrase)}
              className="text-sm bg-white/70 rounded-full px-3 py-1 shadow-sm font-body"
            >
              {phrase}
            </button>
          ))}
        </div>

        {myReaction && (
          <p className="font-body text-xs text-kingdom-night/40">You sent: {myReaction}</p>
        )}
      </main>
    );
  }

  return <main className="min-h-screen" />;
}
