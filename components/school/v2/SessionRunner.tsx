"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import type { SchoolProgress, SchoolSession, SchoolStep } from "@/content/school/types";
import { moduleForSession } from "@/content/school/modules";
import { TOTAL_SESSIONS, getSession } from "@/content/school/sessions";
import { clearBookmark, readBookmark, writeBookmark } from "@/lib/school/v2/resume";
import { actTransitionLine, resumedLine } from "@/lib/school/v2/ollieLines";
import { completeSession, hasGraduated, isSessionUnlocked, nextSessionNumber } from "@/lib/school/v2/progress";
import { loadSchoolProgress, saveSchoolProgress } from "@/lib/school/v2/queries";
import { mergeProgress } from "@/lib/school/v2/storage";
import { OllieCoach, SchoolChip } from "./Coach";
import { ParentModePanel } from "./ParentModePanel";
import {
  BotMatchStepView,
  CeremonyStepView,
  DrillStepView,
  GuidedBoardStepView,
  PassAndPlayStepView,
  RecapStepView,
  TeachStepView,
} from "./steps";

export const CLASSROOM_HREF = "/chess-school/classroom";
export const GRADUATE_HREF = "/chess-school/graduate";
export function sessionHref(id: string): string {
  return `/chess-school/session/${id}`;
}

/**
 * Runs one session: step by step, then records it.
 *
 * THE RUNNER IS DUMB ON PURPOSE. It knows how to advance an index and how to
 * save. Every teaching decision — the hint ladder, the remedial route, what
 * Ollie says — lives in the step components and the content. A new step type
 * is a new case in `renderStep`; a new session is a new entry in the content
 * file. Nothing about a particular session is written here.
 *
 * PROGRESS IS WRITTEN ONCE, AT THE END. A session is a unit: a child who
 * leaves halfway through session 12 has not partly done Fork Festival, they
 * have not done it, and Continue Learning opens it again from the top. That is
 * simpler to reason about, matches how the parent summary makes claims, and
 * means a crash mid-session can never leave a half-credited row.
 */
