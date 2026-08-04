"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, getCompletedDays } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { LESSONS } from "@/content/lessons";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";

type ViewState =
  | { status: "loading" }
  | { status: "locked"; completed: number; total: number }
  | { status: "picking-difficulty" }
  | { status: "playing"; difficulty: Difficulty }
  | { status: "game-over"; difficulty: Difficulty; result: GameResult };

interface GameResult {
  isCheckmate: boolean;
  isDraw: boolean;
  winner: "w" | "b" | null;
}

const DIFFICULTY_INFO: { key: Difficulty; label: string; emoji: string; blurb: string }[] = [
  { key: "easy", label: "Easy", emoji: "🌱", blurb: "A gentle, beatable opponent." },
  { key: "medium", label: "Medium", emoji: "⚔️", blurb: "A real challenge." },
  { key: "hard", label: "Hard", emoji: "🔥", blurb: "Only for Kingdom Champions!" },
];

export default function FreePlayPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [gameKey, setGameKey] = useState(0);

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

      const completedDays = await getCompletedDays(supabase, child.id);
      const total = LESSONS.length;

      if (completedDays.length < total) {
        setView({ status: "locked", completed: completedDays.length, total });
      } else {
        setView({ status: "picking-difficulty" });
      }
    }
    load();
  }, [router]);

  function startGame(difficulty: Difficulty) {
    setGameKey((k) => k + 1);
    setView({ status: "playing", difficulty });
  }

  function handleGameOver(difficulty: Difficulty, result: GameResult) {
    setView({ status: "game-over", difficulty, result });
  }

  if (view.status === "loading") {
    return <main className="min-h-screen" />;
  }

  if (view.status === "locked") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
        <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
          <span className="text-6xl">🔒</span>
          <h1 className="font-display text-2xl text-kingdom-night">Free Play Arena</h1>
          <p className="font-body text-kingdom-night/70">
            Finish all {view.total} days of the Chess Kingdom Adventure to unlock the Arena!
            You've completed {view.completed} of {view.total} so far.
          </p>
          <Link href="/kingdom-map">
            <Button>Back to the Kingdom Map →</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (view.status === "picking-difficulty") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
        <h1 className="font-display text-3xl text-kingdom-night text-center">
          Free Play Arena ⚔️
        </h1>
        <p className="font-body text-kingdom-night/70 text-center max-w-sm">
          Choose your opponent's strength and play a full game, start to finish!
        </p>
        <div className="grid grid-cols-1 gap-4 max-w-sm w-full">
          {DIFFICULTY_INFO.map((d) => (
            <button
              key={d.key}
              onClick={() => startGame(d.key)}
              className="flex items-center gap-4 rounded-card bg-white/85 shadow-toy p-5 text-left"
            >
              <span className="text-4xl">{d.emoji}</span>
              <div>
                <p className="font-display text-lg text-kingdom-night">{d.label}</p>
                <p className="font-body text-sm text-kingdom-night/60">{d.blurb}</p>
              </div>
            </button>
          ))}
        </div>
        <Link
          href="/kingdom-map"
          className="font-body text-sm text-kingdom-night/40 underline underline-offset-2"
        >
          Back to the Kingdom Map
        </Link>
      </main>
    );
  }

  if (view.status === "playing") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 py-10">
        <h1 className="font-display text-2xl text-kingdom-night text-center capitalize">
          {view.difficulty} Match
        </h1>
        <ChessBoard
          key={gameKey}
          playableColor="w"
          opponent="stockfish"
          difficulty={view.difficulty}
          size={400}
          onGameOver={(result) => handleGameOver(view.difficulty, result)}
        />
        <Button
          variant="ghost"
          onClick={() => setView({ status: "picking-difficulty" })}
        >
          Change Difficulty
        </Button>
      </main>
    );
  }

  // status === "game-over"
  const { result, difficulty } = view;
  const playerWon = result.isCheckmate && result.winner === "w";
  const opponentWon = result.isCheckmate && result.winner === "b";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <span className="text-6xl">{playerWon ? "🏆" : opponentWon ? "🤔" : "🤝"}</span>
        <h1 className="font-display text-2xl text-kingdom-night">
          {playerWon
            ? "Checkmate — You Won!"
            : opponentWon
            ? "Checkmate — Try Again!"
            : "It's a Draw!"}
        </h1>
        <p className="font-body text-kingdom-night/70">
          {playerWon
            ? "Fantastic game! You outplayed the opponent."
            : opponentWon
            ? "So close! Every game teaches you something new."
            : "A hard-fought battle with no winner this time."}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => startGame(difficulty)}>Play Again</Button>
          <Button variant="ghost" onClick={() => setView({ status: "picking-difficulty" })}>
            Change Difficulty
          </Button>
        </div>
        <Link
          href="/kingdom-map"
          className="font-body text-sm text-kingdom-night/40 underline underline-offset-2"
        >
          Back to the Kingdom Map
        </Link>
      </Card>
    </main>
  );
}
