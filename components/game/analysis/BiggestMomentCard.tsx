"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { CATEGORY_INFO } from "@/lib/analysis/moveClassification";
import { formatMoveNumber } from "@/lib/analysis/format";
import { getSkill, type SkillId } from "@/lib/analysis/skills";
import { accuracyBand } from "@/lib/analysis/accuracy";
import type { CompletedGameRecord } from "@/lib/analysis/gameAnalysis";
import type { EnrichedMistake } from "./MistakeCard";
import { MistakeReviewStepper } from "./MistakeReviewStepper";

/**
 * "Your biggest learning moment" — the one flagged mistake most worth a
 * child's attention (chosen by lib/analysis/skillMapping.ts pickBiggestMoment),
 * turned into: what happened → why → which skill → what to notice → see it
 * → practice it.
 *
 * When the game had no flagged mistakes it shows a genuine positive
 * summary instead of a hollow "no mistakes!" — using the real accuracy and
 * good-move count, nothing fabricated.
 *
 * No new board renderer: "See the position" reuses MistakeReviewStepper,
 * which reuses ChessBoard(readOnly). Layout is a normal card in the review
 * scroll column — the board never competes with growing text for height.
 */
export function BiggestMomentCard({
  mistake,
  record,
  accuracy,
  goodMoveCount,
  recurring = false,
  boardSkinId,
  pieceSetId,
  onPractice,
}: {
  mistake: EnrichedMistake | null;
  record: CompletedGameRecord;
  accuracy: number;
  goodMoveCount: number;
  /** True when this skill has been the flagged cause in enough of the
   * child's past reviews to call it a pattern (Phase 26 persistence). */
  recurring?: boolean;
  boardSkinId?: string;
  pieceSetId?: string;
  onPractice: (skill: SkillId) => void;
}) {
  const [showPosition, setShowPosition] = useState(false);

  if (!mistake) {
    const band = accuracyBand(accuracy);
    return (
      <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full max-w-md flex flex-col gap-3">
        <p className={`${TEXT.meta} text-premium-gold`}>🧠 Your Chess Mind Review</p>
        <p className="font-classic-display text-lg text-premium-ivory">No big mistakes this game — nicely done.</p>
        <p className={TEXT.body}>
          You played at <span className="text-premium-gold">{accuracy}% accuracy</span> ({band.toLowerCase()})
          {goodMoveCount > 0 ? ` with ${goodMoveCount} standout move${goodMoveCount === 1 ? "" : "s"}.` : "."} Keep
          checking your opponent's threats every move and this stays consistent.
        </p>
        <Button tone="premium" variant="ghost" onClick={() => onPractice("tactical_awareness")}>
          Sharpen your tactics →
        </Button>
      </div>
    );
  }

  const skill = getSkill(mistake.skillId);
  const catInfo = CATEGORY_INFO[mistake.category];
  const moveLabel = `Move ${Math.floor(mistake.ply / 2) + 1}`;
  let opportunity: string | null = null;
  if (mistake.missedMate) opportunity = "A forced checkmate was available.";
  else if (mistake.missedMaterial) opportunity = "A winning capture was available.";

  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full max-w-md flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className={`${TEXT.meta} text-premium-gold`}>🧠 Your biggest learning moment</p>
        <div className="flex items-center gap-2">
          <span className="font-classic-display text-lg text-premium-ivory">{moveLabel}</span>
          <span className="font-classic-body text-xs text-premium-ivory/70">
            <span aria-hidden="true">{catInfo.emoji}</span> {catInfo.label}
          </span>
        </div>
      </div>

      <p className={TEXT.body}>{mistake.explanation}</p>

      {opportunity && <p className="font-classic-body text-sm text-premium-gold">🟡 {opportunity}</p>}

      {recurring && (
        <p className="rounded-premiumBtn bg-premium-gold/10 border border-premium-gold/25 px-3 py-2 font-classic-body text-sm text-premium-gold">
          This is a pattern you&apos;ve run into before — worth some focused practice.
        </p>
      )}

      <div className="flex items-center gap-2 rounded-premiumBtn bg-premium-navyLight/60 border border-premium-gold/15 px-3 py-2">
        <span className="text-lg" aria-hidden="true">
          {skill.emoji}
        </span>
        <div className="min-w-0">
          <p className="font-classic-body text-[11px] uppercase tracking-wide text-premium-gold">Skill</p>
          <p className="font-classic-display text-sm text-premium-ivory">{skill.name}</p>
        </div>
      </div>

      <div>
        <p className={`${TEXT.meta} text-premium-gold mb-1`}>What to notice</p>
        <p className={TEXT.body}>{mistake.whatToNotice || skill.principle}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button tone="premium" variant="ghost" onClick={() => setShowPosition((v) => !v)}>
          {showPosition ? "Hide the position" : "See the position"}
        </Button>
        {showPosition && (
          <MistakeReviewStepper
            mistake={mistake}
            record={record}
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
          />
        )}
        <Button tone="premium" onClick={() => onPractice(mistake.skillId)}>
          Practice {skill.name} →
        </Button>
      </div>

      <p className={TEXT.caption}>
        {formatMoveNumber(mistake.ply, mistake.mover)} {mistake.san}
        {mistake.bestMove ? ` · one strong option was ${mistake.bestMove.san}` : ""}
      </p>
    </div>
  );
}
