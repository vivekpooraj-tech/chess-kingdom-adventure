"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SkillPracticeSet } from "@/components/game/analysis/SkillPracticeSet";
import { recommendPractice } from "@/lib/training/recommendation";
import { getSkill, type SkillId } from "@/lib/analysis/skills";
import { recordSkillPractice } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { OllieLearnerProfile } from "@/lib/ollie/learnerContext";
import type { ExperienceLevel, AgeBand } from "@/lib/learner/experienceLevel";
import { TEXT } from "@/lib/designSystem";

/**
 * "Ollie noticed something."
 *
 * Ollie's promise is that he sees what the child misses — but a coach who only
 * ever sees the game in front of him isn't really watching. This card is the
 * cross-session half of that promise: it surfaces the ONE skill the child keeps
 * getting flagged on across their reviewed games, and turns it straight into
 * practice, closing the loop from "you keep missing this" to "you're getting
 * it now" without the child having to go looking.
 *
 * Everything shown is backed by a real recorded counter (child_skill_signals /
 * child_game_reviews, via deriveLearnerProfile). When the data is too thin to
 * support a claim the card renders nothing at all rather than inventing a
 * weakness — being told you keep missing something you have never missed is
 * how a child stops believing the coach.
 *
 * The practice set, its content selection and the honest coverage note are all
 * the existing review-driven ones; this only changes what triggers them.
 */
export function OllieNoticedCard({
  profile,
  childId,
  buddyEmoji = "🦉",
  experienceLevel,
  ageBand,
  boardSkinId,
  pieceSetId,
  className,
}: {
  profile: OllieLearnerProfile;
  childId: string | null;
  buddyEmoji?: string;
  experienceLevel: ExperienceLevel | null;
  ageBand?: AgeBand | null;
  boardSkinId?: string;
  pieceSetId?: string;
  className?: string;
}) {
  const [practicing, setPracticing] = useState(false);
  const [practiceKey, setPracticeKey] = useState(0);
  const [justFinished, setJustFinished] = useState<{ attempts: number; correct: number } | null>(null);

  const focusSkill = profile.focusSkill;

  const recommendation = useMemo(() => {
    if (!focusSkill) return null;
    return recommendPractice({ skill: focusSkill, experienceLevel, ageBand });
  }, [focusSkill, experienceLevel, ageBand]);

  // No genuine recurring pattern yet — say nothing rather than manufacture one.
  if (!focusSkill || !recommendation) return null;

  const skill = getSkill(focusSkill);

  function handleComplete(skillId: SkillId, attempts: number, correct: number) {
    setJustFinished({ attempts, correct });
    if (childId) {
      // Feeds practice_attempts / practice_correct back into the same signal
      // that surfaced this weakness, so sustained practice eventually flips
      // the card's message from "keeps coming up" to "that's real progress".
      void recordSkillPractice(createClient(), childId, skillId, attempts, correct);
    }
  }

  function restart() {
    setPracticeKey((k) => k + 1);
    setJustFinished(null);
  }

  return (
    <section
      aria-label="Ollie noticed"
      className={`rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full flex flex-col gap-4 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-premium-gold/30 bg-premium-midnight text-2xl"
        >
          {buddyEmoji}
        </span>
        <div className="min-w-0 flex flex-col gap-1">
          <p className={`${TEXT.meta} text-premium-gold`}>Ollie noticed</p>
          <p className="font-classic-display text-lg text-premium-ivory">
            {skill.name} keeps coming up
          </p>
        </div>
      </div>

      <p className={TEXT.body}>
        Across your last few reviewed games, {skill.name.toLowerCase()} was the thing that cost you most
        often. {skill.principle}
      </p>

      {/* Progress is only claimed when the child has actually practised enough
          for the hit-rate to mean something — see MIN_PRACTICE_ATTEMPTS. */}
      {profile.improvingOnFocusSkill && (
        <p className="rounded-premiumBtn border border-premium-gold/25 bg-premium-gold/10 px-3 py-2 font-classic-body text-sm text-premium-gold">
          You&apos;ve been getting these right lately — that&apos;s real progress on something you used to
          miss.
        </p>
      )}

      {justFinished && (
        <p className="rounded-premiumBtn border border-premium-gold/25 bg-premium-gold/10 px-3 py-2 font-classic-body text-sm text-premium-gold">
          {justFinished.correct} of {justFinished.attempts} solved. Every rep makes this easier to spot.
        </p>
      )}

      {!practicing ? (
        <Button tone="premium" onClick={() => setPracticing(true)}>
          Try Ollie&apos;s challenge →
        </Button>
      ) : (
        <SkillPracticeSet
          // Remounting is what actually resets the runner's internal progress.
          key={practiceKey}
          recommendation={recommendation}
          childId={childId}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
          onComplete={handleComplete}
          onPlayAgain={restart}
          onBackToReview={() => setPracticing(false)}
          backLabel="Done for now"
        />
      )}
    </section>
  );
}
