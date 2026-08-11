"use client";

import { useMemo, useState } from "react";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { formatMoveNumber } from "@/lib/analysis/format";
import { buildReviewSteps } from "@/lib/analysis/reviewSteps";
import type { CompletedGameRecord } from "@/lib/analysis/gameAnalysis";
import type { EnrichedMistake } from "./MistakeCard";

const BOARD_SIZE = 260;

/**
 * "Review Position" — step back up to 3 moves before a mistake to see how
 * the position got there, then optionally reveal the better move. The
 * board is `ChessBoard readOnly` (the existing component, no second board
 * implementation) fed a `fen` straight from the already-stored per-ply
 * history — no live game instance exists here to accidentally mutate, so
 * the original completed game/analysis data can't be altered by this UI
 * even in principle, not just by convention.
 */
export function MistakeReviewStepper({
  mistake,
  record,
  boardSkinId,
  pieceSetId,
}: {
  mistake: EnrichedMistake;
  record: CompletedGameRecord;
  boardSkinId?: string;
  pieceSetId?: string;
}) {
  const steps = useMemo(() => buildReviewSteps(record, mistake), [record, mistake]);
  const [stepIndex, setStepIndex] = useState(steps.length - 1);
  const [showBetterMove, setShowBetterMove] = useState(false);
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function goTo(index: number) {
    setStepIndex(index);
    if (index !== steps.length - 1) setShowBetterMove(false);
  }

  return (
    <div className="rounded-premiumCard bg-premium-navyLight/40 border border-premium-gold/15 p-4 flex flex-col items-center gap-3 w-full">
      <p className={`${TEXT.meta} text-premium-gold`}>Mistake Review — Reviewing Game</p>

      {/* Read-only by construction — see the component doc comment. No
          resign/draw/clock/submit/difficulty controls belong here; this is
          review, not play. */}
      <ChessBoard readOnly fen={step.fenBefore} size={BOARD_SIZE} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />

      <div className="flex items-center gap-2" role="group" aria-label="Step through positions before the mistake">
        <button
          type="button"
          onClick={() => goTo(0)}
          disabled={isFirst}
          aria-label="3 moves back"
          className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={() => goTo(Math.max(0, stepIndex - 1))}
          disabled={isFirst}
          className="rounded-premiumBtn bg-premium-navyLight text-premium-ivory px-3 py-2 text-sm disabled:opacity-30"
        >
          ◀ Previous
        </button>
        <button
          type="button"
          onClick={() => goTo(Math.min(steps.length - 1, stepIndex + 1))}
          disabled={isLast}
          className="rounded-premiumBtn bg-premium-navyLight text-premium-ivory px-3 py-2 text-sm disabled:opacity-30"
        >
          Next ▶
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap justify-center">
        {steps.map((s, i) => (
          <button
            key={s.ply}
            type="button"
            onClick={() => goTo(i)}
            className={`font-classic-body text-xs rounded-premiumBtn px-2.5 py-1.5 transition-colors ${
              i === stepIndex
                ? "bg-premium-gold/20 text-premium-gold border border-premium-gold/40"
                : "bg-premium-navy text-premium-ivory/60 border border-white/5 hover:border-white/15"
            }`}
          >
            {formatMoveNumber(s.ply, s.mover)}
            {s.isMistakeStep && " 🔴"}
          </button>
        ))}
      </div>

      {step.isMistakeStep ? (
        <div className="flex flex-col items-center gap-2 text-center w-full">
          <p className="font-classic-display text-sm text-red-300">🔴 YOUR MISTAKE</p>
          <p className="font-classic-display text-base text-premium-ivory">
            {formatMoveNumber(step.ply, step.mover)} {step.san}
            {mistake.category === "blunder" ? "??" : "?"}
          </p>
          <p className={TEXT.body}>{mistake.explanation}</p>

          {mistake.bestMove &&
            (showBetterMove ? (
              <div className="rounded-premiumBtn bg-premium-navy border border-premium-gold/15 p-3 flex flex-col gap-1 w-full">
                <p className="font-classic-body text-sm text-premium-ivory/70">
                  Your move: <span className="text-premium-ivory">{step.san}</span>
                </p>
                <p className="font-classic-body text-sm text-premium-gold">
                  Better move: {formatMoveNumber(step.ply, step.mover)} {mistake.bestMove.san}
                </p>
                <p className={TEXT.caption}>Why: {mistake.whatToNotice}</p>
              </div>
            ) : (
              <Button tone="premium" variant="ghost" onClick={() => setShowBetterMove(true)}>
                Show Better Move
              </Button>
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-center">
          <p className={`${TEXT.meta} text-premium-gold`}>Position Before Your Mistake</p>
          <p className="font-classic-body text-sm text-premium-ivory">{formatMoveNumber(step.ply, step.mover)}</p>
          <p className={TEXT.caption}>What would you play here? Look at the position carefully.</p>
        </div>
      )}
    </div>
  );
}
