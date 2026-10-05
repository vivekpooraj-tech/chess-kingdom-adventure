"use client";

import { backLabel } from "@/lib/navigation/destinations";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import { ChessBoard } from "@/components/board/ChessBoard";
import { useResponsiveBoardSize } from "@/lib/hooks/useResponsiveBoardSize";
import { Screen } from "@/components/layout/Screen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { createClient } from "@/lib/supabase/client";
import { recordChessMindSolve, localDateString } from "@/lib/supabase/queries";
import { usePremium } from "@/lib/premium/usePremium";
import { useTrainYourMindDailyLimit } from "@/lib/trainYourMind/useDailyLimit";
import { DailyLimitCard, DailyLimitNotice } from "@/components/trainYourMind/DailyLimitCard";
import { newCompletionKey } from "@/lib/trainYourMind/dailyUsage";
import { DailyUsageIndicator } from "@/components/trainYourMind/DailyUsageIndicator";
import { recordExerciseSeen } from "@/lib/trainYourMind/exerciseHistory";
import { useTrainChild } from "@/lib/trainYourMind/useTrainChild";
import { useProgression } from "@/lib/trainYourMind/useProgression";
import { levelProgress, type ProgressEvent } from "@/lib/trainYourMind/progression";
import {
  LEVEL_NAMES,
  type ChoiceExercise,
  type EngineCategory,
  type Level,
  type MoveExercise,
  type TrainExercise,
  type TrainResponse,
} from "@/lib/trainYourMind/curriculum";

/**
 * The shared Train Your Chess Mind drill. One engine, seven categories' worth of
 * content: the server picks the exercise (history-aware, Premium-gated), this
 * component renders it, times it, explains it, and feeds the result into the
 * child's progression. World styling comes from the design tokens, so the same
 * component looks right in all three Worlds.
 */

type Phase = "loading" | "reveal" | "question" | "answered" | "error" | "locked" | "limit";

const FETCH_TIMEOUT_MS = 12000;

