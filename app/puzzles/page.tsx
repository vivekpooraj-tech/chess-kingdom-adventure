"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getTodayPreviewCount,
  incrementPreviewCount,
  localDateString,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { DAILY_PREVIEW_LIMIT } from "@/content/lessons";
import { PUZZLES, getDailyPuzzle } from "@/content/puzzles";
import { isSoundMateInNFirstMove } from "@/lib/chess-engine/puzzleValidation";
import { ChessBoard } from "@/components/board/ChessBoard";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
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

  // A puzzle id in the URL (e.g. from the Daily Challenge card) opens that
  // specific puzzle. Otherwise this page opens on TODAY's daily puzzle —
  // not an arbitrary fixed index — so a bare /puzzles visit always matches
  // whatever the Kingdom Map's Daily Challenge card is currently showing.
  const requestedId = searchParams.get("id");
  const initialIndex = (() => {
    if (requestedId) {
      const i = PUZZLES.findIndex((p) => p.id === requestedId);
      if (i !== -1) return i;
    }
    return PUZZLES.findIndex((p) => p.id === getDailyPuzzle().id);
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

      const { data: parent } = await supabase
        .from("parents")
        .select("premium_status")
        .eq("auth_user_id", user.id)
        .single();
      const premium = parent?.premium_status === "premium";
      setIsPremium(premium);

      if (!premium) {
        const count = await getTodayPreviewCount(supabase, child.id, localDateString());
        setTodayCount(count);
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
  }

  // Fires after every ply (the child's own move AND the auto-opponent's
  // reply) — used only to track the position the NEXT player move should
  // be validated from. See the `beforeFen` doc comment above.
  function handlePositionChange(pos: { fen: string }) {
    setBeforeFen(pos.fen);
  }

  function handleMove(opts: { fen: string; san: string; isCheckmate: boolean }) {
    const isFinalMove = moveCount === puzzle.mateIn - 1;
    if (isFinalMove) {
      if (opts.isCheckmate) {
        markSolved();
      } else {
        setStatus("incorrect");
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
      setStatus("incorrect");
    }
  }

  if (!loaded) {
    return <main className="min-h-screen" />;
  }

  const movesRemaining = puzzle.mateIn - moveCount;

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6 py-10">
      <h1 className={`${TEXT.display} text-center`}>Puzzle Trainer</h1>

      {limitReached ? (
        <SecondaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center border border-premium-gold/15">
          <span className="text-5xl">🔒</span>
          <h2 className={TEXT.heading}>Today's free puzzles are used up</h2>
          <p className={TEXT.body}>
            Free accounts get {DAILY_PREVIEW_LIMIT} puzzles a day — come back tomorrow for more,
            or unlock unlimited puzzles right now.
          </p>
          <UpgradeButton tone="premium" />
        </SecondaryCard>
      ) : (
        <PrimaryCard className="flex flex-col items-center gap-4 max-w-2xl w-full">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="font-classic-body text-sm bg-premium-emerald/25 text-emerald-300 rounded-full px-3 py-1 font-semibold">
              ♟ Checkmate in {puzzle.mateIn}
            </span>
            <span className="font-classic-body text-sm bg-premium-gold/15 text-premium-gold rounded-full px-3 py-1">
              {puzzle.theme}
            </span>
            <SideToMoveIndicator color={puzzle.sideToMove} tone="premium" />
          </div>

          {status === "playing" && moveCount === 0 && (
            <p className={`${TEXT.caption} normal-case`}>{OBJECTIVE_TEXT[puzzle.mateIn]}</p>
          )}

          <ChessBoard
            key={boardKey}
            fen={puzzle.fen}
            playableColor={puzzle.sideToMove}
            opponent={puzzle.mateIn > 1 ? "stockfish" : undefined}
            difficulty="easy"
            size={520}
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={handleMove}
            onPositionChange={handlePositionChange}
          />

          {status === "correct" && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-classic-display text-lg text-premium-gold">Checkmate — you found it.</p>
              <Button tone="premium" onClick={nextPuzzle}>Next Puzzle →</Button>
            </div>
          )}
          {status === "incorrect" && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-classic-display text-lg text-red-300">
                Not quite — take another look.
              </p>
              <Button tone="premium" variant="ghost" onClick={resetPuzzle}>
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
        </PrimaryCard>
      )}

      <p className={TEXT.caption}>
        {isPremium
          ? `Solved this session: ${solvedCount}`
          : `${Math.max(0, DAILY_PREVIEW_LIMIT - todayCount)} of ${DAILY_PREVIEW_LIMIT} free puzzles left today`}
      </p>

      <Link
        href="/kingdom-map"
        className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
      >
        Back to Home
      </Link>
    </main>
  );
}
