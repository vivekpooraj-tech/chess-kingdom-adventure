"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHESS_MATH_POSITIONS } from "@/content/chessMindMath";
import { generateChoices } from "@/lib/chessMind/choices";
import {
  generatePieceValueQuestion,
  generateMaterialCountQuestion,
  generateSquareColorQuestion,
  generateCoordinateQuestion,
  generateKnightDistanceQuestion,
  MathQuestion,
} from "@/lib/chessMind/mathQuestions";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { TEXT } from "@/lib/designSystem";
import { Button } from "@/components/ui/Button";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

type Tier = "Beginner" | "Intermediate" | "Advanced";

type QuestionKind =
  | "piece-value"
  | "square-color"
  | "coordinate"
  | "knight-moves"
  | "material-count"
  | "knight-distance"
  | "legal-moves";

// Which question kinds are in play at each tier — new, slightly harder
// formats unlock as the child gets more right, echoing the difficulty
// ramp used across the rest of Chess Mind.
const TIER_KINDS: Record<Tier, QuestionKind[]> = {
  Beginner: ["piece-value", "square-color", "coordinate", "knight-moves"],
  Intermediate: ["piece-value", "square-color", "coordinate", "knight-moves", "material-count", "knight-distance"],
  Advanced: ["material-count", "knight-distance", "legal-moves", "knight-moves"],
};

const KNIGHT_DISTANCE_RANGE: Record<Tier, [number, number]> = {
  Beginner: [1, 2],
  Intermediate: [1, 3],
  Advanced: [3, 6],
};

interface Round {
  question: string;
  answer: string;
  choices: string[];
  fen?: string;
}

function generateRound(tier: Tier): Round {
  const kinds = TIER_KINDS[tier];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];

  if (kind === "legal-moves" || kind === "knight-moves") {
    const position = CHESS_MATH_POSITIONS[Math.floor(Math.random() * CHESS_MATH_POSITIONS.length)];
    if (kind === "legal-moves") {
      return {
        question: "How many legal moves does White have in this position?",
        answer: String(position.legalMoveCount),
        choices: generateChoices(position.legalMoveCount, 4, 6).map(String),
        fen: position.fen,
      };
    }
    return {
      question: `How many squares can the Knight on ${position.knightSquare} reach from here?`,
      answer: String(position.knightMoveCount),
      choices: generateChoices(position.knightMoveCount, 4, 3).map(String),
      fen: position.fen,
    };
  }

  if (kind === "material-count") {
    const position = CHESS_MATH_POSITIONS[Math.floor(Math.random() * CHESS_MATH_POSITIONS.length)];
    const q = generateMaterialCountQuestion(position.fen);
    return { question: q.prompt, answer: q.correctAnswer, choices: q.choices, fen: q.fen };
  }

  let q: MathQuestion;
  if (kind === "piece-value") q = generatePieceValueQuestion();
  else if (kind === "square-color") q = generateSquareColorQuestion();
  else if (kind === "coordinate") q = generateCoordinateQuestion();
  else {
    const [min, max] = KNIGHT_DISTANCE_RANGE[tier];
    q = generateKnightDistanceQuestion(min, max);
  }
  return { question: q.prompt, answer: q.correctAnswer, choices: q.choices, fen: q.fen };
}

export default function ChessMathematicsPage() {
  const [tier, setTier] = useState<Tier>("Beginner");
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  // Starts null rather than generated during initial render — Math.random()
  // would run once on the server and again on the client, producing a
  // hydration mismatch. Generating the first round client-side only avoids it.
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setRound(generateRound("Beginner"));
    async function loadChild() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) return;
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.child) {
        setChildId(resolution.child.id);
        setBoardSkinId(resolution.child.board_skin_id);
        setPieceSetId(resolution.child.piece_set_id);
      }
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
    if (choice === round.answer) {
      setSolved((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak % 3 === 0) setTier((t) => nextTier(t));
      if (childId) {
        recordChessMindSolve(createClient(), childId, "mathematics").catch(() => {});
      }
    } else {
      setStreak(0);
    }
  }

  function nextRound() {
    setRound(generateRound(tier));
    setSelected(null);
  }

  if (!round) {
    return (
      <>
        <ScreenSkeleton maxWidth="compact" />
        <PrimaryNav />
      </>
    );
  }

  const isCorrect = selected !== null && selected === round.answer;

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Chess Mathematics</h1>
          <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">
            Real positions, real counting — every answer here comes straight from the rules of
            chess.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-classic-body text-[10px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full px-3 py-1">
            {tier}
          </span>
          <span className="font-classic-body text-xs text-premium-ivory/40">Solved: {solved}</span>
        </div>

        <div className="mx-auto w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-5">
          {round.fen && (
            <ChessBoard
              fen={round.fen}
              size={220}
              readOnly
              boardSkinId={boardSkinId}
              pieceSetId={pieceSetId}
            />
          )}
          <p className="font-classic-display text-lg text-premium-ivory text-center">
            {round.question}
          </p>

          <div className="grid grid-cols-4 gap-2 w-full">
            {round.choices.map((choice) => {
              const isThisCorrect = selected !== null && choice === round.answer;
              const isThisWrong = selected === choice && choice !== round.answer;
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
                {isCorrect ? "Exactly right! 🔢" : `Close — the answer was ${round.answer}.`}
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
      </Screen>
      <PrimaryNav />
    </>
  );
}
