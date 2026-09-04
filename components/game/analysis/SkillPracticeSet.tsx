"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { getSkill } from "@/lib/analysis/skills";
import { moveWasFork, moveWasHanging } from "@/lib/chessMind/patternVerification";
import { createClient } from "@/lib/supabase/client";
import { recordChessMindSolve } from "@/lib/supabase/queries";
import type { PracticeRecommendation, PracticeBoardItem } from "@/lib/training/recommendation";

/**
 * The personalized-practice runner shown after "Practice this skill" in the
 * Game Review.
 *
 * - Board items are verified WITHOUT an engine, using exactly the checks
 *   already trusted elsewhere in the app: `isCheckmate` straight off
 *   ChessBoard's onMove, and moveWasFork / moveWasHanging from
 *   lib/chessMind/patternVerification.ts (the same functions /chess-mind/
 *   pattern uses).
 * - Lesson items are honest links to existing Academy / Chess Mind
 *   lessons — never faked as a one-move puzzle.
 * - Solve recording: only `pattern:` board items call recordChessMindSolve
 *   (module "pattern" — a genuine pattern solve, same as the minigame).
 *   Mate-puzzle solves are NOT written to puzzle_library_solves, because
 *   this isn't the Trainer or the Daily Challenge and mislabelling the
 *   source would pollute that history. Persistent per-skill progress is a
 *   later phase.
 *
 * The board sits in a normal scroll column and is width-bounded
 * (max-w + ChessBoard's own min(size,100%) clamp), so growing feedback
 * text never shrinks it and nothing overflows horizontally.
 */

type ItemState = "unsolved" | "solved";

function verifyBoardMove(
  item: PracticeBoardItem,
  opts: { fen: string; isCheckmate: boolean; from: Square; to: Square }
): boolean {
  switch (item.check.type) {
    case "checkmate":
      return opts.isCheckmate;
    case "fork":
      return moveWasFork(item.fen, opts.from, opts.to);
    case "hanging":
      return moveWasHanging(item.fen, opts.from, opts.to);
    case "check":
      if (opts.isCheckmate) return true;
      try {
        return new Chess(opts.fen).isCheck();
      } catch {
        return false;
      }
  }
}

