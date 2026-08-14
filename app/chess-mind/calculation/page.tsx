"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import {
  CALCULATION_LEVELS,
  CalculationChallenge,
  CalculationLevelNumber,
  getCalculationChallengesForLevel,
} from "@/content/chessMindCalculation";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import type { Square } from "chess.js";

/** chess.js rejects a move object that specifies `promotion` when the
 * moved piece isn't actually a pawn reaching the back rank (throws
 * "Invalid move" instead of just ignoring the irrelevant field) — none of
 * this category's scripted lines involve promotion, but every move here
 * goes through this helper rather than hardcoding `promotion: "q""`
 * unconditionally, so a king/knight/rook/bishop/queen move never trips it. */
function applyMove(game: Chess, from: string, to: string) {
  const piece = game.get(from as Square);
  const needsPromotion = piece?.type === "p" && (to.endsWith("8") || to.endsWith("1"));
  return game.move(needsPromotion ? { from, to, promotion: "q" } : { from, to });
}

function pickChallenge(level: CalculationLevelNumber, excludeId?: string): CalculationChallenge {
  const pool = getCalculationChallengesForLevel(level).filter((c) => c.id !== excludeId);
  const fullPool = pool.length > 0 ? pool : getCalculationChallengesForLevel(level);
  return fullPool[Math.floor(Math.random() * fullPool.length)];
}

