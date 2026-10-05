"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/board/ChessBoard";
import { useResponsiveBoardSize } from "@/lib/hooks/useResponsiveBoardSize";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { MoveFeedback } from "@/components/game/MoveFeedback";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { TEXT } from "@/lib/designSystem";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, completeAcademyContent, localDateString } from "@/lib/supabase/queries";
import { DailyLimitCard, DailyLimitNotice } from "@/components/trainYourMind/DailyLimitCard";
import { newCompletionKey, recordTrainYourMindCompletion } from "@/lib/trainYourMind/dailyUsage";
import { getActiveChildIdClient } from "@/lib/childSession";
import { OllieNote } from "@/components/ollie/OllieNote";
import {
  COURSE_COMPLETION_NOTE,
  COURSE_STUCK_NOTE,
  OLLIE_DEFAULT_STUCK,
} from "@/lib/ollie/courseNotes";
import type { LessonResponse, CourseLesson } from "@/lib/academy/courseTypes";

/**
 * The one lesson runner for every Academy course.
 *
 * Course content arrives from /api/academy/lesson — this component holds no
 * curriculum at all. That is the point: the existing tactics runner imports its
 * whole ~51KB course into the client bundle, and repeating that per course would
 * add a curriculum's worth of bytes to First Load JS every time someone wrote
 * one. Here a new course costs the browser nothing.
 *
 * The five stages mirror the flow the tactics course already established rather
 * than inventing a second teaching model:
 *
 *   LEARN    — the idea, and why it is worth having
 *   SEE      — the idea on a real board
 *   TRY      — the learner plays it, with real validation and a real retry
 *   QUIZ     — one question about the THINKING, not the position
 *   MASTER   — the takeaway, and completion recorded
 *
 * Moves are checked on from/to squares rather than SAN, which varies with
 * disambiguation and check suffixes — the same comparison the tactics runner
 * makes, for the same reason.
 */

type Stage = "learn" | "see" | "try" | "quiz" | "master";
type TryStatus = "playing" | "correct" | "incorrect";

const STAGE_ORDER: Stage[] = ["learn", "see", "try", "quiz", "master"];
const STAGE_LABEL: Record<Stage, string> = {
  learn: "Learn",
  see: "See it",
  try: "Try it",
  quiz: "Think",
  master: "Done",
};

