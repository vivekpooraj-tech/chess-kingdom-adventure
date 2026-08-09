"use client";

import { useEffect, useState } from "react";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { RevealQuestion } from "@/lib/chessMind/revealQuestions";

type Stage = "revealing" | "question" | "answered";

/**
 * Shared "show a real position, hide it, ask a real question about it"
 * shell — powers both Memory and Visualization, which differ only in
 * which question generator they pass in and how long the reveal lasts.
 */
export function RevealChallenge({
  fen,
  question,
  revealSeconds,
  solved,
  boardSkinId,
  pieceSetId,
  onCorrect,
  onNext,
}: {
  fen: string;
  question: RevealQuestion;
  revealSeconds: number;
  solved: number;
  boardSkinId?: string;
  pieceSetId?: string;
  onCorrect: () => void;
  onNext: () => void;
}) {
  const [stage, setStage] = useState<Stage>("revealing");
  const [secondsLeft, setSecondsLeft] = useState(revealSeconds);
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    setStage("revealing");
    setSecondsLeft(revealSeconds);
    setAnswered(null);
  }, [fen, revealSeconds]);

  useEffect(() => {
    if (stage !== "revealing") return;
    if (secondsLeft <= 0) {
      setStage("question");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [stage, secondsLeft]);

  function handleAnswer(choice: string) {
    if (answered) return;
    setAnswered(choice);
    setStage("answered");
    if (choice === question.correctAnswer) onCorrect();
  }

  return (
    <div className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-4">
      <span className="font-classic-body text-xs text-premium-ivory/40">Solved: {solved}</span>

      {stage === "revealing" && (
        <>
          <ChessBoard fen={fen} size={300} readOnly boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
          <p className="font-classic-display text-2xl text-premium-gold">{secondsLeft}</p>
          <p className="font-classic-body text-xs text-premium-ivory/50">Memorize the position...</p>
        </>
      )}

      {stage !== "revealing" && (
        <>
          <div className="w-full aspect-square max-w-[300px] rounded-premiumBtn bg-premium-midnightDeep flex items-center justify-center">
            <span className="text-4xl opacity-30">🔒</span>
          </div>
          <p className="font-classic-display text-base text-premium-ivory text-center">
            {question.prompt}
          </p>
          <div className="grid grid-cols-2 gap-2 w-full">
            {question.choices.map((choice) => {
              const isCorrect = answered !== null && choice === question.correctAnswer;
              const isWrong = answered === choice && choice !== question.correctAnswer;
              return (
                <button
                  key={choice}
                  disabled={answered !== null}
                  onClick={() => handleAnswer(choice)}
                  className={`font-classic-display rounded-premiumBtn py-2.5 border ${
                    isCorrect
                      ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                      : isWrong
                      ? "border-red-400/40 bg-red-400/10 text-red-300"
                      : "border-premium-ivory/15 text-premium-ivory/80"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          {stage === "answered" && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-classic-body text-sm text-premium-ivory/70">
                {answered === question.correctAnswer
                  ? "Exactly right! 🧠"
                  : `It was ${question.correctAnswer}.`}
              </p>
              <Button onClick={onNext}>Next →</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
