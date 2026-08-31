"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { PATTERN_CHALLENGES, PatternChallenge } from "@/content/chessMindPatterns";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { TEXT } from "@/lib/designSystem";
import { Button } from "@/components/ui/Button";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { moveWasFork, moveWasHanging } from "@/lib/chessMind/patternVerification";
import type { Square } from "chess.js";

const TYPE_LABEL: Record<PatternChallenge["type"], string> = {
  fork: "Fork",
  pin: "Pin",
  hanging: "Hanging Piece",
  check: "Check",
  checkmate: "Checkmate",
};

function pickChallenge(excludeId?: string): PatternChallenge {
  const pool = PATTERN_CHALLENGES.filter((c) => c.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)] ?? PATTERN_CHALLENGES[0];
}

export default function PatternRecognitionPage() {
  const [challenge, setChallenge] = useState<PatternChallenge | null>(null);
  const [status, setStatus] = useState<"playing" | "correct" | "incorrect">("playing");
  const [pinAnswer, setPinAnswer] = useState<string | null>(null);
  const [solved, setSolved] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [boardKey, setBoardKey] = useState(0);

  useEffect(() => {
    setChallenge(pickChallenge());
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

  function markSolved() {
    setSolved((s) => s + 1);
    if (childId) recordChessMindSolve(createClient(), childId, "pattern").catch(() => {});
  }

  function handleMove(opts: { fen: string; san: string; isCheckmate: boolean; from: Square; to: Square }) {
    if (!challenge || status !== "playing") return;

    // Semantic verification of the ACTUAL move played — not a string match
    // against one pre-chosen answer, so a different legal move that
    // genuinely satisfies the pattern (e.g. an alternate fork) still
    // counts as correct. Uses the position as it was BEFORE this move.
    let isCorrect = false;
    if (challenge.type === "checkmate") {
      isCorrect = opts.isCheckmate;
    } else if (challenge.type === "check") {
      isCorrect = !opts.isCheckmate && new Chess(opts.fen).inCheck();
    } else if (challenge.type === "fork") {
      isCorrect = moveWasFork(challenge.fen, opts.from, opts.to);
    } else if (challenge.type === "hanging") {
      isCorrect = moveWasHanging(challenge.fen, opts.from, opts.to);
    }

    if (isCorrect) {
      setStatus("correct");
      markSolved();
    } else {
      setStatus("incorrect");
    }
  }

  function handlePinChoice(square: string) {
    if (!challenge || status !== "playing") return;
    setPinAnswer(square);
    if (square === challenge.targetSquare) {
      setStatus("correct");
      markSolved();
    } else {
      setStatus("incorrect");
    }
  }

  function nextChallenge() {
    setChallenge((c) => pickChallenge(c?.id));
    setStatus("playing");
    setPinAnswer(null);
    setBoardKey((k) => k + 1);
  }

  if (!challenge) {
    return (
      <>
        <ScreenSkeleton maxWidth="compact" />
        <PrimaryNav />
      </>
    );
  }

  const sideToMove = new Chess(challenge.fen).turn();

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Pattern Recognition</h1>
          <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">
            Real positions, real patterns — spot what's really there.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-classic-body text-[10px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full px-3 py-1">
            {TYPE_LABEL[challenge.type]}
          </span>
          <span className="font-classic-body text-xs text-premium-ivory/40">Solved: {solved}</span>
        </div>

        <div className="mx-auto w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-4">
          <p className="font-classic-display text-base text-premium-ivory text-center">
            {challenge.prompt}
          </p>

          <ChessBoard
            key={boardKey}
            fen={challenge.fen}
            size={320}
            readOnly={challenge.type === "pin" || status !== "playing"}
            playableColor={challenge.type !== "pin" ? sideToMove : undefined}
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={handleMove}
          />

          {challenge.type === "pin" && (
            <div className="flex gap-2 flex-wrap justify-center">
              {challenge.pinChoices!.map((square) => {
                const isSelected = pinAnswer === square;
                const isCorrectChoice = status !== "playing" && square === challenge.targetSquare;
                return (
                  <button
                    key={square}
                    disabled={status !== "playing"}
                    onClick={() => handlePinChoice(square)}
                    className={`font-classic-display text-sm rounded-premiumBtn px-4 py-2 border ${
                      isCorrectChoice
                        ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                        : isSelected
                        ? "border-red-400/40 bg-red-400/10 text-red-300"
                        : "border-premium-ivory/15 text-premium-ivory/80"
                    }`}
                  >
                    {square}
                  </button>
                );
              })}
            </div>
          )}

          {status !== "playing" && (
            <div className="flex flex-col items-center gap-3">
              <p
                className={`font-classic-body text-sm text-center ${
                  status === "correct" ? "text-premium-gold" : "text-premium-ivory/70"
                }`}
              >
                {status === "correct"
                  ? `Exactly right! ${challenge.explanation}`
                  : `Not quite — ${challenge.explanation}`}
              </p>
              <Button onClick={nextChallenge}>Next →</Button>
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
