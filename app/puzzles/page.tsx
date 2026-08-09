"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getTodayPreviewCount,
  incrementPreviewCount,
  localDateString,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { DAILY_PREVIEW_LIMIT } from "@/content/lessons";
import { PUZZLES } from "@/content/puzzles";
import { isSoundMateIn2FirstMove } from "@/lib/chess-engine/puzzleValidation";
import { ChessBoard } from "@/components/board/ChessBoard";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { TEXT } from "@/lib/designSystem";

type Status = "playing" | "correct" | "incorrect";

export default function PuzzlesPage() {
  const router = useRouter();
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const [index, setIndex] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [solvedCount, setSolvedCount] = useState(0);

  const puzzle = PUZZLES[index];
  const limitReached = !isPremium && todayCount >= DAILY_PREVIEW_LIMIT;

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

  function handleMove(opts: { fen: string; san: string; isCheckmate: boolean }) {
    if (puzzle.mateIn === 1) {
      if (opts.isCheckmate) {
        markSolved();
      } else {
        setStatus("incorrect");
      }
      return;
    }

    // mate-in-2
    if (moveCount === 0) {
      if (isSoundMateIn2FirstMove(puzzle.fen, opts.san)) {
        setMoveCount(1); // opponent auto-replies (ChessBoard's opponent="stockfish"), then it's the child's second move
      } else {
        setStatus("incorrect");
      }
    } else {
      if (opts.isCheckmate) {
        markSolved();
      } else {
        setStatus("incorrect");
      }
    }
  }

  if (!loaded) {
    return <main className="min-h-screen" />;
  }

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
              Mate in {puzzle.mateIn}
            </span>
            <span className="font-classic-body text-sm bg-premium-gold/15 text-premium-gold rounded-full px-3 py-1">
              {puzzle.theme}
            </span>
            <SideToMoveIndicator color={puzzle.sideToMove} tone="premium" />
          </div>

          <ChessBoard
            key={boardKey}
            fen={puzzle.fen}
            playableColor={puzzle.sideToMove}
            opponent={puzzle.mateIn === 2 ? "stockfish" : undefined}
            difficulty="easy"
            size={520}
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={handleMove}
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
          {status === "playing" && moveCount === 1 && (
            <p className={`${TEXT.caption} normal-case italic`}>
              Good move! Now find the checkmate.
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
