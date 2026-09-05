"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { getSkill } from "@/lib/analysis/skills";
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
 * The practice runner is loaded on demand (see OlliePracticeRunner): it drags
 * in the content library and the board, which should not be downloaded by every
 * child who merely opens Chess Mind.
 */
const OlliePracticeRunner = dynamic(
  () => import("./OlliePracticeRunner").then((m) => m.OlliePracticeRunner),
  {
    ssr: false,
    loading: () => (
      <p className={`${TEXT.caption} normal-case`}>Loading your challenge…</p>
    ),
  }
);

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

  const focusSkill = profile.focusSkill;
  // No genuine recurring pattern yet — say nothing rather than manufacture one.
  if (!focusSkill) return null;

  const skill = getSkill(focusSkill);

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

      {!practicing ? (
        <Button tone="premium" onClick={() => setPracticing(true)}>
          Try Ollie&apos;s challenge →
        </Button>
      ) : (
        <OlliePracticeRunner
          skill={focusSkill}
          childId={childId}
          experienceLevel={experienceLevel}
          ageBand={ageBand}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
          onExit={() => setPracticing(false)}
        />
      )}
    </section>
  );
}
