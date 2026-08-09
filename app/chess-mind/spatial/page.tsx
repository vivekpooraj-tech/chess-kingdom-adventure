"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHESS_MATH_POSITIONS } from "@/content/chessMindMath";
import { PATTERN_CHALLENGES } from "@/content/chessMindPatterns";
import {
  generateReachCountQuestion,
  generateOddOneOutQuestion,
  generateCanReachQuestion,
  SpatialQuestion,
} from "@/lib/chessMind/spatialQuestions";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

type Tier = "Beginner" | "Intermediate" | "Advanced";

// Reuses already chess.js-verified positions from other Chess Mind content
// instead of authoring a fourth position bank.
const POSITION_POOL = [
  ...CHESS_MATH_POSITIONS.map((p) => p.fen),
  ...PATTERN_CHALLENGES.map((p) => p.fen),
];

type Generator = (fen: string) => SpatialQuestion | null;

// Odd-one-out needs three real reachable squares to hide the fake among,
// and Can-it-reach reads more naturally once a child already knows how a
// piece's reach is counted — so both unlock after Beginner.
const TIER_GENERATORS: Record<Tier, Generator[]> = {
  Beginner: [generateReachCountQuestion],
  Intermediate: [generateReachCountQuestion, generateCanReachQuestion],
  Advanced: [generateReachCountQuestion, generateCanReachQuestion, generateOddOneOutQuestion],
};

interface Round {
  fen: string;
  question: SpatialQuestion;
}

function pickRound(tier: Tier): Round {
  const generators = TIER_GENERATORS[tier];
  // Not every position/generator pairing yields a question (e.g. a position
  // with no bishops on the board) — retry with a fresh pick rather than show
  // a broken round.
  for (let attempt = 0; attempt < 30; attempt++) {
    const fen = POSITION_POOL[Math.floor(Math.random() * POSITION_POOL.length)];
    const generator = generators[Math.floor(Math.random() * generators.length)];
    const question = generator(fen);
    if (question) return { fen, question };
  }
  // Every position in the pool has at least one sliding piece, so this
  // fallback (first position, first generator) always succeeds.
  const fen = POSITION_POOL[0];
  return { fen, question: generateReachCountQuestion(fen)! };
}

export default function SpatialThinkingPage() {
  const [tier, setTier] = useState<Tier>("Beginner");
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  // Starts null rather than generated during initial render: Math.random()
  // would run once on the server and again on the client, producing
  // different squares each time and triggering a hydration mismatch.
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    setRound(pickRound("Beginner"));
    // Best-effort — this page works fully (session-local scoring) even if
    // resolving the child fails or the visitor somehow isn't signed in;
    // persistence is a bonus, not a gate on playing.
    async function loadChild() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.child) setChildId(resolution.child.id);
    }
    loadChild();
  }, []);

  function nextTier(current: Tier): Tier {
    if (current === "Beginner") return "Intermediate";
    if (current === "Intermediate") return "Advanced";
    return "Advanced";
  }

  function handleSelect(choice: string) {
    if (selected !== null || !round) return;
    setSelected(choice);
    const correct = choice === round.question.correctAnswer;
    if (correct) {
      setSolved((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak % 3 === 0) setTier((t) => nextTier(t));
      if (childId) {
        recordChessMindSolve(createClient(), childId, "spatial").catch(() => {});
      }
    } else {
      setStreak(0);
    }
  }

  function nextRound() {
    setRound(pickRound(tier));
    setSelected(null);
  }

  if (!round) {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  const isCorrect = selected !== null && selected === round.question.correctAnswer;

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className="font-classic-display text-3xl text-premium-ivory">Spatial Thinking</h1>
          <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">
            How pieces move through space — real positions, real reach.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-classic-body text-[10px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full px-3 py-1">
            {tier}
          </span>
          <span className="font-classic-body text-xs text-premium-ivory/40">Solved: {solved}</span>
        </div>

        <div className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-5">
          <ChessBoard fen={round.fen} size={220} readOnly />
          <p className="font-classic-display text-lg text-premium-ivory text-center">
            {round.question.prompt}
          </p>

          <div className="grid grid-cols-4 gap-2 w-full">
            {round.question.choices.map((choice) => {
              const isThisCorrect = selected !== null && choice === round.question.correctAnswer;
              const isThisWrong = selected === choice && choice !== round.question.correctAnswer;
              return (
                <button
                  key={choice}
                  onClick={() => handleSelect(choice)}
                  disabled={selected !== null}
                  className={`font-classic-display text-lg rounded-premiumBtn py-3 border transition-colors ${
                    isThisCorrect
                      ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                      : isThisWrong
                      ? "border-red-400/40 bg-red-400/10 text-red-300"
                      : "border-premium-ivory/15 text-premium-ivory/80"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-classic-body text-sm text-premium-ivory/70">
                {isCorrect ? "Exactly right! 🧭" : `Close — the answer was ${round.question.correctAnswer}.`}
              </p>
              <Button onClick={nextRound}>Next →</Button>
            </div>
          )}
        </div>

        <Link
          href="/chess-mind"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to Chess Mind
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}
