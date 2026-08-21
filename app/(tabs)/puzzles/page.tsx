"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChildCached,
  getTodayPreviewCount,
  incrementPreviewCount,
  localDateString,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { DAILY_PREVIEW_LIMIT } from "@/content/lessons";
import { PUZZLES } from "@/content/puzzles";
import { isSoundMateInNFirstMove } from "@/lib/chess-engine/puzzleValidation";
import { recordDailyChallengeResult } from "@/lib/supabase/dailyChallengeQueries";
import { ChessBoard } from "@/components/board/ChessBoard";
import { ChessFocusLayout } from "@/components/chess/ChessFocusLayout";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";
import { TEXT } from "@/lib/designSystem";

type Status = "playing" | "correct" | "incorrect";

const OBJECTIVE_TEXT: Record<1 | 2 | 3, string> = {
  1: "Find the winning move.",
  2: "Find the first move that forces checkmate in 2 moves.",
  3: "Calculate the sequence and force checkmate in 3 moves.",
};

// useSearchParams() requires a Suspense boundary in the App Router.
export default function PuzzlesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-premium-midnight" />}>
      <PuzzlesPageInner />
    </Suspense>
  );
}

function PuzzlesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // A puzzle id in the URL (e.g. from the Daily Challenge card, which links
  // here with &daily=1) opens that specific puzzle. A bare /puzzles visit
  // (free practice, not tied to any specific day) just opens the first
  // puzzle in the pool — the actual Daily Challenge is only ever reached
  // via the DailyChallengeCard link now, never a fixed local rotation.
  const requestedId = searchParams.get("id");
  const isDaily = searchParams.get("daily") === "1";
  const initialIndex = (() => {
    if (requestedId) {
      const i = PUZZLES.findIndex((p) => p.id === requestedId);
      if (i !== -1) return i;
    }
    return 0;
  })();

  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const [index, setIndex] = useState(initialIndex);
  const [boardKey, setBoardKey] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [solvedCount, setSolvedCount] = useState(0);
  const [dailyAttempts, setDailyAttempts] = useState(0);

  const puzzle = PUZZLES[index];
  const limitReached = !isPremium && todayCount >= DAILY_PREVIEW_LIMIT;

  // The FEN the player's NEXT move should be validated from — the puzzle's
  // own starting position at first, then whatever position the auto-
  // opponent's reply lands on after each of the player's non-final moves.
  // Never the live game's post-move FEN (that's `opts.fen` in handleMove,
  // which is the position AFTER the move being validated, not before it).
  const [beforeFen, setBeforeFen] = useState(puzzle.fen);

  useEffect(() => {
    setBeforeFen(puzzle.fen);
  }, [puzzle.fen]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // getVerifiedUser() reads the already-verified session from local
      // storage instead of getUser()'s network round trip to re-validate it
      // against Supabase's Auth server — safe here because this is only
      // deciding what to render for THIS client; every query below is still
      // enforced by RLS server-side regardless of what the client believes
      // its own identity is. It also retries once on a transient network
      // failure, so a momentary blip refreshing an expired token (the
      // common case right after reopening the app) doesn't bounce a
      // genuinely signed-in user to a fresh magic-link request.
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChildCached(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setChildId(child.id);
      setBoardSkinId(child.board_skin_id);
      setPieceSetId(child.piece_set_id);

      // Independent of each other (both only need user/child ids already in
      // hand) — run together instead of one after the other.
      const [{ data: parent }, previewCount] = await Promise.all([
        supabase.from("parents").select("premium_status").eq("auth_user_id", user.id).single(),
        getTodayPreviewCount(supabase, child.id, localDateString()),
      ]);
      const premium = parent?.premium_status === "premium";
      setIsPremium(premium);
      if (!premium) {
        setTodayCount(previewCount);
      }
      setLoaded(true);
    }
    load();
  }, [router]);

  function resetPuzzle() {
    setBoardKey((k) => k + 1);
    setMoveCount(0);
    setStatus("playing");
    setBeforeFen(puzzle.fen);
  }

  function nextPuzzle() {
    setIndex((i) => (i + 1) % PUZZLES.length);
    setBoardKey((k) => k + 1);
    setMoveCount(0);
    setStatus("playing");
    setDailyAttempts(0);
  }

  function markSolved() {
    setStatus("correct");
    setSolvedCount((n) => n + 1);
    if (!isPremium && childId) {
      const supabase = createClient();
      incrementPreviewCount(supabase, childId, localDateString())
        .then(setTodayCount)
        .catch(() => {});
    }
    // Server-authoritative: this only ever writes to the daily_challenge_
    // history row already created by get_daily_challenge (see
    // DailyChallengeCard) — the RPC itself is idempotent (a duplicate or
    // retried call can't double-count), matching the same client-reports-
    // the-chess-outcome trust model as finish_online_game_by_result.
    if (isDaily && childId) {
      const supabase = createClient();
      recordDailyChallengeResult(supabase, childId, localDateString(), true).catch(() => {});
    }
  }

  // Fires after every ply (the child's own move AND the auto-opponent's
  // reply) — used only to track the position the NEXT player move should
  // be validated from. See the `beforeFen` doc comment above.
  function handlePositionChange(pos: { fen: string }) {
    setBeforeFen(pos.fen);
  }

  function markIncorrect() {
    setStatus("incorrect");
    setDailyAttempts((n) => n + 1);
    if (isDaily && childId) {
      const supabase = createClient();
      recordDailyChallengeResult(supabase, childId, localDateString(), false).catch(() => {});
    }
  }

  function handleMove(opts: { fen: string; san: string; isCheckmate: boolean }) {
    const isFinalMove = moveCount === puzzle.mateIn - 1;
    if (isFinalMove) {
      if (opts.isCheckmate) {
        markSolved();
      } else {
        markIncorrect();
      }
      return;
    }

    // Not the last move yet — must be a sound forcing move against every
    // legal reply, checked from the position it was actually played from
    // (beforeFen), not the puzzle's original starting FEN.
    const remainingDepth = puzzle.mateIn - moveCount;
    if (isSoundMateInNFirstMove(beforeFen, opts.san, remainingDepth)) {
      setMoveCount((c) => c + 1); // opponent auto-replies (ChessBoard's opponent="stockfish"), then the child's next move
    } else {
      markIncorrect();
    }
  }

  if (!loaded) {
    // A real skeleton, not a blank screen — this page is a client component
    // (needs the puzzle id from the URL before it knows what to render), so
    // there's no server loading.tsx that can cover this gap; the tap needs
    // to feel acknowledged immediately while the auth + active-child lookup
    // that `load()` above kicks off resolves in the background.
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="h-9 w-48 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full max-w-md aspect-square" />
        <SkeletonRow className="h-4 w-40" />
      </main>
    );
  }

  const movesRemaining = puzzle.mateIn - moveCount;

  if (!limitReached) {
    return (
      <ChessFocusLayout
        title="Puzzle Trainer"
        onExit={() => router.push("/kingdom-map")}
        renderBoard={(boardSize) => (
          <ChessBoard
            key={boardKey}
            fen={puzzle.fen}
            playableColor={puzzle.sideToMove}
            opponent={puzzle.mateIn > 1 ? "stockfish" : undefined}
            difficulty="easy"
            size={boardSize}
            focusMode
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={handleMove}
            onPositionChange={handlePositionChange}
          />
        )}
        sidePanel={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-classic-body text-xs bg-premium-emerald/25 text-emerald-300 rounded-full px-3 py-1 font-semibold">
                Checkmate in {puzzle.mateIn}
              </span>
              <span className="font-classic-body text-xs bg-premium-gold/15 text-premium-gold rounded-full px-3 py-1">
                {puzzle.theme}
              </span>
              <SideToMoveIndicator color={puzzle.sideToMove} tone="premium" />
            </div>

            {status === "playing" && moveCount === 0 && (
              <p className={`${TEXT.caption} normal-case`}>{OBJECTIVE_TEXT[puzzle.mateIn]}</p>
            )}

            {status === "correct" && isDaily && (
              <div className="flex flex-col gap-2">
                <p className="font-classic-display text-base text-premium-gold">Daily Challenge Complete ✓</p>
                <p className={`${TEXT.caption} normal-case`}>
                  Today&apos;s challenge: Checkmate in {puzzle.mateIn} · Accuracy:{" "}
                  {Math.round(100 / (dailyAttempts + 1))}%
                </p>
                <Link href="/kingdom-map">
                  <Button tone="premium" className="w-full">Back to the Kingdom →</Button>
                </Link>
              </div>
            )}
            {status === "correct" && !isDaily && (
              <div className="flex flex-col gap-2">
                <p className="font-classic-display text-base text-premium-gold">Checkmate — you found it.</p>
                <Button tone="premium" onClick={nextPuzzle} className="w-full">
                  Next Puzzle →
                </Button>
              </div>
            )}
            {status === "incorrect" && (
              <div className="flex flex-col gap-2">
                <p className="font-classic-display text-base text-red-300">Not quite — take another look.</p>
                <Button tone="premium" variant="ghost" onClick={resetPuzzle} className="w-full">
                  Try Again
                </Button>
              </div>
            )}
            {status === "playing" && moveCount > 0 && (
              <p className={`${TEXT.caption} normal-case italic`}>
                {movesRemaining === 1
                  ? "Good move! Now find the checkmate."
                  : `Good move! ${movesRemaining} moves to go.`}
              </p>
            )}

            <p className={`${TEXT.caption} mt-auto pt-2 border-t border-white/5`}>
              {isPremium
                ? `Solved this session: ${solvedCount}`
                : `${Math.max(0, DAILY_PREVIEW_LIMIT - todayCount)} of ${DAILY_PREVIEW_LIMIT} free puzzles left today`}
            </p>
          </div>
        }
      />
    );
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-4 sm:px-6 pt-8 pb-28">
      <h1 className={`${TEXT.display} text-center`}>Puzzle Trainer</h1>
      <SecondaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center border border-premium-gold/15">
        <span className="text-5xl">🔒</span>
        <h2 className={TEXT.heading}>Today&apos;s free puzzles are used up</h2>
        <p className={TEXT.body}>
          Free accounts get {DAILY_PREVIEW_LIMIT} puzzles a day — come back tomorrow for more, or unlock
          unlimited puzzles right now.
        </p>
        <UpgradeButton tone="premium" />
      </SecondaryCard>
      <Link
        href="/kingdom-map"
        className="font-body text-sm text-premium-ivory/40 underline underline-offset-2 min-h-[44px] flex items-center"
      >
        Back to Home
      </Link>
    </main>
  );
}
