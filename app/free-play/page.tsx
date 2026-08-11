"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PieceSymbol } from "chess.js";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, recordOpeningEncounter, getFreeGameStatus, startAiGame, FreeGameStatus } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { ChessBoard } from "@/components/board/ChessBoard";
import { GameArenaLayout } from "@/components/game/GameArenaLayout";
import { GameChrome } from "@/components/game/GameChrome";
import { OpeningBadge } from "@/components/game/OpeningBadge";
import { GameEndOpeningSummary } from "@/components/game/GameEndOpeningSummary";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { recognizeOpening, OpeningMatch } from "@/lib/openings/recognitionEngine";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";

type ViewState =
  | { status: "loading" }
  | { status: "picking-difficulty" }
  | { status: "playing"; difficulty: Difficulty }
  | { status: "game-over"; difficulty: Difficulty; result: GameResult };

interface GameResult {
  isCheckmate: boolean;
  isDraw: boolean;
  winner: "w" | "b" | null;
}

interface PositionState {
  history: string[];
  turn: "w" | "b";
  isCheck: boolean;
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
}

const EMPTY_POSITION: PositionState = {
  history: [],
  turn: "w",
  isCheck: false,
  capturedByWhite: [],
  capturedByBlack: [],
};

const DIFFICULTY_INFO: { key: Difficulty; label: string; emoji: string; blurb: string }[] = [
  { key: "easy", label: "Easy", emoji: "🌱", blurb: "A gentle, beatable opponent." },
  { key: "medium", label: "Medium", emoji: "⚔️", blurb: "A real challenge." },
  { key: "hard", label: "Hard", emoji: "🔥", blurb: "Only for Kingdom Champions!" },
];

/**
 * Honest, real-signal encouragement only — no fabricated move-quality
 * analysis (no evaluation engine wired into this screen). Every message
 * here is a direct fact about the position, not a judgment call.
 */
function getHint(pos: PositionState, prevCapturedCount: number): string | null {
  const capturedCount = pos.capturedByWhite.length + pos.capturedByBlack.length;
  if (pos.isCheck) return "Check! ⚡";
  if (capturedCount > prevCapturedCount) return "Nice capture! 🎯";
  if (pos.history.length === 1) return "Great start! ♟️";
  return null;
}