export function TrainDrill({
  category,
  title,
  tagline,
}: {
  category: EngineCategory;
  title: string;
  tagline: string;
}) {
  const child = useTrainChild();
  const { state: premium, loading: premiumLoading } = usePremium();
  const progression = useProgression(child.childId, child.resolved, category, premium.isPremium);
  const dailyLimit = useTrainYourMindDailyLimit(child.childId, category);
  const boardSize = useResponsiveBoardSize(300, { widthMultiplier: 0.85, maxSize: 720 });

  const [exercise, setExercise] = useState<TrainExercise | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [lockedLevel, setLockedLevel] = useState<Level | null>(null);
  const [event, setEvent] = useState<ProgressEvent | null>(null);
  const [solved, setSolved] = useState(0);
  // choice state
  const [chosen, setChosen] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [peeked, setPeeked] = useState(false);
  // move state
  const [displayFen, setDisplayFen] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [moveResult, setMoveResult] = useState<"playing" | "correct" | "incorrect">("playing");

  const seen = useRef<string[]>([]);
  const lastFamily = useRef<string | null>(null);
  const prefetched = useRef<Promise<TrainResponse | null> | null>(null);
  // One key per PRESENTED exercise: the server counts a completion once per key, so a
  // retried or duplicated request can never consume two of the day's slots.
  const completionKey = useRef<string | null>(null);
  const [refused, setRefused] = useState(false);
  const startedAt = useRef<number | null>(null);
  const startedFlow = useRef(false);
  const levelRef = useRef<Level>(1);
  levelRef.current = progression.level;
  const reinforceRef = useRef<string | null>(null);
  reinforceRef.current = progression.state.reinforce;

  const fetchExercise = useCallback(
    async (level: Level): Promise<TrainResponse | null> => {
      const params = new URLSearchParams({
        category,
        level: String(level),
        exclude: seen.current.slice(-40).join(","),
        d: localDateString(),
      });
      if (lastFamily.current) params.set("lastFamily", lastFamily.current);
      if (reinforceRef.current) params.set("family", reinforceRef.current);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/chess-mind/train?${params}`, { signal: ctl.signal });
        if (!res.ok && res.status !== 200) return null;
        return (await res.json()) as TrainResponse;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    [category]
  );

  /** Show an exercise; record it in the child's history at the moment it is shown. */
  const present = useCallback(
    (resp: TrainResponse | null) => {
      if (resp?.dailyLimit) {
        // The server will not serve a 4th free exercise in this category today.
        dailyLimit.markReached();
        setPhase("limit");
        return;
      }
      if (resp?.locked) {
        setLockedLevel(resp.locked.level);
        setPhase("locked");
        return;
      }
      const ex = resp?.exercise ?? null;
      if (!ex) {
        setPhase("error");
        return;
      }
      seen.current.push(ex.id);
      completionKey.current = newCompletionKey();
      lastFamily.current = ex.family;
      if (child.childId) void recordExerciseSeen(createClient(), child.childId, category, ex.id);
      setExercise(ex);
      setChosen(null);
      setPeeked(false);
      setEvent(null);
      setMoveResult("playing");
      setStepIndex(0);
      setDisplayFen(ex.fen);
      setBoardKey((k) => k + 1);
      if (ex.kind === "choice" && ex.blind) {
        setSecondsLeft(ex.blind.showSeconds);
        startedAt.current = null;
        setPhase("reveal");
      } else {
        setPhase("question");
        startedAt.current = performance.now();
      }
    },
    [category, child.childId, dailyLimit]
  );

  // First exercise: wait for the child, their progress and Premium status.
  useEffect(() => {
    if (!progression.ready || premiumLoading || startedFlow.current) return;
    startedFlow.current = true;
    setPhase("loading");
    void fetchExercise(progression.level).then(present);
  }, [progression.ready, premiumLoading, progression.level, fetchExercise, present]);

  // Reveal countdown for blind exercises.
  useEffect(() => {
    if (phase !== "reveal") return;
    if (secondsLeft <= 0) {
      setPhase("question");
      startedAt.current = performance.now();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  function finish(correct: boolean, assisted: boolean) {
    if (!exercise) return;
    const ms = startedAt.current === null ? 0 : performance.now() - startedAt.current;
    const ev = progression.record({ correct, ms, assisted, family: exercise.family, level: exercise.level });
    setEvent(ev.kind === "none" ? null : ev);
    if (correct) {
      setSolved((n) => n + 1);
      if (child.childId) recordChessMindSolve(createClient(), child.childId, category).catch(() => {});
    }
    setPhase("answered");

    // The learner COMPLETED this exercise (answered it, right or wrong): record it with the
    // server, which holds the one global daily count. The key makes a repeat of this same
    // exercise (a retry on a move exercise, a duplicate request) count once.
    const key = completionKey.current;
    const exerciseId = exercise.id;
    void (async () => {
      const outcome = key ? await dailyLimit.recordCompletion(key, exerciseId) : null;
      if (outcome && !outcome.allowed) {
        // The server refused: today's free slots were already used (e.g. another device).
        setRefused(true);
        return;
      }
      // Only fetch the next exercise while another slot remains. At the last slot nothing is
      // prefetched at all, so a 4th exercise is never loaded in the background.
      if (outcome && !outcome.isPremium && (outcome.remaining ?? 0) <= 0) return;
      // Prefetch while the learner reads the explanation. The level and reinforcement flag
      // were just updated by record().
      if (completionKey.current === key) prefetched.current = fetchExercise(levelRef.current);
    })();
  }

  function answerChoice(index: number) {
    if (!exercise || exercise.kind !== "choice" || phase !== "question" || chosen !== null) return;
    setChosen(index);
    finish(index === exercise.correctIndex, peeked);
  }

  function handleMove(opts: { from: Square; to: Square; isCheckmate: boolean }) {
    if (!exercise || exercise.kind !== "move" || moveResult !== "playing") return;
    const step = exercise.steps[stepIndex];
    const isFinal = stepIndex === exercise.steps.length - 1;
    const matches = (m: { from: string; to: string }) => m.from === opts.from && m.to === opts.to;
    const ok = matches(step) || (step.alts ?? []).some(matches) || (isFinal && exercise.finalStepAcceptsAnyMate && opts.isCheckmate);
    if (!ok) {
      setMoveResult("incorrect");
      finish(false, false);
      return;
    }
    if (isFinal) {
      setMoveResult("correct");
      finish(true, false);
      return;
    }
    // Apply the player's move and the scripted opponent reply, then continue the line.
    const g = new Chess(displayFen);
    g.move({ from: opts.from, to: opts.to, promotion: step.promotion ?? "q" });
    if (step.reply) g.move({ from: step.reply.from, to: step.reply.to, promotion: step.reply.promotion });
    setDisplayFen(g.fen());
    setStepIndex((i) => i + 1);
    setBoardKey((k) => k + 1);
  }

  function retryMove() {
    if (!exercise || exercise.kind !== "move") return;
    setMoveResult("playing");
    setStepIndex(0);
    setDisplayFen(exercise.fen);
    setBoardKey((k) => k + 1);
    setPhase("question");
    startedAt.current = performance.now();
  }

  async function next() {
    setPhase("loading");
    const p = prefetched.current;
    prefetched.current = null;
    const resp = p ? await p : await fetchExercise(levelRef.current);
    present(resp ?? (await fetchExercise(levelRef.current)));
  }

  function retryLoad() {
    setPhase("loading");
    void fetchExercise(levelRef.current).then(present);
  }

  // ---------------------------------------------------------------- render
  // Same limit state for every category once today's free training is used up — but never in place
  // of an exercise whose result the learner is still reading.
  if (phase === "limit" || refused || (dailyLimit.reached && phase !== "answered")) {
    return <DailyLimitCard categoryLabel={title} />;
  }

  const header = (
    <>
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>{title}</h1>
        <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">{tagline}</p>
      </div>
      <DailyUsageIndicator usedToday={dailyLimit.usedToday} limit={dailyLimit.limit} isPremium={dailyLimit.isPremium} />
    </>
  );

  const backLink = (
    <Link
      href="/chess-mind"
      className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
    >
      {backLabel("TRAIN_YOUR_MIND")}
    </Link>
  );

  if (phase === "loading" && !exercise) return <ScreenSkeleton maxWidth="compact" />;

  if (phase === "locked") {
    return (
      <Screen maxWidth="medium" topSafeArea="icons">
        {header}
        <div className="mx-auto w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">🔓</span>
          <p className="font-classic-display text-lg text-premium-ivory">
            {lockedLevel ? LEVEL_NAMES[lockedLevel] : "This level"} unlocks with Premium
          </p>
          <p className="font-classic-body text-sm text-premium-ivory/65">
            Free training covers Foundation and Developing. Premium opens the full ladder up to Master — deeper positions,
            longer lines and richer explanations.
          </p>
          <Link href="/upgrade" className="font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center justify-center">
            See Premium
          </Link>
        </div>
        {backLink}
      </Screen>
    );
  }

  if (phase === "error" || !exercise) {
    return (
      <Screen maxWidth="medium" topSafeArea="icons">
        {header}
        <div className="mx-auto w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-3 text-center">
          <p className="font-classic-body text-sm text-premium-ivory/70">We couldn&apos;t load an exercise. Check your connection and try again.</p>
          <Button onClick={retryLoad}>Try again</Button>
        </div>
        {backLink}
      </Screen>
    );
  }

  const progress = levelProgress(progression.state);
  const answered = phase === "answered";
  const correct =
    exercise.kind === "choice" ? chosen !== null && chosen === exercise.correctIndex : moveResult === "correct";

  return (
    <Screen maxWidth="medium" topSafeArea="icons">
      {header}

      <div className="flex w-full max-w-md md:max-w-3xl items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-gold truncate">
            {LEVEL_NAMES[exercise.level]} · {exercise.familyLabel}
          </p>
          <p className="font-classic-body text-xs text-premium-ivory/50 truncate">{exercise.skill}</p>
        </div>
        <div className="flex-none text-right" aria-label={`Progress to next level: ${progress.have} of ${progress.need}`}>
          <div className="flex gap-1 justify-end">
            {Array.from({ length: progress.need }, (_, i) => (
              <span key={i} className={`h-1.5 w-5 rounded-full ${i < progress.have ? "bg-premium-gold" : "bg-premium-ivory/15"}`} />
            ))}
          </div>
          <p className="font-classic-body text-[10px] text-premium-ivory/40 mt-1">Solved: {solved}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md md:max-w-3xl rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col items-center gap-4">
        <p className="font-classic-display text-base text-premium-ivory text-center">{exercise.prompt}</p>

        {exercise.kind === "choice" ? (
          <ChoiceBoard
            exercise={exercise}
            phase={phase}
            secondsLeft={secondsLeft}
            peeked={peeked}
            onPeek={() => setPeeked(true)}
            boardSize={boardSize}
            skin={child.boardSkinId}
            set={child.pieceSetId}
          />
        ) : (
          <ChessBoard
            key={boardKey}
            fen={displayFen}
            size={boardSize}
            readOnly={moveResult !== "playing"}
            playableColor={exercise.orientation}
            boardSkinId={child.boardSkinId}
            pieceSetId={child.pieceSetId}
            onMove={handleMove}
          />
        )}

        {exercise.kind === "move" && !answered && exercise.steps.length > 1 && (
          <p className="font-classic-body text-xs text-premium-ivory/50">
            Move {stepIndex + 1} of {exercise.steps.length}
          </p>
        )}

        {exercise.kind === "choice" && phase !== "reveal" && (
          <div className="grid grid-cols-2 gap-2 w-full">
            {exercise.choices.map((choice, i) => {
              const isCorrect = answered && i === exercise.correctIndex;
              const isWrong = answered && chosen === i && i !== exercise.correctIndex;
              return (
                <button
                  key={`${i}-${choice}`}
                  disabled={answered}
                  onClick={() => answerChoice(i)}
                  className={`font-classic-display rounded-premiumBtn py-2.5 px-2 min-h-[44px] border text-sm break-words ${
                    isCorrect
                      ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                      : isWrong
                      ? "border-red-400/40 bg-red-400/10 text-red-300"
                      : "border-premium-ivory/15 text-premium-ivory/80"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        )}

        {answered && (
          <div className="flex flex-col items-center gap-3 w-full">
            <p
              className={`font-classic-body text-sm text-center leading-relaxed ${
                correct ? "text-premium-gold" : "text-premium-ivory/80"
              }`}
              role="status"
            >
              {correct ? exercise.explanation.correct : exercise.explanation.incorrect}
            </p>
            {event && <EventBanner event={event} />}
            {dailyLimit.reached ? (
              <DailyLimitNotice categoryLabel={title} />
            ) : (
            <div className="flex gap-3">
              {exercise.kind === "move" && !correct && (
                <Button onClick={retryMove} tone="system">
                  Try again
                </Button>
              )}
              <Button onClick={next}>Next →</Button>
            </div>
            )}
          </div>
        )}
      </div>

      {backLink}
    </Screen>
  );
}

