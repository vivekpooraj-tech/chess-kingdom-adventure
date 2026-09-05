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
 * What the child's attempted move was, relative to the engine's suggestion.
 * "other" is deliberately never called wrong: the engine returns ONE strong
 * option, not the only good move, and the rest of this screen is careful to
 * say so. Telling a child their reasonable move was "wrong" on that basis
 * would be both discouraging and, sometimes, untrue.
 */
type AttemptResult =
  | { kind: "found"; san: string }
  | { kind: "repeated"; san: string }
  | { kind: "other"; san: string }
  | { kind: "unknown"; san: string };

const ATTEMPTS_BEFORE_HINT = 2;

/**
 * "Review Position" — step back up to 3 moves before a mistake to see how
 * the position got there, attempt the move yourself, then reveal the better
 * move. The board is the existing ChessBoard (no second board
 * implementation) fed a `fen` straight from the already-stored per-ply
 * history — no live game instance exists here to accidentally mutate, so
 * the original completed game/analysis data can't be altered by this UI
 * even in principle, not just by convention.
 *
 * The "try it yourself" step exists because this screen used to ask "What
 * would you play here?" over a read-only board — the child could only ever
 * reveal the answer, never attempt it. Recognising a good move when shown it
 * is a much weaker skill than finding it, and finding it is the one that
 * transfers to their next game. Attempting is opt-in: revealing directly is
 * still one tap away for a child who is stuck or not in the mood.
 *
 * Attempts use ChessBoard with `playableColor` and no `opponent`, so exactly
 * one ply is accepted and nothing replies — this is a single-move question,
 * not a game continuation.
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
  const [trying, setTrying] = useState(false);
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  // Remounting the board is what actually resets it to the original position.
  const [boardKey, setBoardKey] = useState(0);
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function resetAttempt() {
    setTrying(false);
    setAttempt(null);
    setAttemptCount(0);
    setBoardKey((k) => k + 1);
  }

  function goTo(index: number) {
    setStepIndex(index);
    if (index !== steps.length - 1) {
      setShowBetterMove(false);
      resetAttempt();
    }
  }

  function handleAttempt(san: string) {
    const best = mistake.bestMove?.san;
    const next: AttemptResult = !best
      ? { kind: "unknown", san }
      : san === best
        ? { kind: "found", san }
        : san === mistake.san
          ? { kind: "repeated", san }
          : { kind: "other", san };
    setAttempt(next);
    setAttemptCount((n) => n + 1);
    if (next.kind === "found") setShowBetterMove(true);
  }

  function tryAgain() {
    setAttempt(null);
    setBoardKey((k) => k + 1);
  }

  return (
    <div className="rounded-premiumCard bg-premium-navyLight/40 border border-premium-gold/15 p-4 flex flex-col items-center gap-3 w-full">
      <p className={`${TEXT.meta} text-premium-gold`}>Mistake Review — Reviewing Game</p>

      {/* Read-only except while the child is actively attempting the move on
          the mistake step. No resign/draw/clock/difficulty controls belong
          here; this is review, not play. Passing no `opponent` means nothing
          replies — one ply is accepted and the attempt is judged. */}
      <ChessBoard
        key={boardKey}
        readOnly={!trying || attempt !== null}
        fen={step.fenBefore}
        playableColor={trying ? step.mover : undefined}
        onMove={trying ? ({ san }) => handleAttempt(san) : undefined}
        size={BOARD_SIZE}
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
      />

      <div className="flex items-center gap-2" role="group" aria-label="Step through positions before the mistake">
        <button
          type="button"
          onClick={() => goTo(0)}
          disabled={isFirst}
          aria-label="3 moves back"
          className="w-10 h-10 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
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

          {mistake.bestMove && !showBetterMove && !trying && (
            <div className="flex flex-col items-stretch gap-2 w-full">
              <Button tone="premium" onClick={() => setTrying(true)}>
                Try it yourself
              </Button>
              <Button tone="premium" variant="ghost" onClick={() => setShowBetterMove(true)}>
                Show Better Move
              </Button>
            </div>
          )}

          {mistake.bestMove && trying && !showBetterMove && (
            <div className="flex flex-col items-stretch gap-2 w-full">
              {attempt === null ? (
                <p className={`${TEXT.body} text-center`}>
                  Your turn — play the move you think is stronger.
                </p>
              ) : (
                <>
                  <p
                    className={`rounded-premiumBtn px-3 py-2 font-classic-body text-sm text-center ${
                      attempt.kind === "found"
                        ? "border border-premium-gold/40 bg-premium-gold/10 text-premium-gold"
                        : "border border-white/10 bg-premium-navy text-premium-ivory/80"
                    }`}
                  >
                    {attempt.kind === "found" && `${attempt.san} — that's the one. You found it yourself.`}
                    {attempt.kind === "repeated" &&
                      `${attempt.san} is the move you played in the game. Take another look.`}
                    {attempt.kind === "other" &&
                      `${attempt.san} isn't the move the engine picked here. Want another go?`}
                    {attempt.kind === "unknown" && `You played ${attempt.san}.`}
                  </p>
                  {attempt.kind !== "found" && (
                    <div className="flex flex-col items-stretch gap-2">
                      <Button tone="premium" variant="ghost" onClick={tryAgain}>
                        Try again
                      </Button>
                      {/* Never let a child get stuck: after a couple of goes the
                          answer is offered rather than waited for. */}
                      {attemptCount >= ATTEMPTS_BEFORE_HINT && (
                        <Button tone="premium" onClick={() => setShowBetterMove(true)}>
                          Show me the move
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {mistake.bestMove && showBetterMove && (
            <div className="rounded-premiumBtn bg-premium-navy border border-premium-gold/15 p-3 flex flex-col gap-1 w-full">
              <p className="font-classic-body text-sm text-premium-ivory/70">
                Your move: <span className="text-premium-ivory">{step.san}</span>
              </p>
              <p className="font-classic-body text-sm text-premium-gold">
                Better move: {formatMoveNumber(step.ply, step.mover)} {mistake.bestMove.san}
              </p>
              {mistake.whyBetter && <p className={TEXT.body}>{mistake.whyBetter}</p>}
              <p className={TEXT.caption}>Remember: {mistake.whatToNotice}</p>
            </div>
          )}
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