export default function FreePlayPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [gameKey, setGameKey] = useState(0);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [position, setPosition] = useState<PositionState>(EMPTY_POSITION);
  const [prevCapturedCount, setPrevCapturedCount] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [openingMatch, setOpeningMatch] = useState<OpeningMatch | null>(null);
  const [dismissedOpeningId, setDismissedOpeningId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [seenOpeningIds, setSeenOpeningIds] = useState<Set<string>>(new Set());
  const [gameStatus, setGameStatus] = useState<FreeGameStatus | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
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
      const child = resolution.child!;
      setChildId(child.id);
      setBoardSkinId(child.board_skin_id);
      setPieceSetId(child.piece_set_id);

      const status = await getFreeGameStatus(supabase, child.id);
      setGameStatus(status);
      setView({ status: "picking-difficulty" });
    }
    load();
  }, [router]);

  // Checks + consumes a daily free-game credit server-side BEFORE the
  // board ever renders — clicking a difficulty is the earliest point a
  // real "game start" exists for Free Play (see
  // supabase/migrations/0019_daily_free_game_limits.sql), so this is
  // exactly where eligibility has to be enforced, not after.
  async function startGame(difficulty: Difficulty) {
    if (!childId || startingGame) return;
    setStartingGame(true);
    try {
      const supabase = createClient();
      const result = await startAiGame(supabase, childId);
      if (!result.allowed) {
        const fresh = await getFreeGameStatus(supabase, childId);
        setGameStatus(fresh);
        setShowPaywall(true);
        return;
      }
      setGameStatus((prev) => (prev ? { ...prev, aiRemaining: result.remaining } : prev));
      setGameKey((k) => k + 1);
      setPosition(EMPTY_POSITION);
      setPrevCapturedCount(0);
      setHint(null);
      setOpeningMatch(null);
      setDismissedOpeningId(null);
      setView({ status: "playing", difficulty });
    } finally {
      setStartingGame(false);
    }
  }

  function handleGameOver(difficulty: Difficulty, result: GameResult) {
    setView({ status: "game-over", difficulty, result });
  }

  function handlePositionChange(pos: PositionState) {
    setHint(getHint(pos, prevCapturedCount));
    setPrevCapturedCount(pos.capturedByWhite.length + pos.capturedByBlack.length);
    setPosition(pos);

    const match = recognizeOpening(pos.history);
    // A dismissed opening stays dismissed — UNLESS a more specific match
    // (e.g. Italian Game -> Evans Gambit) has since been reached, which is
    // genuinely new information worth surfacing again.
    if (match && match.opening.id !== dismissedOpeningId) {
      setOpeningMatch(match);
    } else if (!match) {
      setOpeningMatch(null);
    }

    // Record it once per opening per child, not on every position tick —
    // real "have they ever reached this opening" tracking for the
    // Exploration achievements, not a fabricated stat.
    if (match && childId && !seenOpeningIds.has(match.opening.id)) {
      setSeenOpeningIds((prev) => new Set(prev).add(match.opening.id));
      const supabase = createClient();
      recordOpeningEncounter(supabase, childId, match.opening.id).catch(() => {});
    }
  }

  if (view.status === "loading") {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  if (view.status === "picking-difficulty") {
    const exhausted = gameStatus && !gameStatus.isPremium && gameStatus.aiRemaining === 0;
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-8 px-6 py-12">
        <h1 className={`${TEXT.display} text-center`}>Free Play Arena</h1>
        <p className={`${TEXT.body} text-center max-w-sm`}>
          Choose your opponent's strength and play a full game, start to finish!
        </p>
        {gameStatus && !gameStatus.isPremium && (
          <div className="flex flex-col items-center gap-0.5">
            <p className={TEXT.caption}>AI Games</p>
            <p className={TEXT.body}>{gameStatus.aiRemaining} of 2 free games remaining today</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 max-w-sm w-full">
          {DIFFICULTY_INFO.map((d) => (
            <button
              key={d.key}
              onClick={() => (exhausted ? setShowPaywall(true) : startGame(d.key))}
              disabled={startingGame}
              className={`flex items-center gap-4 rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 text-left ${
                exhausted ? "opacity-50" : ""
              }`}
            >
              <span className="text-4xl">{d.emoji}</span>
              <div>
                <p className="font-classic-display text-lg text-premium-ivory">{d.label}</p>
                <p className="font-classic-body text-sm text-premium-ivory/50">{d.blurb}</p>
              </div>
            </button>
          ))}
        </div>
        <Link
          href="/kingdom-map"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Kingdom Map
        </Link>
        {showPaywall && <GameLimitPaywall gameType="ai" onDismiss={() => setShowPaywall(false)} />}
      </main>
    );
  }

  if (view.status === "playing") {
    const difficultyInfo = DIFFICULTY_INFO.find((d) => d.key === view.difficulty)!;
    return (
      <GameArenaLayout
        title={`${difficultyInfo.label} Match`}
        onExit={() => setView({ status: "picking-difficulty" })}
        opponentRow={
          <div className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory/70">
            <span className="text-xl">{difficultyInfo.emoji}</span>
            Stockfish — {difficultyInfo.label}
          </div>
        }
        playerRow={
          <div className="flex items-center gap-2 font-classic-body text-sm text-premium-ivory">
            <span className="text-xl">♟️</span> You
          </div>
        }
        renderBoard={(boardSize) => (
          <ChessBoard
            key={gameKey}
            playableColor="w"
            opponent="stockfish"
            difficulty={view.difficulty}
            size={boardSize}
            arenaMode
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onGameOver={(result) => handleGameOver(view.difficulty, result)}
            onPositionChange={handlePositionChange}
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
            <GameChrome
              capturedByWhite={position.capturedByWhite}
              capturedByBlack={position.capturedByBlack}
              history={position.history}
              statusText={position.isCheck ? "Check" : position.turn === "w" ? "White to move" : "Black to move"}
              hint={hint}
            />
            <Button tone="premium" variant="ghost" onClick={() => setView({ status: "picking-difficulty" })}>
              Change Difficulty
            </Button>
          </>
        }
      />
    );
  }

  // status === "game-over"
  const { result, difficulty } = view;
  const playerWon = result.isCheckmate && result.winner === "w";
  const opponentWon = result.isCheckmate && result.winner === "b";

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6">
      <PrimaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">{playerWon ? "🏆" : opponentWon ? "🤔" : "🤝"}</span>
        <h1 className={TEXT.heading}>
          {playerWon
            ? "Checkmate — You Won!"
            : opponentWon
            ? "Checkmate — Try Again!"
            : "It's a Draw!"}
        </h1>
        <p className={TEXT.body}>
          {playerWon
            ? "Excellent game — you outplayed the opponent."
            : opponentWon
            ? "So close. Every game teaches you something new."
            : "A hard-fought battle with no winner this time."}
        </p>
        <div className="flex gap-3">
          <Button tone="premium" onClick={() => startGame(difficulty)}>Play Again</Button>
          <Button tone="premium" variant="ghost" onClick={() => setView({ status: "picking-difficulty" })}>
            Change Difficulty
          </Button>
        </div>
        <Link
          href="/kingdom-map"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Kingdom Map
        </Link>
      </PrimaryCard>

      {openingMatch && <GameEndOpeningSummary match={openingMatch} />}
    </main>
  );
}
