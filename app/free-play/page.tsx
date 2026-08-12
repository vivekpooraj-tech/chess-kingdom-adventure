"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PieceSymbol, Color } from "chess.js";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, recordOpeningEncounter, getFreeGameStatus, startAiGame, FreeGameStatus } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { ChessBoard } from "@/components/board/ChessBoard";
import { GameArenaLayout } from "@/components/game/GameArenaLayout";
import { GameChrome } from "@/components/game/GameChrome";
import { OpeningBadge } from "@/components/game/OpeningBadge";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { PostGameAnalysis } from "@/components/game/analysis/PostGameAnalysis";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { recognizeOpening, OpeningMatch } from "@/lib/openings/recognitionEngine";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";
import type { CompletedGameRecord, PlayedMove } from "@/lib/analysis/gameAnalysis";

const STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type ViewState =
  | { status: "loading" }
  | { status: "picking-difficulty" }
  | { status: "playing"; difficulty: Difficulty }
  | { status: "game-over"; record: CompletedGameRecord }
  | { status: "analysis"; record: CompletedGameRecord };

interface GameResult {
  isCheckmate: boolean;
  isDraw: boolean;
  winner: "w" | "b" | null;
}

interface PositionState {
  fen: string;
  history: string[];
  turn: "w" | "b";
  isCheck: boolean;
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
}

