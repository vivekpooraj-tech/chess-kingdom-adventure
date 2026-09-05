"use client";

import { useMemo, useState } from "react";
import { SkillPracticeSet } from "@/components/game/analysis/SkillPracticeSet";
import { recommendPractice } from "@/lib/training/recommendation";
import { recordSkillPractice } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { SkillId } from "@/lib/analysis/skills";
import type { ExperienceLevel, AgeBand } from "@/lib/learner/experienceLevel";
import { TEXT } from "@/lib/designSystem";

/**
 * The actual practice run behind "Try Ollie's challenge".
 *
 * Split out of OllieNoticedCard purely so it can be dynamically imported. This
 * module is the expensive half: recommendPractice pulls in the whole content
 * library (content/puzzles.ts is ~192KB of source on its own) and
 * SkillPracticeSet pulls in chess.js and the board. Loading that on every visit
 * to Chess Mind -- for a card most children never see, and a runner that only
 * matters once they tap -- was a large download and parse cost on exactly the
 * low-end phones this product targets.
 *
 * Now none of it is fetched until the child actually asks to practise.
 */
export function OlliePracticeRunner({
  skill,
  childId,
  experienceLevel,
  ageBand,
  boardSkinId,
  pieceSetId,
  onExit,
}: {
  skill: SkillId;
  childId: string | null;
  experienceLevel: ExperienceLevel | null;
  ageBand?: AgeBand | null;
  boardSkinId?: string;
  pieceSetId?: string;
  onExit: () => void;
}) {
  const [practiceKey, setPracticeKey] = useState(0);
  const [justFinished, setJustFinished] = useState<{ attempts: number; correct: number } | null>(null);

  const recommendation = useMemo(
    () => recommendPractice({ skill, experienceLevel, ageBand }),
    [skill, experienceLevel, ageBand]
  );

  function handleComplete(skillId: SkillId, attempts: number, correct: number) {
    setJustFinished({ attempts, correct });
    if (childId) {
      // Feeds practice_attempts / practice_correct back into the same signal
      // that surfaced this weakness, so sustained practice eventually flips
      // the card's message from "keeps coming up" to "that's real progress".
      void recordSkillPractice(createClient(), childId, skillId, attempts, correct);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {justFinished && (
        <p className="rounded-premiumBtn border border-premium-gold/25 bg-premium-gold/10 px-3 py-2 font-classic-body text-sm text-premium-gold">
          {justFinished.correct} of {justFinished.attempts} solved. Every rep makes this easier to spot.
        </p>
      )}
      {recommendation.items.length === 0 ? (
        <p className={TEXT.body}>No practice positions for this skill yet — check back soon.</p>
      ) : (
        <SkillPracticeSet
          // Remounting is what actually resets the runner's internal progress.
          key={practiceKey}
          recommendation={recommendation}
          childId={childId}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
          onComplete={handleComplete}
          onPlayAgain={() => {
            setPracticeKey((k) => k + 1);
            setJustFinished(null);
          }}
          onBackToReview={onExit}
          backLabel="Done for now"
        />
      )}
    </div>
  );
}
