"use client";

import { useState } from "react";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { CATEGORY_INFO } from "@/lib/analysis/moveClassification";
import { formatMoveNumber } from "@/lib/analysis/format";
import { getSkill, type SkillId } from "@/lib/analysis/skills";
import type { AnalyzedMove, CompletedGameRecord } from "@/lib/analysis/gameAnalysis";
import { MistakeReviewStepper } from "./MistakeReviewStepper";

const MINI_BOARD_SIZE = 150;

export interface EnrichedMistake extends AnalyzedMove {
  explanation: string;
  whatToNotice: string;
  /** Resolved skill id (explain API's, else the conservative mapper's,
   * else the neutral bucket) — see PostGameAnalysis. */
  skillId: SkillId;
}

/** One flagged mistake/blunder, fully explained — section 5-9 of the brief:
 * category badge, plain-language "why," reusable principle, and a
 * before/after/better-move board comparison so the change is visible, not
 * just described. Reuses ChessBoard(readOnly) for all three mini-boards —
 * no new board renderer. "Review Position" (below) adds a step-back-3-moves
 * view on top of this, also reusing ChessBoard(readOnly). */
export function MistakeCard({
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const info = CATEGORY_INFO[mistake.category];
  const moveLabel = `${formatMoveNumber(mistake.ply, mistake.mover)} ${mistake.san}${mistake.category === "blunder" ? "??" : "?"}`;

  let opportunityLabel: string | null = null;
  if (mistake.missedMate) opportunityLabel = "Missed Opportunity: a forced checkmate was available.";
  else if (mistake.missedMaterial) opportunityLabel = "Missed Opportunity: a winning capture was available.";

  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full max-w-md flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-classic-display text-lg text-premium-ivory">{moveLabel}</p>
        <p className="font-classic-display text-base">
          <span aria-hidden="true">{info.emoji}</span> <span className="text-premium-ivory">{info.label.toUpperCase()}</span>
        </p>
      </div>

      {opportunityLabel && (
        <p className="font-classic-body text-sm text-premium-gold text-center">🟡 {opportunityLabel}</p>
      )}

      {(() => {
        const skill = getSkill(mistake.skillId);
        return (
          <div className="flex items-center gap-2 self-center rounded-full bg-premium-navyLight/60 border border-premium-gold/15 px-3 py-1">
            <span aria-hidden="true">{skill.emoji}</span>
            <span className="font-classic-body text-xs text-premium-ivory/80">
              Skill: <span className="text-premium-ivory">{skill.name}</span>
            </span>
          </div>
        );
      })()}

      <div>
        <p className={`${TEXT.meta} text-premium-gold mb-1`}>Why was this a mistake?</p>
        <p className={TEXT.body}>{mistake.explanation}</p>
      </div>

      <div>
        <p className={`${TEXT.meta} text-premium-gold mb-1`}>What should you have noticed?</p>
        <p className={TEXT.body}>{mistake.whatToNotice}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1">
          <p className={TEXT.caption}>Before Your Move</p>
          <ChessBoard readOnly fen={mistake.fenBefore} size={MINI_BOARD_SIZE} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className={TEXT.caption}>After Your Move</p>
          <ChessBoard readOnly fen={mistake.fen} size={MINI_BOARD_SIZE} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
          <p className="font-classic-body text-xs text-premium-ivory/60">{mistake.san}</p>
        </div>
        {mistake.bestMove && (
          <div className="flex flex-col items-center gap-1">
            <p className={TEXT.caption}>Better Move</p>
            <ChessBoard readOnly fen={mistake.fenBefore} size={MINI_BOARD_SIZE} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
            <p className="font-classic-body text-xs text-premium-gold">
              {formatMoveNumber(mistake.ply, mistake.mover)} {mistake.bestMove.san}
            </p>
          </div>
        )}
      </div>

      {mistake.bestMove && (
        <div className="rounded-premiumBtn bg-premium-navyLight/60 border border-premium-gold/15 p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-classic-body text-premium-ivory/60">Your move: <span className="text-premium-ivory">{mistake.san}</span></span>
            <span className="font-classic-body text-premium-ivory/60">
              Best move: <span className="text-premium-gold">{mistake.bestMove.san}</span>
            </span>
          </div>
          <p className={TEXT.caption}>One strong option was {mistake.bestMove.san}.</p>
        </div>
      )}

      <Button tone="premium" variant="ghost" onClick={() => setReviewOpen((v) => !v)}>
        {reviewOpen ? "Hide Review Position" : "Review Position →"}
      </Button>

      {reviewOpen && (
        <MistakeReviewStepper mistake={mistake} record={record} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
      )}
    </div>
  );
}
