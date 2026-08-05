"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { PUZZLES } from "@/content/puzzles";
import { isSoundMateIn2FirstMove } from "@/lib/chess-engine/puzzleValidation";
import { ChessBoard } from "@/components/board/ChessBoard";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Status = "playing" | "correct" | "incorrect";

export default function PuzzlesPage() {
  const router = useRouter();
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  const [index, setIndex] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [solvedCount, setSolvedCount] = useState(0);

  const puzzle = PUZZLES[index];

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
      setBoardSkinId(child.board_skin_id);
      setPieceSetId(child.piece_set_id);
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

  function handleMove(opts: { fen: string; san: string; isCheckmate: boolean }) {
    if (puzzle.mateIn === 1) {
      if (opts.isCheckmate) {
        setStatus("correct");
        setSolvedCount((n) => n + 1);
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
        setStatus("correct");
        setSolvedCount((n) => n + 1);
      } else {
        setStatus("incorrect");
      }
    }
  }

  if (!loaded) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 py-10">
      <h1 className="font-display text-3xl text-kingdom-night text-center">Puzzle Trainer 🧩</h1>

      <Card className="flex flex-col items-center gap-4 max-w-2xl w-full">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="font-body text-sm bg-kingdom-royal/15 text-kingdom-royal rounded-full px-3 py-1 font-bold">
            Mate in {puzzle.mateIn}
          </span>
          <span className="font-body text-sm bg-kingdom-gold/20 text-kingdom-night/70 rounded-full px-3 py-1">
            {puzzle.theme}
          </span>
          <SideToMoveIndicator color={puzzle.sideToMove} />
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
            <p className="font-display text-lg text-kingdom-gold">Checkmate! You found it! 👑</p>
            <Button onClick={nextPuzzle}>Next Puzzle →</Button>
          </div>
        )}
        {status === "incorrect" && (
          <div className="flex flex-col items-center gap-3">
            <p className="font-display text-lg text-kingdom-coral">
              Not quite — take another look!
            </p>
            <Button variant="ghost" onClick={resetPuzzle}>
              Try Again
            </Button>
          </div>
        )}
        {status === "playing" && moveCount === 1 && (
          <p className="font-body text-sm text-kingdom-night/50 italic">
            Good move! Now find the checkmate.
          </p>
        )}
      </Card>

      <p className="font-body text-sm text-kingdom-night/60">Solved this session: {solvedCount}</p>

      <Link
        href="/kingdom-map"
        className="font-body text-sm text-kingdom-night/40 underline underline-offset-2"
      >
        Back to the Kingdom Map
      </Link>
    </main>
  );
}