export function SessionRunner({
  session,
  childId,
  childName,
  initialProgress,
}: {
  session: SchoolSession;
  childId: string;
  childName: string;
  initialProgress: SchoolProgress;
}) {
  const [progress, setProgress] = useState<SchoolProgress>(initialProgress);
  const [stepIndex, setStepIndex] = useState(0);
  const [resumedFrom, setResumedFrom] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [savedRemotely, setSavedRemotely] = useState<boolean | null>(null);

  // Pick up where this device left off. A refresh, a sleeping tablet or a
  // stray tap on the home button must not send a child back to step one —
  // see lib/school/v2/resume.ts. Read after mount so the server render and
  // the first client render agree (no hydration mismatch).
  useEffect(() => {
    const at = readBookmark(childId, session.id, session.steps.length);
    if (at > 0) {
      setStepIndex(at);
      setResumedFrom(session.steps[at]?.title ?? null);
    }
  }, [childId, session.id, session.steps]);

  // The server rendered with its own read; the device may know more (a session
  // finished offline). Merge on mount so an unlocked session is never shown
  // as locked because the network was down when the page was built.
  useEffect(() => {
    let cancelled = false;
    loadSchoolProgress(createClient(), childId).then(({ progress: merged }) => {
      // Merge with what the server already rendered: a transient client-side
      // read failure must never downgrade a child below what the server knew.
      if (!cancelled) setProgress((current) => mergeProgress(current, merged));
    });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  const unlocked = isSessionUnlocked(progress, session.number);
  const module = moduleForSession(session.number);
  const steps = session.steps;
  const step: SchoolStep | undefined = steps[stepIndex];

  const advance = async () => {
    if (stepIndex + 1 < steps.length) {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setResumedFrom(null);
      writeBookmark(childId, session.id, nextIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Finishing is idempotent (completeSession unions), so a double-tap on
    // the last button cannot double-count a session or an unlock.
    const next = completeSession(progress, session.number);
    setProgress(next);
    setFinished(true);
    clearBookmark(childId, session.id);
    const ok = await saveSchoolProgress(createClient(), childId, next);
    setSavedRemotely(ok);
  };

  if (session.status === "preview") {
    return (
      <Frame session={session} moduleTitle={module?.title}>
        <OllieCoach line="This session is still being built. Everything before it is ready — and I'll tell you the moment this one is too." />
        <p className={`${TEXT.body}`}>{session.subtitle}</p>
        <BackToClassroom />
      </Frame>
    );
  }

  if (!unlocked) {
    const nextNumber = nextSessionNumber(progress);
    return (
      <Frame session={session} moduleTitle={module?.title}>
        <OllieCoach line={`Not yet — finish session ${nextNumber} first. Nothing here is going anywhere.`} />
        <Link href={CLASSROOM_HREF} className="w-full">
          <Button tone="premium" block>
            Go to session {nextNumber}
          </Button>
        </Link>
      </Frame>
    );
  }

  if (finished) {
    const graduated = hasGraduated(progress) && session.number === TOTAL_SESSIONS;
    const nextNumber = nextSessionNumber(progress);
    const nextSession = nextNumber !== session.number ? getSession(nextNumber) : null;
    const learned = steps.find((st) => st.type === "recap");
    // Crossing an act boundary gets one extra line of its own, ABOVE the
    // session's own success line — the moment a child moves from "I speak
    // chess" into "I see traps" is bigger than any one session, and thirty
    // identical "Session complete" screens would bury that.
    const nextAct = nextSession ? moduleForSession(nextSession.number)?.act : undefined;
    const actLine = nextAct && nextAct !== module?.act ? actTransitionLine(nextAct) : null;
    return (
      <Frame session={session} moduleTitle={module?.title}>
        <OllieCoach line={session.ollie.success} tone="proud" />
        {actLine ? <OllieCoach line={actLine} tone="proud" /> : null}
        <div className="rounded-premiumCard border border-premium-gold/30 bg-premium-gold/[0.06] p-5 text-center">
          <p className="text-3xl" aria-hidden="true">
            {session.starred ? "★" : "✓"}
          </p>
          <p className={`${TEXT.subheading} mt-1`}>Session {session.number} complete</p>
          {learned && learned.type === "recap" ? (
            <p className={`${TEXT.caption} mt-2`}>{learned.learned[0]}</p>
          ) : null}
          {savedRemotely === false ? (
            <p className={`${TEXT.caption} mt-2`}>Saved on this device. It will sync when you&rsquo;re back online.</p>
          ) : null}
        </div>
        {/* ONE clear next action. The classroom is always a tap away via ✕,
            but a child who just finished wants the next thing, not a menu.
            The next session's page enforces access itself, so if it is
            behind the paywall the child lands on the classroom's unlock card
            rather than on a locked screen. */}
        {graduated ? (
          <Link href={GRADUATE_HREF} className="w-full">
            <Button tone="premium" block size="lg">
              See your certificate
            </Button>
          </Link>
        ) : nextSession ? (
          <>
            <Link href={sessionHref(nextSession.id)} className="w-full">
              <Button tone="premium" block size="lg">
                Next: {nextSession.title}
              </Button>
            </Link>
            <p className={`${TEXT.caption} text-center`}>
              Session {nextSession.number} · about {nextSession.estimatedMinutes} minutes
            </p>
            <Link href={CLASSROOM_HREF} className={`${TEXT.caption} text-center underline underline-offset-2`}>
              Back to the classroom
            </Link>
          </>
        ) : (
          <BackToClassroom />
        )}
      </Frame>
    );
  }

  if (!step) return null;

  return (
    <Frame session={session} moduleTitle={module?.title} stepIndex={stepIndex} stepCount={steps.length}>
      {resumedFrom ? <OllieCoach line={resumedLine(resumedFrom)} tone="warm" /> : null}
      {/* Keyed by step id: two consecutive steps of the same type (two guided
          boards, say) must be two component instances, or the second one
          inherits the first one's solved/attempt state. Found by a child-chaos
          pass, not by a type error. */}
      <div key={step.id} className="contents">
        {renderStep(step, session, childName, advance, stepIndex === steps.length - 1)}
      </div>
    </Frame>
  );
}

function renderStep(
  step: SchoolStep,
  session: SchoolSession,
  childName: string,
  onComplete: () => void,
  isLast: boolean
) {
  const ollie = session.ollie;
  switch (step.type) {
    case "teach":
      return <TeachStepView step={step} ollie={ollie} onComplete={onComplete} />;
    case "guided_board":
      return <GuidedBoardStepView step={step} ollie={ollie} onComplete={onComplete} />;
    case "puzzle_drill":
    case "exam":
      return <DrillStepView step={step} ollie={ollie} onComplete={onComplete} />;
    case "bot_match":
      return <BotMatchStepView step={step} ollie={ollie} onComplete={onComplete} />;
    case "parent_mode":
      return <ParentModePanel step={step} onComplete={onComplete} />;
    case "pass_and_play":
      return <PassAndPlayStepView step={step} ollie={ollie} onComplete={onComplete} />;
    case "ceremony":
      return <CeremonyStepView step={step} childName={childName} onComplete={onComplete} />;
    case "recap":
      return <RecapStepView step={step} onComplete={onComplete} isLast={isLast} />;
  }
}

function Frame({
  session,
  moduleTitle,
  stepIndex,
  stepCount,
  children,
}: {
  session: SchoolSession;
  moduleTitle?: string;
  stepIndex?: number;
  stepCount?: number;
  children: React.ReactNode;
}) {
  return (
    <main
      className={`relative isolate mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-16 pt-4 ${
        session.starred ? "school-starred" : ""
      }`}
    >
      {/* A big moment gets a gold wash behind the header — the one visual cue
          that this session is not an ordinary lesson. Everything else is the
          same runner, so nothing about the mechanics changes. */}
      {session.starred ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,165,107,0.22), transparent 70%)",
          }}
        />
      ) : null}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {moduleTitle ? <SchoolChip>{moduleTitle}</SchoolChip> : null}
            {session.starred ? <SchoolChip tone="gold">★ Big moment</SchoolChip> : null}
          </div>
          <h1 className={`${TEXT.heading} mt-2`}>
            <span className="text-premium-ivory/50">Session {session.number} · </span>
            {session.title}
          </h1>
        </div>
        <Link
          href={CLASSROOM_HREF}
          aria-label="Exit session"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-premium-ivory/70 hover:text-premium-ivory"
        >
          ✕
        </Link>
      </header>

      {typeof stepIndex === "number" && stepCount ? (
        <div className="flex gap-1" aria-label={`Step ${stepIndex + 1} of ${stepCount}`}>
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < stepIndex ? "bg-premium-gold" : i === stepIndex ? "bg-premium-gold/60" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      ) : null}

      {children}
    </main>
  );
}

function BackToClassroom() {
  return (
    <Link href={CLASSROOM_HREF} className="w-full">
      <Button tone="premium" block>
        Back to the classroom
      </Button>
    </Link>
  );
}
