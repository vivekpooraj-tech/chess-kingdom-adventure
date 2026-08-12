"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  completeAcademyContent,
  getCompletedAcademyContentIds,
  getCompletedDays,
  getOpeningEncounters,
  getChessMindTotalSolved,
  getOnlineWinsCount,
  evaluateAndAwardAchievements,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { getTacticsLesson, getTacticsLessonIndex, TACTICS_LESSONS } from "@/content/tacticsLessons";
import { ChessBoard } from "@/components/board/ChessBoard";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { TacticsPaywall } from "@/components/upgrade/TacticsPaywall";

type Stage = "learn" | "see" | "practice" | "quiz" | "master";
type PracticeStatus = "playing" | "correct" | "incorrect";
type Mode = "loading" | "locked" | "unlocked";

export default function TacticsLessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lesson = getTacticsLesson(params.lessonId);
  const lessonIndex = getTacticsLessonIndex(params.lessonId);

  const [mode, setMode] = useState<Mode>("loading");
  const [isPremium, setIsPremium] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);

  const [stage, setStage] = useState<Stage>("learn");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [practiceStatus, setPracticeStatus] = useState<PracticeStatus>("playing");
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [newAchievement, setNewAchievement] = useState<string | null>(null);
  const completionSavedRef = useRef(false);

  useEffect(() => {
    async function load() {
      if (!lesson) {
        setMode("unlocked"); // renders the "lesson not found" branch below
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setChildId(child.id);
      setBoardSkinId(child.board_skin_id);
      setPieceSetId(child.piece_set_id);

      const { data: parent } = await supabase
        .from("parents")
        .select("premium_status")
        .eq("auth_user_id", user.id)
        .single();
      const premium = parent?.premium_status === "premium";
      setIsPremium(premium);

      if (lesson.free) {
        setMode("unlocked");
        return;
      }

      // Same enforcement model as every other Academy/lesson screen in this
      // app (app/lesson/[dayId]/page.tsx): premium_status is checked here
      // before the lesson content renders, so a free user hitting this URL
      // directly gets the locked view, not the lesson — this is a route-
      // level gate, consistent with how Fundamentals/Origins/Journey
      // lessons already work in this codebase. It does not attempt to hide
      // the static content bundle itself (no Academy content in this app
      // does that); what actually matters — awarding progress/achievement
      // credit — only ever happens via completeAcademyContent, reached
      // only by genuinely passing through this gate.
      setMode(premium ? "unlocked" : "locked");
    }
    load();
  }, [lesson, router]);

  if (!lesson) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>That lesson doesn't exist.</p>
        <Link href="/academy/tactics">
          <Button tone="premium">Back to Tactics</Button>
        </Link>
      </main>
    );
  }

  if (mode === "loading") {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  if (mode === "locked") {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6">
        <PrimaryCard className="max-w-sm w-full flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">🔒</span>
          <h1 className={TEXT.heading}>{lesson.title}</h1>
          <p className={TEXT.body}>
            This lesson is part of the Full Version Tactics course. Unlock everything to open it.
          </p>
        </PrimaryCard>
        <TacticsPaywall onDismiss={() => router.push("/academy/tactics")} />
      </main>
    );
  }

  const exercise = lesson.exercises[exerciseIndex];
  const isLastExercise = exerciseIndex === lesson.exercises.length - 1;
  const isMultiExercise = lesson.exercises.length > 1;
  const nextLesson = TACTICS_LESSONS[lessonIndex + 1] ?? null;

  function resetExercise() {
    setBoardKey((k) => k + 1);
    setPracticeStatus("playing");
  }

  function handlePracticeMove(opts: { from: string; to: string }) {
    if (opts.from === exercise.solutionFrom && opts.to === exercise.solutionTo) {
      setPracticeStatus("correct");
    } else {
      setPracticeStatus("incorrect");
    }
  }

  function nextExerciseOrQuiz() {
    if (isLastExercise) {
      setStage("quiz");
    } else {
      setExerciseIndex((i) => i + 1);
      setBoardKey((k) => k + 1);
      setPracticeStatus("playing");
    }
  }

  async function finishLesson() {
    setStage("master");
    if (completionSavedRef.current || !childId || !lesson) return;
    completionSavedRef.current = true;
    const supabase = createClient();
    const quizCorrect = quizAnswer === lesson.quiz.correctIndex ? 1 : 0;
    try {
      await completeAcademyContent(supabase, childId, lesson.id, quizCorrect);
      const [completedDays, completedAcademyIds, openingEncounters, chessMindTotalSolved, onlineWinsCount] =
        await Promise.all([
          getCompletedDays(supabase, childId),
          getCompletedAcademyContentIds(supabase, childId),
          getOpeningEncounters(supabase, childId),
          getChessMindTotalSolved(supabase, childId),
          getOnlineWinsCount(supabase, childId),
        ]);
      const newlyEarned = await evaluateAndAwardAchievements(
        supabase,
        childId,
        completedDays,
        isPremium,
        completedAcademyIds,
        openingEncounters,
        chessMindTotalSolved,
        onlineWinsCount
      );
      if (newlyEarned.length > 0) setNewAchievement(newlyEarned[0]);
    } catch {
      // Non-fatal — the lesson still shows as complete to the child even if
      // the progress write hiccups; matches this app's existing tolerance
      // for best-effort progress writes elsewhere (e.g. free-play's
      // achievement evaluation).
    }
  }

  function practiceAgain() {
    setStage("practice");
    setExerciseIndex(0);
    resetExercise();
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 py-10">
      <div className="w-full max-w-2xl flex items-center justify-between">
        <Link
          href="/academy/tactics"
          className="font-classic-body text-sm text-premium-ivory/50 hover:text-premium-ivory underline underline-offset-2"
        >
          ← Tactics
        </Link>
        <p className={TEXT.caption}>
          Lesson {lesson.order} of {TACTICS_LESSONS.length}
        </p>
      </div>

      <div className="text-center max-w-md">
        <p className={`${TEXT.meta} text-premium-gold`}>{lesson.difficulty}</p>
        <h1 className={`${TEXT.display} mt-1`}>{lesson.title}</h1>
      </div>

      {/* Stage progress — 5 dots, board-first design keeps this tiny */}
      <div className="flex items-center gap-1.5" aria-label="Lesson progress">
        {(["learn", "see", "practice", "quiz", "master"] as Stage[]).map((s) => (
          <span
            key={s}
            aria-hidden="true"
            className={`w-2 h-2 rounded-full ${
              s === stage ? "bg-premium-gold" : "bg-premium-ivory/20"
            }`}
          />
        ))}
      </div>

      {stage === "learn" && (
        <PrimaryCard className="max-w-xl w-full flex flex-col gap-4">
          <p className={TEXT.body}>{lesson.intro}</p>
          <div>
            <p className={`${TEXT.meta} text-premium-gold mb-1`}>The Idea</p>
            <p className={TEXT.body}>{lesson.explanation}</p>
          </div>
          <div>
            <p className={`${TEXT.meta} text-premium-gold mb-1`}>Why It Works</p>
            <p className={TEXT.body}>{lesson.whyItWorks}</p>
          </div>
          <div>
            <p className={`${TEXT.meta} text-premium-gold mb-1`}>What To Look For</p>
            <p className={TEXT.body}>{lesson.whatToLookFor}</p>
          </div>
          <Button tone="premium" onClick={() => setStage("see")}>
            Continue →
          </Button>
        </PrimaryCard>
      )}

      {stage === "see" && (
        <div className="flex flex-col items-center gap-4 max-w-xl w-full">
          <ChessBoard readOnly fen={lesson.examples[0].fen} size={360} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
          <p className={`${TEXT.body} text-center`}>{lesson.examples[0].caption}</p>
          <Button tone="premium" onClick={() => setStage("practice")}>
            Try It Yourself →
          </Button>
        </div>
      )}

      {stage === "practice" && (
        <div className="flex flex-col items-center gap-4 max-w-xl w-full">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isMultiExercise && (
              <span className="font-classic-body text-sm bg-premium-navy/70 text-premium-ivory/70 rounded-full px-3 py-1">
                Position {exerciseIndex + 1} of {lesson.exercises.length}
              </span>
            )}
            <SideToMoveIndicator color={exercise.sideToMove} tone="premium" />
          </div>
          <p className={`${TEXT.body} text-center`}>{exercise.prompt}</p>
          <ChessBoard
            key={boardKey}
            fen={exercise.fen}
            playableColor={exercise.sideToMove}
            size={420}
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            onMove={handlePracticeMove}
          />
          {practiceStatus === "correct" && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-classic-display text-lg text-premium-gold">{exercise.successMessage}</p>
              <Button tone="premium" onClick={nextExerciseOrQuiz}>
                {isLastExercise ? "Continue →" : "Next Position →"}
              </Button>
            </div>
          )}
          {practiceStatus === "incorrect" && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-classic-display text-lg text-red-300">{exercise.failureMessage}</p>
              <Button tone="premium" variant="ghost" onClick={resetExercise}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      )}

      {stage === "quiz" && (
        <PrimaryCard className="max-w-md w-full flex flex-col gap-4">
          <p className={`${TEXT.meta} text-premium-gold`}>Quick Check</p>
          <p className="font-classic-display text-base text-premium-ivory">{lesson.quiz.question}</p>
          <div className="flex flex-col gap-2">
            {lesson.quiz.options.map((option, i) => {
              const answered = quizAnswer !== null;
              const isCorrect = i === lesson.quiz.correctIndex;
              const isPicked = i === quizAnswer;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={answered}
                  onClick={() => setQuizAnswer(i)}
                  className={`font-classic-body text-sm text-left rounded-premiumBtn px-4 py-3 border transition-colors ${
                    answered && isCorrect
                      ? "bg-premium-gold/20 border-premium-gold/60 text-premium-gold"
                      : answered && isPicked
                      ? "bg-red-500/15 border-red-400/40 text-red-300"
                      : "bg-premium-navy/60 border-white/10 text-premium-ivory/80 hover:border-white/25"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {quizAnswer !== null && (
            <>
              <p className={TEXT.caption}>
                {quizAnswer === lesson.quiz.correctIndex ? "Correct!" : `Not quite — it was "${lesson.quiz.options[lesson.quiz.correctIndex]}"`}
              </p>
              <Button tone="premium" onClick={finishLesson}>
                Continue →
              </Button>
            </>
          )}
        </PrimaryCard>
      )}

      {stage === "master" && (
        <PrimaryCard className="max-w-md w-full flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">✓</span>
          <p className="font-classic-display text-xl text-premium-gold">Lesson Complete</p>
          <p className={TEXT.body}>{lesson.takeaway}</p>
          {newAchievement && (
            <p className="font-classic-body text-sm text-premium-gold">🏆 Achievement unlocked!</p>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            {nextLesson ? (
              <Link href={`/academy/tactics/${nextLesson.id}`}>
                <Button tone="premium">Next Lesson →</Button>
              </Link>
            ) : (
              <Link href="/academy/tactics">
                <Button tone="premium">Back to Tactics</Button>
              </Link>
            )}
            <Button tone="premium" variant="ghost" onClick={practiceAgain}>
              Practice Again
            </Button>
          </div>
        </PrimaryCard>
      )}
    </main>
  );
}