export function CourseLessonRunner({
  courseId,
  lessonId,
  courseHref,
}: {
  courseId: string;
  lessonId: string;
  courseHref: string;
}) {
  const [data, setData] = useState<LessonResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stage, setStage] = useState<Stage>("learn");

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [tryStatus, setTryStatus] = useState<TryStatus>("playing");
  const [attempts, setAttempts] = useState(0);
  const [boardKey, setBoardKey] = useState(0);

  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [savedState, setSavedState] = useState<"idle" | "saving" | "saved">("idle");
  const childIdRef = useRef<string | null>(null);
  const childReady = useRef<Promise<void>>(Promise.resolve());
  // Tactical Thinking is one of the eight Train Your Chess Mind categories: it has its own free
  // daily limit (3 completed exercises per child per day). Each practice exercise is one
  // completion, keyed per exercise so retries and duplicate moves count once.
  const sharesDailyLimit = courseId === "tactical-thinking";
  const completionKeys = useRef<Record<number, string>>({});
  const [limitReached, setLimitReached] = useState(false);
  const [limitRefused, setLimitRefused] = useState(false);
  const boardSize = useResponsiveBoardSize(340);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/academy/lesson?course=${encodeURIComponent(courseId)}&lesson=${encodeURIComponent(lessonId)}&d=${encodeURIComponent(localDateString())}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: LessonResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  // Resolve the child once, so completion can be recorded without blocking the
  // lesson itself. A child that cannot be resolved simply means progress is not
  // saved — the lesson stays fully usable.
  useEffect(() => {
    let cancelled = false;
    childReady.current = (async () => {
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user || cancelled) return;
        const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        if (!cancelled) childIdRef.current = resolution.child?.id ?? null;
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lesson = data?.lesson ?? null;

  const recordCompletion = useCallback(
    async (quizCorrect: boolean) => {
      const childId = childIdRef.current;
      if (!childId || !lesson) return;
      setSavedState("saving");
      try {
        // Namespaced content id, matching lessonContentId() on the server, so
        // two courses can never collide on a lesson id.
        await completeAcademyContent(
          createClient(),
          childId,
          `${courseId}:${lesson.id}`,
          // 1/0, matching the convention the existing tactics lessons already
          // write to child_academy_progress.quiz_score.
          quizCorrect ? 1 : 0
        );
        setSavedState("saved");
      } catch {
        // Progress is a nice-to-have; never trap the learner on a failed write.
        setSavedState("idle");
      }
    },
    [courseId, lesson]
  );

  if (data?.dailyLimit || limitRefused) {
    return <DailyLimitCard categoryLabel="Tactical Thinking" />;
  }

  if (loadFailed) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>That lesson could not be loaded.</p>
        <Link href={courseHref}>
          <Button tone="premium">Back to the course</Button>
        </Link>
      </main>
    );
  }

  if (data?.locked) {
    const preview = data.lockedPreview;
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-safe-icons pb-nav-safe">
        <div className="w-full max-w-md flex flex-col gap-5">
          <Link
            href={courseHref}
            className="flex min-h-[44px] items-center font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            ← Back to the course
          </Link>
          <PrimaryCard className="flex flex-col gap-4 border-premium-gold/30">
            <span className={`${TEXT.meta} text-premium-gold`}>🔒 Premium Lesson</span>
            {preview && (
              <>
                <div>
                  <p className={TEXT.meta}>What you&apos;ll learn</p>
                  <p className="font-classic-display text-lg text-premium-ivory mt-1">{preview.title}</p>
                  <p className={`${TEXT.body} mt-1`}>{preview.concept}</p>
                </div>
                <div>
                  <p className={TEXT.meta}>Why it matters</p>
                  <p className={`${TEXT.body} mt-1`}>{preview.intro}</p>
                </div>
              </>
            )}
            <Link href="/upgrade">
              <Button tone="premium" className="w-full">
                Unlock Premium
              </Button>
            </Link>
          </PrimaryCard>
        </div>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-safe-icons pb-nav-safe">
        <div className="h-9 w-56 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full max-w-md h-40" />
        <SkeletonBlock className="w-full max-w-md aspect-square" />
      </main>
    );
  }

  const exercise = lesson.exercises[exerciseIndex];
  const isLastExercise = exerciseIndex >= lesson.exercises.length - 1;
  const stageIndex = STAGE_ORDER.indexOf(stage);

  /** The learner has completed this exercise: tell the server, which holds the one global count. */
  function noteCompletion(index: number) {
    if (!sharesDailyLimit || !lesson) return;
    const key = (completionKeys.current[index] ??= newCompletionKey());
    const exerciseId = `tactical:${lesson.id}:${index}`;
    void (async () => {
      await childReady.current;
      const childId = childIdRef.current;
      if (!childId) return;
      const outcome = await recordTrainYourMindCompletion(createClient(), childId, "tactical", key, exerciseId);
      if (!outcome) return;
      if (!outcome.allowed) setLimitRefused(true);
      else if (!outcome.isPremium && (outcome.remaining ?? 0) <= 0) setLimitReached(true);
    })();
  }

  function handleMove(opts: { from: string; to: string }) {
    if (!exercise || tryStatus === "correct") return;
    noteCompletion(exerciseIndex);
    const right = opts.from === exercise.solutionFrom && opts.to === exercise.solutionTo;
    if (right) {
      setTryStatus("correct");
    } else {
      setAttempts((n) => n + 1);
      setTryStatus("incorrect");
    }
  }

  function retryExercise() {
    setTryStatus("playing");
    setBoardKey((k) => k + 1);
  }

  function nextExercise() {
    if (isLastExercise) {
      setStage("quiz");
      return;
    }
    setExerciseIndex((i) => i + 1);
    setTryStatus("playing");
    setBoardKey((k) => k + 1);
  }

  function answerQuiz(index: number) {
    if (quizChoice !== null || !lesson) return;
    setQuizChoice(index);
    void recordCompletion(index === lesson.quiz.correctIndex);
    // Move on regardless of the answer: the quiz is a prompt to think, not a
    // gate. Getting it wrong shows the right answer, which is the teaching.
    window.setTimeout(() => setStage("master"), 1200);
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-5 px-5 pt-safe-icons pb-nav-safe">
      <div className="w-full max-w-md md:max-w-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={courseHref}
            className="font-body text-sm text-premium-ivory/65 underline underline-offset-2 min-h-[44px] flex items-center"
          >
            ← {data?.courseTitle ?? "Course"}
          </Link>
          <span className={TEXT.caption}>
            Lesson {lesson.order} of {data?.lessonIds.length ?? lesson.order}
          </span>
        </div>

        {/* Stage progress. Uses a filled/outlined dot plus the stage name, so
            position in the lesson is never carried by colour alone. */}
        <ol className="flex items-center gap-1.5" aria-label="Lesson progress">
          {STAGE_ORDER.map((s, i) => {
            const done = i < stageIndex;
            const current = i === stageIndex;
            return (
              <li key={s} className="flex flex-1 flex-col items-center gap-1">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-full rounded-full ${
                    done || current ? "bg-premium-gold" : "bg-premium-navyLight"
                  }`}
                />
                <span
                  className={`font-classic-body text-[10px] ${
                    current ? "text-premium-gold" : "text-premium-ivory/45"
                  }`}
                >
                  {STAGE_LABEL[s]}
                  {current ? <span className="sr-only"> (current stage)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <div>
          <p className={`${TEXT.meta} text-premium-gold`}>{lesson.concept}</p>
          <h1 className="font-classic-display text-2xl text-premium-ivory mt-1">{lesson.title}</h1>
        </div>

        {stage === "learn" && (
          <PrimaryCard className="flex flex-col gap-3">
            <p className={TEXT.body}>{lesson.intro}</p>
            {lesson.explanation.split("\n\n").map((para, i) => (
              <p key={i} className={TEXT.body}>
                {para}
              </p>
            ))}
            <div className="rounded-premiumBtn border border-premium-gold/20 bg-premium-navyLight/50 p-3">
              <p className={`${TEXT.meta} text-premium-gold`}>What to look for</p>
              <p className={`${TEXT.body} mt-1`}>{lesson.whatToLookFor}</p>
            </div>
            <Button tone="premium" onClick={() => setStage("see")}>
              See it on the board →
            </Button>
          </PrimaryCard>
        )}

        {stage === "see" && (
          <PrimaryCard className="flex flex-col gap-3 items-center">
            {lesson.examples.map((ex, i) => (
              <div key={i} className="flex flex-col gap-2 items-center w-full">
                <div className="w-full mx-auto" style={{ maxWidth: boardSize }}>
                  <ChessBoard readOnly fen={ex.fen} size={boardSize} />
                </div>
                <p className={`${TEXT.body} text-center`}>{ex.caption}</p>
              </div>
            ))}
            <Button tone="premium" onClick={() => setStage("try")} className="w-full">
              Your turn →
            </Button>
          </PrimaryCard>
        )}

        {stage === "try" && exercise && (
          <PrimaryCard className="flex flex-col gap-3 items-center">
            <div className="flex items-center gap-2 self-start">
              <SideToMoveIndicator color={exercise.sideToMove} tone="premium" />
              <span className={TEXT.caption}>
                Exercise {exerciseIndex + 1} of {lesson.exercises.length}
              </span>
            </div>
            <p className={`${TEXT.body} text-center`}>{exercise.prompt}</p>
            <div className="w-full mx-auto" style={{ maxWidth: boardSize }}>
              <ChessBoard
                key={boardKey}
                fen={exercise.fen}
                playableColor={exercise.sideToMove}
                readOnly={tryStatus === "correct"}
                size={boardSize}
                onMove={handleMove}
              />
            </div>

            {tryStatus === "correct" && (
              <div className="w-full flex flex-col gap-2">
                <MoveFeedback tone="correct">{exercise.successMessage}</MoveFeedback>
                {exercise.line && (
                  <p className={`${TEXT.caption} normal-case text-center`}>
                    The full line: {exercise.line}
                  </p>
                )}
                {limitReached ? (
                  <DailyLimitNotice categoryLabel="Tactical Thinking" />
                ) : (
                  <Button tone="premium" onClick={nextExercise} className="w-full">
                    {isLastExercise ? "Continue →" : "Next exercise →"}
                  </Button>
                )}
              </div>
            )}

            {tryStatus === "incorrect" && (
              <div className="w-full flex flex-col gap-2">
                <MoveFeedback tone="incorrect">{exercise.failureMessage}</MoveFeedback>
                <Button tone="premium" variant="ghost" onClick={retryExercise} className="w-full">
                  Try again
                </Button>
                {limitReached && <DailyLimitNotice categoryLabel="Tactical Thinking" />}
                {/* Never trap a learner: after a couple of attempts the answer
                    is offered rather than withheld. */}
                {attempts >= 2 && (
                  <>
                    <OllieNote>{COURSE_STUCK_NOTE[courseId] ?? OLLIE_DEFAULT_STUCK}</OllieNote>
                    <p className={`${TEXT.caption} normal-case text-center`}>
                      Hint: play {exercise.solutionFrom} → {exercise.solutionTo}.
                    </p>
                  </>
                )}
              </div>
            )}
          </PrimaryCard>
        )}

        {stage === "quiz" && (
          <PrimaryCard className="flex flex-col gap-3">
            <p className={`${TEXT.meta} text-premium-gold`}>One question</p>
            <p className={TEXT.body}>{lesson.quiz.question}</p>
            <div role="radiogroup" aria-label="Quiz answer" className="flex flex-col gap-2">
              {lesson.quiz.options.map((opt, i) => {
                const chosen = quizChoice === i;
                const isRight = i === lesson.quiz.correctIndex;
                const reveal = quizChoice !== null;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={reveal}
                    onClick={() => answerQuiz(i)}
                    className={`min-h-[48px] w-full rounded-premiumBtn border px-4 py-2.5 text-left font-classic-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 ${
                      reveal && isRight
                        ? "border-premium-gold bg-premium-gold/15 text-premium-ivory"
                        : chosen
                          ? "border-white/25 bg-premium-navyLight text-premium-ivory"
                          : "border-white/10 bg-premium-navy/70 text-premium-ivory/85 hover:border-premium-gold/30"
                    }`}
                  >
                    {/* Right answer is marked with a check as well as colour. */}
                    {reveal && isRight ? <span aria-hidden="true">✓ </span> : null}
                    {opt}
                  </button>
                );
              })}
            </div>
          </PrimaryCard>
        )}

        {stage === "master" && (
          <PrimaryCard className="flex flex-col gap-4">
            <div>
              <p className={`${TEXT.meta} text-premium-gold`}>Take this into your next game</p>
              <p className={`${TEXT.body} mt-1`}>{lesson.takeaway}</p>
            </div>
            <OllieNote>{COURSE_COMPLETION_NOTE[courseId]}</OllieNote>
            <p className={TEXT.caption}>
              {savedState === "saved"
                ? "Progress saved."
                : savedState === "saving"
                  ? "Saving your progress…"
                  : "Lesson complete."}
            </p>
            <div className="flex flex-col gap-2">
              {data?.nextLessonId ? (
                <Link href={`${courseHref}/${data.nextLessonId}`}>
                  <Button tone="premium" className="w-full">
                    Next lesson →
                  </Button>
                </Link>
              ) : (
                <Link href="/puzzles/tactics">
                  <Button tone="premium" className="w-full">
                    Practise this in the Tactics Trainer →
                  </Button>
                </Link>
              )}
              <Link href={courseHref}>
                <Button tone="premium" variant="ghost" className="w-full">
                  Back to the course
                </Button>
              </Link>
            </div>
          </PrimaryCard>
        )}
      </div>
    </main>
  );
}
