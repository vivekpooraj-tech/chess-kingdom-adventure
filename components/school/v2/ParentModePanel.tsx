"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { moveMatches } from "@/lib/school/v2/moves";
import type { ParentModeSessionStep } from "@/content/school/types";
import { OllieCoach } from "./Coach";
import { BOARD } from "./steps";
import { PARENT_MODE_LINES } from "@/lib/school/v2/ollieLines";

/**
 * Parent Mode — the emotional centre of Chess School.
 *
 * WHAT IT IS. Two people, one phone, one board. The grown-up is quietly told
 * what to play; the child is told only what to look for. When the child spots
 * the fork, they have not solved a puzzle — they have done it to a person who
 * is sitting right there and did not see it coming.
 *
 * WHY THE PARENT'S TEXT IS HIDDEN FROM THE CHILD. If the child reads "let them
 * fork you", the moment is gone. So the parent's instruction lives behind an
 * explicit hand-over screen: the phone is passed, the grown-up taps to reveal,
 * plays, and passes back. The hand-over is not friction to be optimised away —
 * it is what makes the two people look at each other.
 *
 * WHOSE TURN IT IS comes from the position itself: in Chess School the child
 * always plays White and the grown-up always plays Black, so a beat with Black
 * to move is the grown-up's. That convention is asserted in
 * scripts/test-chess-school-v2.js, so content cannot drift out of it silently.
 *
 * NOTHING LEAVES THE DEVICE. No network, no chat, no accounts for the second
 * player. The grown-up is a person in the room, not a user.
 */
export function ParentModePanel({
  step,
  onComplete,
}: {
  step: ParentModeSessionStep;
  onComplete: () => void;
}) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Bumped after a wrong move so the board resets to the scripted position.
  // The board enforces turn order, so without this a wrong move would leave
  // the other side to move and the right move impossible to play.
  const [boardKey, setBoardKey] = useState(0);

  const beat = step.beats[beatIndex];
  const isParentTurn = useMemo(() => {
    if (!beat) return false;
    try {
      return new Chess(beat.fen).turn() === "b";
    } catch {
      return false;
    }
  }, [beat]);

  if (done || !beat) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-premiumCard border border-premium-gold/35 bg-premium-gold/10 p-6 text-center">
          <p className="text-4xl" aria-hidden="true">
            🎉
          </p>
          <p className="mt-3 font-classic-display text-xl text-premium-ivory">{step.celebration}</p>
        </div>
        <Button tone="premium" block onClick={onComplete}>
          Continue
        </Button>
      </div>
    );
  }

  // The hand-over screen. Deliberately a full stop: nothing about the position
  // is visible until the right person is holding the phone.
  if (isParentTurn && !revealed) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-premiumCard border border-white/12 bg-white/[0.04] p-6 text-center">
          <p className="text-4xl" aria-hidden="true">
            🤝
          </p>
          <p className={`${TEXT.subheading} mt-3`}>Pass the phone to your grown-up</p>
          <p className={`${TEXT.body} mt-2`}>
            They get their own instructions. No peeking — that&rsquo;s the whole point.
          </p>
        </div>
        <Button tone="premium" block onClick={() => setRevealed(true)}>
          I&rsquo;m the grown-up — show me
        </Button>
      </div>
    );
  }

  const handleMove = ({ san }: { san: string }) => {
    const want = beat.successMove;
    if (!want) {
      advance();
      return;
    }
    if (moveMatches(beat.fen, san, [want])) {
      setNudge(null);
      advance();
      return;
    }
    setNudge(isParentTurn ? PARENT_MODE_LINES.parentNudge : PARENT_MODE_LINES.childNudge);
    setTimeout(() => setBoardKey((k) => k + 1), 650);
  };

  function advance() {
    const next = beatIndex + 1;
    if (next >= step.beats.length) {
      setDone(true);
      return;
    }
    setBeatIndex(next);
    setRevealed(false);
    setNudge(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {isParentTurn ? (
        <div className="rounded-2xl border border-amber-300/35 bg-amber-200/[0.08] px-4 py-3">
          <p className={`${TEXT.meta} text-amber-200/80`}>FOR THE GROWN-UP ONLY</p>
          <p className={`${TEXT.body} mt-1 text-premium-ivory/90`}>{beat.parentInstruction}</p>
        </div>
      ) : (
        <OllieCoach line={beat.childGoal} />
      )}

      <div className="flex justify-center">
        {/* key on the beat so the board resets its internal game between beats */}
        <ChessBoard
          key={`beat-${beatIndex}-${boardKey}`}
          fen={beat.fen}
          playableColor={isParentTurn ? "b" : "w"}
          onMove={handleMove}
          size={BOARD}
        />
      </div>

      {nudge ? <p className={`${TEXT.caption} text-center text-amber-200/80`}>{nudge}</p> : null}

      <p className={`${TEXT.caption} text-center`}>
        Move {beatIndex + 1} of {step.beats.length}
      </p>
    </div>
  );
}