export function SkillPracticeSet({
  recommendation,
  childId,
  boardSkinId,
  pieceSetId,
  onComplete,
  onPlayAgain,
  onBackToReview,
}: {
  recommendation: PracticeRecommendation;
  childId?: string | null;
  boardSkinId?: string;
  pieceSetId?: string;
  /** Fired once when the set finishes — (skill, board-item attempts, correct).
   * Used to persist a per-skill practice signal (Phase 26). */
  onComplete?: (skill: PracticeRecommendation["skill"], attempts: number, correct: number) => void;
  onPlayAgain: () => void;
  onBackToReview: () => void;
}) {
  const skill = getSkill(recommendation.skill);
  const items = recommendation.items;
  const boardCount = useMemo(() => items.filter((i) => i.kind === "board").length, [items]);

  const [index, setIndex] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [states, setStates] = useState<Record<number, ItemState>>({});
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [finished, setFinished] = useState(items.length === 0);
  const reportedRef = useRef(false);

  const item = items[index];
  const correctCount = Object.values(states).filter((s) => s === "solved").length;

  // Report the outcome once, the first render the set is finished.
  useEffect(() => {
    if (!finished || reportedRef.current) return;
    reportedRef.current = true;
    if (boardCount > 0) onComplete?.(recommendation.skill, boardCount, correctCount);
  }, [finished, boardCount, correctCount, onComplete, recommendation.skill]);

  function handleBoardMove(opts: {
    fen: string;
    san: string;
    isCheckmate: boolean;
    from: Square;
    to: Square;
  }) {
    if (item.kind !== "board" || feedback === "correct") return;
    const ok = verifyBoardMove(item, opts);
    if (ok) {
      setFeedback("correct");
      const next = { ...states, [index]: "solved" as ItemState };
      setStates(next);
      if (childId && item.id.startsWith("pattern:")) {
        recordChessMindSolve(createClient(), childId, "pattern").catch(() => {});
      }
    } else {
      setFeedback("wrong");
      // Reset the position so they can try again.
      setBoardKey((k) => k + 1);
    }
  }

  function nextItem() {
    if (index + 1 >= items.length) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setBoardKey((k) => k + 1);
    setFeedback("idle");
  }

  // --- Completion ---
  if (finished) {
    const solvedBoards = correctCount;
    const totalBoards = boardCount;
    return (
      <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 w-full max-w-md flex flex-col items-center gap-4 text-center">
        <span className="text-4xl" aria-hidden="true">
          {skill.emoji}
        </span>
        <p className="font-classic-display text-xl text-premium-ivory">Nice work!</p>
        <p className={`${TEXT.meta} text-premium-gold`}>{skill.name}</p>
        {totalBoards > 0 ? (
          <p className="font-classic-display text-2xl text-premium-gold">
            {solvedBoards} / {totalBoards} correct
          </p>
        ) : (
          <p className={TEXT.body}>You worked through the {skill.name.toLowerCase()} lesson.</p>
        )}
        <p className={TEXT.body}>
          {totalBoards === 0
            ? skill.principle
            : solvedBoards === totalBoards
              ? `You're getting sharper at ${skill.description.toLowerCase()}`
              : `Keep practicing — ${skill.principle.toLowerCase()}`}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button tone="premium" onClick={onPlayAgain}>
            Play Again
          </Button>
          <Button tone="premium" variant="ghost" onClick={onBackToReview}>
            Back to Review
          </Button>
        </div>
      </div>
    );
  }

  // --- Runner ---
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4">
      <div className="text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>{recommendation.headline}</p>
        <p className={TEXT.body}>{recommendation.subhead}</p>
      </div>

      {recommendation.coverageNote && (
        <p className="rounded-premiumBtn bg-premium-navyLight/50 border border-white/5 px-3 py-2 font-classic-body text-xs text-premium-ivory/60 text-center">
          {recommendation.coverageNote}
        </p>
      )}

      <p className={TEXT.caption}>
        Activity {index + 1} of {items.length}
      </p>

      {item.kind === "board" ? (
        <div className="w-full flex flex-col items-center gap-3">
          <p className="font-classic-body text-[11px] uppercase tracking-wide text-premium-gold">{item.sourceLabel}</p>
          <p className={`${TEXT.body} text-center`}>{item.prompt}</p>
          <div className="w-full max-w-[420px] mx-auto">
            <ChessBoard
              key={`practice-${boardKey}`}
              fen={item.fen}
              playableColor={item.playerColor}
              size={420}
              boardSkinId={boardSkinId}
              pieceSetId={pieceSetId}
              onMove={handleBoardMove}
            />
          </div>

          {feedback === "correct" && (
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="font-classic-display text-base text-emerald-300">✓ Correct!</p>
              <Button tone="premium" onClick={nextItem}>
                {index + 1 >= items.length ? "Finish" : "Next Activity →"}
              </Button>
            </div>
          )}
          {feedback === "wrong" && (
            <div className="flex flex-col items-center gap-1">
              <p className="font-classic-body text-sm text-premium-gold text-center">
                Not quite — take another look and try again.
              </p>
              <button
                type="button"
                onClick={nextItem}
                className="min-h-[44px] font-classic-body text-xs text-premium-ivory/45 underline underline-offset-2"
              >
                Skip this one →
              </button>
            </div>
          )}
          {feedback === "idle" && <p className={TEXT.caption}>Make your move on the board.</p>}
        </div>
      ) : (
        <div className="w-full rounded-premiumCard bg-premium-navy border border-premium-gold/15 shadow-premiumCard p-5 flex flex-col gap-3">
          <p className="font-classic-display text-base text-premium-ivory">{item.title}</p>
          <p className={TEXT.body}>{item.description}</p>
          <Link
            href={item.href}
            className="inline-flex items-center min-h-[44px] font-classic-body text-sm text-premium-gold underline underline-offset-2"
          >
            Open lesson →
          </Link>
          <Button tone="premium" variant="ghost" onClick={nextItem}>
            {index + 1 >= items.length ? "Finish" : "Next Activity →"}
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setFinished(true)}
        className="min-h-[44px] font-classic-body text-xs text-premium-ivory/45 underline underline-offset-2"
      >
        Skip practice
      </button>
    </div>
  );
}