function ChoiceBoard({
  exercise,
  phase,
  secondsLeft,
  peeked,
  onPeek,
  boardSize,
  skin,
  set,
}: {
  exercise: ChoiceExercise;
  phase: Phase;
  secondsLeft: number;
  peeked: boolean;
  onPeek: () => void;
  boardSize: number;
  skin?: string;
  set?: string;
}) {
  const blind = exercise.blind;
  const hidden = !!blind && phase !== "reveal" && !peeked && phase !== "answered";
  const showQuestionBoard = !!blind?.questionFen && phase !== "reveal";
  const fen = showQuestionBoard ? (blind!.questionFen as string) : exercise.fen;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {phase === "reveal" && blind?.revealNote && (
        <p className="font-classic-body text-sm text-premium-gold text-center">{blind.revealNote}</p>
      )}
      {hidden && !showQuestionBoard ? (
        <div
          className="w-full aspect-square rounded-premiumBtn bg-premium-midnightDeep flex items-center justify-center"
          style={{ maxWidth: boardSize }}
          aria-label="Board hidden"
        >
          <span className="text-4xl opacity-30" aria-hidden="true">🔒</span>
        </div>
      ) : (
        <ChessBoard
          key={`${exercise.id}:${showQuestionBoard ? "q" : "a"}`}
          fen={fen}
          size={boardSize}
          readOnly
          playableColor={exercise.orientation === "b" ? "b" : undefined}
          boardSkinId={skin}
          pieceSetId={set}
        />
      )}
      {phase === "reveal" && (
        <>
          <p className="font-classic-display text-2xl text-premium-gold" aria-live="polite">{secondsLeft}</p>
          <p className="font-classic-body text-xs text-premium-ivory/50">Study the position…</p>
        </>
      )}
      {blind && phase === "question" && !peeked && !showQuestionBoard && (
        <button
          onClick={onPeek}
          className="font-classic-body text-xs text-premium-ivory/55 underline underline-offset-2 min-h-[44px]"
        >
          Show board (counts as help)
        </button>
      )}
      {blind && peeked && phase === "question" && (
        <p className="font-classic-body text-[11px] text-premium-ivory/40">Board shown — this answer won&apos;t count towards your next level.</p>
      )}
    </div>
  );
}

function EventBanner({ event }: { event: ProgressEvent }) {
  if (event.kind === "none") return null;
  const tone =
    event.kind === "level-up" || event.kind === "mastered"
      ? "border-premium-gold/40 bg-premium-gold/10 text-premium-gold"
      : "border-premium-ivory/15 bg-premium-ivory/5 text-premium-ivory/75";
  return (
    <div className={`w-full rounded-premiumBtn border px-3 py-2 text-center font-classic-body text-xs ${tone}`} role="status">
      {event.message}
      {event.kind === "premium-cap" && (
        <>
          {" "}
          <Link href="/upgrade" className="underline underline-offset-2">
            See Premium
          </Link>
        </>
      )}
    </div>
  );
}

export type { ChoiceExercise, MoveExercise };