const EMPTY_POSITION: PositionState = {
  fen: "",
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
  // A historical ply shown on the board while the live game remains safely
  // in memory. null means the board is showing the current position.
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  // Ply-by-ply log captured live during play — the source of truth for the
  // post-game analysis screen (section 14: "preserve the complete move
  // history"). A ref, not state: it's written on every ply but only ever
  // read once, at game-over, so it doesn't need to trigger re-renders.
  const moveLogRef = useRef<PlayedMove[]>([]);
  const gameStartedAtRef = useRef<string>("");

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
      setReviewPly(null);
      moveLogRef.current = [];
      gameStartedAtRef.current = new Date().toISOString();
      setView({ status: "playing", difficulty });
    } finally {
      setStartingGame(false);
    }
  }

  function handleGameOver(difficulty: Difficulty, result: GameResult) {
    const difficultyInfo = DIFFICULTY_INFO.find((d) => d.key === difficulty)!;
    const record: CompletedGameRecord = {
      startFen: STANDARD_START_FEN,
      moves: moveLogRef.current,
      result,
      playerColor: "w",
      opponentLabel: `Computer — ${difficultyInfo.label}`,
      difficulty,
      startedAt: gameStartedAtRef.current || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      openingName: openingMatch?.opening.name ?? null,
    };
    setView({ status: "game-over", record });
  }

  function handlePositionChange(pos: PositionState) {
    setHint(getHint(pos, prevCapturedCount));
    setPrevCapturedCount(pos.capturedByWhite.length + pos.capturedByBlack.length);
    setPosition(pos);

    // Preserves the complete move history live, ply by ply — fires once
    // per ply (see ChessBoard's onPositionChange doc comment), for both
    // the child's own moves and Stockfish's replies. `pos.turn` is whose
    // turn it is NEXT, so the mover of the ply that just happened is the
    // other color.
    if (pos.history.length > moveLogRef.current.length) {
      const ply = pos.history.length - 1;
      moveLogRef.current = [
        ...moveLogRef.current,
        { ply, san: pos.history[ply], fen: pos.fen, mover: pos.turn === "w" ? "b" : "w" },
      ];
    }

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
    const totalPlies = position.history.length;
    const isReviewing = reviewPly !== null;
    const displayedPly = reviewPly ?? totalPlies;
    // Hard 3-move cap: never let review reach further back than 3 real
    // plies, and never fabricate a position — when fewer than 3 plies have
    // been played, this naturally floors at 0 (the starting position),
    // which is itself a real, valid review target.
    const minReviewPly = Math.max(0, totalPlies - 3);
    const reviewFen =
      reviewPly === null
        ? undefined
        : reviewPly === 0
        ? STANDARD_START_FEN
        : moveLogRef.current[reviewPly - 1]?.fen ?? position.fen;
    const reviewPlies = Array.from({ length: totalPlies - minReviewPly + 1 }, (_, i) => minReviewPly + i);
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
          <div className="w-full flex flex-col items-center gap-2">
            {/*
              This is a VIEW-ONLY history control, not a takeback/undo. The
              live `game` chess.js instance inside ChessBoard is keyed only
              on `fen` (never changed here), so it's never touched by
              review navigation — see displayFen's doc comment on
              ChessBoard. readOnly additionally hard-blocks square clicks
              and the auto-opponent effect while reviewing, so the AI can
              never move and no move can ever be submitted from a
              historical position.
            */}
            <ChessBoard
              key={gameKey}
              playableColor="w"
              opponent="stockfish"
              difficulty={view.difficulty}
              size={boardSize}
              arenaMode
              boardSkinId={boardSkinId}
              pieceSetId={pieceSetId}
              displayFen={reviewFen}
              readOnly={isReviewing}
              onGameOver={(result) => handleGameOver(view.difficulty, result)}
              onPositionChange={handlePositionChange}
            />
            {totalPlies > 0 && !isReviewing && (
              <button
                type="button"
                onClick={() => setReviewPly(Math.max(minReviewPly, totalPlies - 1))}
                className="font-classic-body text-xs text-premium-ivory/55 hover:text-premium-gold underline underline-offset-2 transition-colors"
              >
                ← Review previous moves
              </button>
            )}
            {isReviewing && (
              <div className="w-full max-w-[480px] flex flex-col items-center gap-2">
                <div className="w-full rounded-premiumBtn bg-premium-gold/10 border border-premium-gold/30 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="font-classic-body text-xs text-premium-gold">
                    👁 {displayedPly === 0 ? "REVIEWING STARTING POSITION" : `REVIEWING MOVE ${displayedPly}`}
                  </p>
                  <p className="font-classic-body text-xs text-premium-ivory/50 whitespace-nowrap">
                    Current move: {totalPlies}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-center" role="group" aria-label="Step through recent moves">
                  {reviewPlies.map((ply) => (
                    <button
                      key={ply}
                      type="button"
                      onClick={() => setReviewPly(ply === totalPlies ? null : ply)}
                      className={`font-classic-body text-xs rounded-premiumBtn px-2.5 py-1.5 transition-colors ${
                        ply === displayedPly
                          ? "bg-premium-gold/20 text-premium-gold border border-premium-gold/40"
                          : "bg-premium-navyLight text-premium-ivory/70 border border-white/10 hover:border-white/25"
                      }`}
                    >
                      {ply === minReviewPly && ply !== totalPlies ? "← " : ""}
                      {ply === 0 ? "Start" : `Move ${ply}`}
                      {ply === totalPlies ? " → Current" : ""}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setReviewPly(null)}
                  className="font-classic-body text-xs text-premium-gold underline underline-offset-2"
                >
                  → Back to Game
                </button>
              </div>
            )}
          </div>
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

  if (view.status === "analysis") {
    return (
      <PostGameAnalysis
        record={view.record}
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
        onPlayAgain={() => startGame(view.record.difficulty)}
        onBack={() => setView({ status: "picking-difficulty" })}
      />
    );
  }

  // status === "game-over" — a deliberately lightweight result card shown
  // immediately at checkmate. The completed game (view.record) is NOT
  // discarded here — "Review Game" carries it straight into the full
  // PostGameAnalysis screen, and the game never auto-navigates away on its
  // own (section 1/2 of the brief this implements).
  const { record } = view;
  const playerWon = record.result.isCheckmate && record.result.winner === record.playerColor;
  const opponentWon = record.result.isCheckmate && record.result.winner !== record.playerColor && record.result.winner !== null;
  const moveNumber = Math.ceil(record.moves.length / 2);

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6">
      <PrimaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>Chess Mind</p>
        <h1 className={TEXT.heading}>Game Over</h1>
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">{playerWon ? "🏆" : opponentWon ? "♔" : "🤝"}</span>
          <p className="font-classic-display text-xl text-premium-ivory">
            {playerWon ? "You won" : opponentWon ? "You lost" : "Draw"}
          </p>
          {record.result.isCheckmate && (
            <p className={TEXT.caption}>Checkmate on move {moveNumber}</p>
          )}
        </div>
        <Button tone="premium" onClick={() => setView({ status: "analysis", record })}>
          Review Game
        </Button>
        <div className="flex gap-3">
          <Button tone="premium" variant="ghost" onClick={() => startGame(record.difficulty)}>Play Again</Button>
          <Link href="/kingdom-map">
            <Button tone="premium" variant="ghost">Back to the Kingdom Map</Button>
          </Link>
        </div>
      </PrimaryCard>
    </main>
  );
}