export default function CalculationPage() {
  const [level, setLevel] = useState<CalculationLevelNumber>(1);
  const [challenge, setChallenge] = useState<CalculationChallenge | null>(null);
  const [displayFen, setDisplayFen] = useState<string>("");
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<"playing" | "revealing" | "correct" | "incorrect">("playing");
  const [choiceAnswer, setChoiceAnswer] = useState<string | null>(null);
  const [solved, setSolved] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [boardKey, setBoardKey] = useState(0);

  useEffect(() => {
    startChallenge(pickChallenge(1));
    async function loadChild() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.child) {
        setChildId(resolution.child.id);
        setBoardSkinId(resolution.child.board_skin_id);
        setPieceSetId(resolution.child.piece_set_id);
      }
    }
    loadChild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startChallenge(c: CalculationChallenge) {
    setChallenge(c);
    setDisplayFen(c.fen);
    setStepIndex(0);
    setStatus("playing");
    setChoiceAnswer(null);
    setBoardKey((k) => k + 1);
  }

  function changeLevel(newLevel: CalculationLevelNumber) {
    setLevel(newLevel);
    startChallenge(pickChallenge(newLevel));
  }

  function markSolved() {
    setSolved((s) => s + 1);
    if (childId) recordChessMindSolve(createClient(), childId, "calculation").catch(() => {});
  }

  function handleMove(opts: { from: Square; to: Square }) {
    if (!challenge || challenge.kind !== "sequence" || status !== "playing") return;
    const step = challenge.steps[stepIndex];
    if (opts.from !== step.from || opts.to !== step.to) {
      setStatus("incorrect");
      return;
    }

    const isFinalStep = stepIndex === challenge.steps.length - 1;

    if (challenge.revealReplyAfter && step.opponentReplyFrom && step.opponentReplyTo) {
      // Level 3: the player found the move — now reveal the scripted reply
      // on the board (read-only) so they see the resulting position,
      // instead of the exercise just ending immediately.
      const g = new Chess(displayFen);
      applyMove(g, step.from, step.to);
      applyMove(g, step.opponentReplyFrom, step.opponentReplyTo);
      setDisplayFen(g.fen());
      setBoardKey((k) => k + 1);
      setStatus("correct");
      markSolved();
      return;
    }

    if (isFinalStep) {
      setStatus("correct");
      markSolved();
      return;
    }

    // Not the final step — apply the scripted opponent reply and continue
    // the same exercise from the resulting position.
    const g = new Chess(displayFen);
    applyMove(g, step.from, step.to);
    if (step.opponentReplyFrom && step.opponentReplyTo) {
      applyMove(g, step.opponentReplyFrom, step.opponentReplyTo);
    }
    setDisplayFen(g.fen());
    setStepIndex((i) => i + 1);
    setBoardKey((k) => k + 1);
  }

  function handleChoice(optionKey: string) {
    if (!challenge || challenge.kind !== "choice" || status !== "playing") return;
    setChoiceAnswer(optionKey);
    const option = challenge.options.find((o) => `${o.from}-${o.to}` === optionKey);
    if (option?.isBest) {
      setStatus("correct");
      markSolved();
    } else {
      setStatus("incorrect");
    }
  }

  function tryAgain() {
    if (!challenge) return;
    startChallenge(challenge);
  }

  function nextChallenge() {
    if (!challenge) return;
    startChallenge(pickChallenge(level, challenge.id));
  }

  if (!challenge) {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  const levelInfo = CALCULATION_LEVELS.find((l) => l.level === level)!;
  const movesRemaining = challenge.kind === "sequence" ? challenge.steps.length - stepIndex : 0;
  const boardReadOnly = challenge.kind === "choice" || status !== "playing";
  const boardPlayableColor = challenge.kind === "sequence" ? challenge.sideToMove : undefined;

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className="font-classic-display text-3xl text-premium-ivory">Calculation</h1>
          <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">
            Find the best move, then look further ahead.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center max-w-md" role="group" aria-label="Choose a level">
          {CALCULATION_LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              onClick={() => changeLevel(l.level)}
              className={`font-classic-body text-xs rounded-full px-3 py-1.5 border transition-colors ${
                l.level === level
                  ? "bg-premium-gold/20 border-premium-gold/50 text-premium-gold"
                  : "bg-premium-navy/60 border-white/10 text-premium-ivory/60 hover:border-white/25"
              }`}
            >
              {l.level}
            </button>
          ))}
        </div>
        <p className="font-classic-body text-xs text-premium-ivory/50 -mt-3">{levelInfo.description}</p>

        <div className="flex items-center gap-3">
          <span className="font-classic-body text-[10px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full px-3 py-1">
            {levelInfo.title}
          </span>
          <span className="font-classic-body text-xs text-premium-ivory/40">Solved: {solved}</span>
        </div>

        <div className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-4">
          <p className="font-classic-display text-base text-premium-ivory text-center">{challenge.prompt}</p>

          <ChessBoard
            key={boardKey}
            fen={displayFen}
            size={320}
            readOnly={boardReadOnly}
            playableColor={boardPlayableColor}
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={handleMove}
          />

          {challenge.kind === "choice" && (
            <div className="flex gap-2 flex-wrap justify-center">
              {challenge.options.map((opt) => {
                const key = `${opt.from}-${opt.to}`;
                const isSelected = choiceAnswer === key;
                const isCorrectChoice = status !== "playing" && opt.isBest;
                return (
                  <button
                    key={key}
                    disabled={status !== "playing"}
                    onClick={() => handleChoice(key)}
                    className={`font-classic-display text-sm rounded-premiumBtn px-4 py-2 border ${
                      isCorrectChoice
                        ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                        : isSelected
                        ? "border-red-400/40 bg-red-400/10 text-red-300"
                        : "border-premium-ivory/15 text-premium-ivory/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {status === "playing" && challenge.kind === "sequence" && challenge.steps.length > 1 && (
            <p className="font-classic-body text-xs text-premium-ivory/40 normal-case">
              {movesRemaining === challenge.steps.length
                ? `Calculate ${movesRemaining} move${movesRemaining > 1 ? "s" : ""} ahead.`
                : `Good — ${movesRemaining} move${movesRemaining > 1 ? "s" : ""} to go.`}
            </p>
          )}

          {status !== "playing" && (
            <div className="flex flex-col items-center gap-3">
              <p
                className={`font-classic-body text-sm text-center ${
                  status === "correct" ? "text-premium-gold" : "text-premium-ivory/70"
                }`}
              >
                {status === "correct"
                  ? `${challenge.successMessage} ${challenge.explanation}`
                  : `${challenge.failureMessage}`}
              </p>
              {status === "correct" ? (
                <Button onClick={nextChallenge}>Next →</Button>
              ) : (
                <Button variant="secondary" onClick={tryAgain}>
                  Try Again
                </Button>
              )}
            </div>
          )}
        </div>

        <Link href="/chess-mind" className="font-body text-sm text-premium-ivory/40 underline underline-offset-2">
          Back to Chess Mind
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}
