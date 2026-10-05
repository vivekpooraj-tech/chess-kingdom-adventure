"use client";

import { backLabel } from "@/lib/navigation/destinations";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChessBoard } from "@/components/board/ChessBoard";
import { useResponsiveBoardSize } from "@/lib/hooks/useResponsiveBoardSize";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { TEXT } from "@/lib/designSystem";
import { createClient } from "@/lib/supabase/client";
import { recordChessMindSolve, localDateString } from "@/lib/supabase/queries";
import { OllieNote } from "@/components/ollie/OllieNote";
import { usePremium } from "@/lib/premium/usePremium";
import { useTrainYourMindDailyLimit } from "@/lib/trainYourMind/useDailyLimit";
import { DailyLimitCard, DailyLimitNotice } from "@/components/trainYourMind/DailyLimitCard";
import { newCompletionKey } from "@/lib/trainYourMind/dailyUsage";
import { DailyUsageIndicator } from "@/components/trainYourMind/DailyUsageIndicator";
import { recordExerciseSeen } from "@/lib/trainYourMind/exerciseHistory";
import { useTrainChild } from "@/lib/trainYourMind/useTrainChild";
import { useProgression } from "@/lib/trainYourMind/useProgression";
import { REACTION_TARGET_SECONDS, levelProgress, type ProgressEvent } from "@/lib/trainYourMind/progression";
import { LEVEL_NAMES, type ChoiceExercise, type Level, type TrainResponse } from "@/lib/trainYourMind/curriculum";

/**
 * Reaction — recognise the right idea quickly.
 *
 * The measurement is the feature, so the timing is handled carefully:
 *
 *  - The clock starts only after the position has actually been painted, via a
 *    double requestAnimationFrame. Starting it at fetch time, or at the top of
 *    a render, would count network and layout time as thinking time.
 *  - The next exercise is prefetched while the learner reads their feedback,
 *    so loading never sits between exercises. A prefetched exercise is NOT
 *    recorded as seen — only one that has actually been shown is.
 *  - performance.now() is used rather than Date.now(): it is monotonic and
 *    unaffected by clock adjustments.
 *  - An exercise whose timer never legitimately started is not recorded at all,
 *    rather than recorded with a fabricated duration.
 *
 * What is measured is accuracy, response time AND consistency. A fast wrong
 * answer is never treated as progress: speed only counts when the answer is right.
 *
 * Every number shown to the learner is measured. Nothing here is decorative.
 */

const BEST_KEY = "chessmind-reaction-best";
type Status = "waiting" | "live" | "correct" | "wrong";

const MODES: { id: string | null; label: string }[] = [
  { id: null, label: "Mixed" },
  { id: "rx.flash", label: "Tactical flash" },
  { id: "rx.check", label: "Checks" },
  { id: "rx.hanging", label: "Hanging pieces" },
  { id: "rx.threat", label: "Threats" },
  { id: "rx.pattern", label: "Patterns" },
];

interface SessionStats {
  attempts: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** Measured time of every CORRECT answer, in ms. Wrong answers are excluded:
   *  mixing them in would make "average reaction time" meaningless. */
  correctTimes: number[];
}

const EMPTY: SessionStats = { attempts: 0, correct: 0, streak: 0, bestStreak: 0, correctTimes: [] };

/** Consistency = how steady the correct-answer times are (needs 4+ correct). */
export function consistencyLabel(times: number[]): string {
  if (times.length < 4) return "—";
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
  const cv = Math.sqrt(variance) / mean;
  return cv < 0.35 ? "Steady" : cv < 0.6 ? "Mostly steady" : "Variable";
}

export function ReactionTrainer() {
  const child = useTrainChild();
  const { state: premium, loading: premiumLoading } = usePremium();
  const progression = useProgression(child.childId, child.resolved, "reaction", premium.isPremium);
  const dailyLimit = useTrainYourMindDailyLimit(child.childId, "reaction");
  const boardSize = useResponsiveBoardSize(340, { widthMultiplier: 0.85, maxSize: 720 });

  const [challenge, setChallenge] = useState<ChoiceExercise | null>(null);
  const [status, setStatus] = useState<Status>("waiting");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [stats, setStats] = useState<SessionStats>(EMPTY);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  // One key per PRESENTED exercise: the server counts a completion once per key.
  const completionKey = useRef<string | null>(null);
  const [limitState, setLimitState] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [event, setEvent] = useState<ProgressEvent | null>(null);

  const startedAt = useRef<number | null>(null);
  const prefetched = useRef<ChoiceExercise | null>(null);
  const seen = useRef<string[]>([]);
  const lastFamily = useRef<string | null>(null);
  const started = useRef(false);
  const levelRef = useRef<Level>(1);
  levelRef.current = progression.level;
  const modeRef = useRef<string | null>(null);
  modeRef.current = mode;
  const reinforceRef = useRef<string | null>(null);
  reinforceRef.current = progression.state.reinforce;
  const generation = useRef(0);

  // Personal best is a per-viewer convenience; localStorage can throw in
  // private modes and preview contexts, so every access is guarded.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      if (raw) setBestMs(Number(raw) || null);
    } catch {
      /* no stored best — fine */
    }
  }, []);

  const fetchChallenge = useCallback(async (): Promise<TrainResponse | null> => {
    const params = new URLSearchParams({
      category: "reaction",
      level: String(levelRef.current),
      exclude: seen.current.slice(-40).join(","),
      d: localDateString(),
    });
    if (lastFamily.current) params.set("lastFamily", lastFamily.current);
    if (modeRef.current) params.set("mode", modeRef.current);
    if (reinforceRef.current) params.set("family", reinforceRef.current);
    try {
      const res = await fetch(`/api/chess-mind/train?${params}`);
      if (!res.ok) return null;
      return (await res.json()) as TrainResponse;
    } catch {
      return null;
    }
  }, []);

  /** Show a challenge and start its clock only once it is on screen. */
  const present = useCallback(
    (resp: TrainResponse | null) => {
      if (resp?.dailyLimit) {
        // The server will not serve a 4th free exercise in this category today.
        dailyLimit.markReached();
        setLimitState(true);
        return;
      }
      if (resp?.locked) {
        setLocked(true);
        return;
      }
      const next = resp?.exercise && resp.exercise.kind === "choice" ? resp.exercise : null;
      if (!next) {
        setFailed(true);
        return;
      }
      seen.current.push(next.id);
      completionKey.current = newCompletionKey();
      lastFamily.current = next.family;
      // Persist to the CHILD's history (not the device) at the moment the
      // exercise is actually shown — not when it is merely prefetched — so
      // another device used by the same child avoids it too.
      if (child.childId) void recordExerciseSeen(createClient(), child.childId, "reaction", next.id);
      startedAt.current = null;
      setChosen(null);
      setElapsed(null);
      setEvent(null);
      setChallenge(next);
      setStatus("waiting");

      // Two frames: the first is scheduled before the browser paints this state,
      // the second runs after it. Only then has the learner actually seen the
      // position, which is the moment the clock may honestly start.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          startedAt.current = performance.now();
          setStatus("live");
        });
      });
    },
    [child.childId, dailyLimit]
  );

  useEffect(() => {
    if (!progression.ready || premiumLoading || started.current) return;
    started.current = true;
    void fetchChallenge().then(present);
  }, [progression.ready, premiumLoading, fetchChallenge, present]);

  function chooseMode(id: string | null) {
    if (id === mode) return;
    setMode(id);
    modeRef.current = id;
    prefetched.current = null;
    generation.current++;
    setStatus("waiting");
    setChallenge(null);
    void fetchChallenge().then(present);
  }

  function answer(index: number) {
    if (status !== "live" || !challenge || startedAt.current === null) return;
    const ms = performance.now() - startedAt.current;
    const right = index === challenge.correctIndex;

    setChosen(index);
    setElapsed(ms);
    setStatus(right ? "correct" : "wrong");

    setStats((s) => {
      const streak = right ? s.streak + 1 : 0;
      return {
        attempts: s.attempts + 1,
        correct: s.correct + (right ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        correctTimes: right ? [...s.correctTimes, ms] : s.correctTimes,
      };
    });

    const ev = progression.record({
      correct: right,
      ms,
      assisted: false,
      family: challenge.family,
      level: challenge.level,
      targetSeconds: REACTION_TARGET_SECONDS[challenge.level],
    });
    setEvent(ev.kind === "none" ? null : ev);

    if (right) {
      if (bestMs === null || ms < bestMs) {
        setBestMs(ms);
        try {
          window.localStorage.setItem(BEST_KEY, String(Math.round(ms)));
        } catch {
          /* not storable — the in-session best still shows */
        }
      }
      if (child.childId) {
        void recordChessMindSolve(createClient(), child.childId, "reaction").catch(() => {
          /* progress is best-effort; never interrupt training */
        });
      }
    }

    // The learner COMPLETED this exercise (answered it, right or wrong): the server holds the
    // one global daily count and refuses a 4th free completion. The key makes a duplicate of
    // this same exercise count once.
    const key = completionKey.current;
    const exerciseId = challenge.id;
    const gen = generation.current;
    void (async () => {
      const outcome = key ? await dailyLimit.recordCompletion(key, exerciseId) : null;
      if (outcome && !outcome.allowed) {
        setLimitState(true);
        return;
      }
      // At the last free slot nothing is prefetched at all — a 4th exercise is never loaded.
      if (outcome && !outcome.isPremium && (outcome.remaining ?? 0) <= 0) return;
      // Load the next one while the learner is reading feedback. It is held in a ref and is
      // NOT recorded as seen until it is actually presented.
      const resp = await fetchChallenge();
      if (gen !== generation.current || completionKey.current !== key) return;
      prefetched.current = resp?.exercise && resp.exercise.kind === "choice" ? resp.exercise : null;
    })();
  }

  function next() {
    const ready = prefetched.current;
    prefetched.current = null;
    if (ready) {
      present({ exercise: ready });
    } else {
      setStatus("waiting");
      void fetchChallenge().then(present);
    }
  }

  const accuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : null;
  const avgMs = stats.correctTimes.length ? stats.correctTimes.reduce((a, b) => a + b, 0) / stats.correctTimes.length : null;
  const progress = levelProgress(progression.state);

  // The same limit state for every category once today's free training is used up — but never
  // in place of an exercise whose result the learner is still reading.
  if (limitState || (dailyLimit.reached && status !== "correct" && status !== "wrong")) {
    return <DailyLimitCard categoryLabel="Reaction" />;
  }

  if (locked) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className={TEXT.body}>This Reaction level unlocks with Premium.</p>
        <Link href="/upgrade">
          <Button tone="premium">See Premium</Button>
        </Link>
        <Link href="/chess-mind" className="font-body text-sm text-premium-ivory/65 underline underline-offset-2 min-h-[44px] flex items-center">
          {backLabel("TRAIN_YOUR_MIND")}
        </Link>
      </main>
    );
  }

  if (failed) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>Reaction training could not load a position.</p>
        <Link href="/chess-mind">
          <Button tone="premium">{backLabel("TRAIN_YOUR_MIND")}</Button>
        </Link>
      </main>
    );
  }

  const answered = status === "correct" || status === "wrong";

  return (
    <main className="min-h-screen bg-premium-midnight px-5 pt-safe-icons pb-nav-safe">
      <div className="mx-auto flex w-full max-w-md md:max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/chess-mind"
            className="flex min-h-[44px] items-center font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            ← {backLabel("TRAIN_YOUR_MIND")}
          </Link>
          {challenge && (
            <span className={TEXT.caption}>
              {LEVEL_NAMES[challenge.level]} · {challenge.familyLabel}
            </span>
          )}
        </div>

        <div>
          <h1 className="font-classic-display text-2xl text-premium-ivory">Reaction</h1>
          <p className={`${TEXT.body} mt-1`}>
            Recognise it fast — but accuracy first. Speed is what accuracy turns into.
          </p>
        </div>
        <DailyUsageIndicator usedToday={dailyLimit.usedToday} limit={dailyLimit.limit} isPremium={dailyLimit.isPremium} />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Reaction mode">
          {MODES.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => chooseMode(m.id)}
              aria-pressed={mode === m.id}
              className={`min-h-[44px] rounded-full border px-3 font-classic-body text-xs ${
                mode === m.id ? "border-premium-gold bg-premium-gold/15 text-premium-gold" : "border-white/10 text-premium-ivory/70"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3" aria-label={`Progress to next level: ${progress.have} of ${progress.need}`}>
          <span className={TEXT.caption}>Level progress</span>
          <div className="flex gap-1">
            {Array.from({ length: progress.need }, (_, i) => (
              <span key={i} className={`h-1.5 w-5 rounded-full ${i < progress.have ? "bg-premium-gold" : "bg-premium-ivory/15"}`} />
            ))}
          </div>
        </div>

        {/* Live session numbers, all measured. Two columns on the narrowest
            phones; three across from 640px. */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Session statistics">
          <Stat label="Streak" value={String(stats.streak)} />
          <Stat label="Accuracy" value={accuracy === null ? "—" : `${accuracy}%`} />
          <Stat label="Average" value={avgMs === null ? "—" : `${(avgMs / 1000).toFixed(2)}s`} />
          <Stat label="Best" value={bestMs === null ? "—" : `${(bestMs / 1000).toFixed(2)}s`} />
          <Stat label="Consistency" value={consistencyLabel(stats.correctTimes)} />
        </dl>

        {!challenge || dailyLimit.loading ? (
          <SkeletonBlock className="w-full aspect-square" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <SideToMoveIndicator color={challenge.orientation} tone="premium" />
              <span className={TEXT.caption} role="status">
                {status === "waiting"
                  ? "Getting the position ready…"
                  : status === "live"
                    ? "Choose quickly — but get it right"
                    : status === "correct"
                      ? `Correct in ${((elapsed ?? 0) / 1000).toFixed(2)} seconds`
                      : "Not that one"}
              </span>
            </div>
            <p className="font-classic-display text-base text-premium-ivory text-center">{challenge.prompt}</p>

            <div className="w-full mx-auto" style={{ maxWidth: boardSize }}>
              <ChessBoard
                readOnly
                fen={challenge.fen}
                size={boardSize}
                playableColor={challenge.orientation === "b" ? "b" : undefined}
                boardSkinId={child.boardSkinId}
                pieceSetId={child.pieceSetId}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {challenge.choices.map((label, i) => {
                const isAnswer = i === challenge.correctIndex;
                const isChoice = chosen === i;
                return (
                  <button
                    key={`${i}-${label}`}
                    type="button"
                    onClick={() => answer(i)}
                    disabled={status !== "live"}
                    aria-label={label}
                    className={`min-h-[52px] rounded-premiumBtn border px-3 py-2 font-classic-body text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 disabled:cursor-default ${
                      answered && isAnswer
                        ? "border-premium-gold bg-premium-gold/15 text-premium-ivory"
                        : answered && isChoice
                          ? "border-red-400/60 bg-red-500/10 text-premium-ivory"
                          : "border-white/10 bg-premium-navy/70 text-premium-ivory hover:border-premium-gold/30"
                    }`}
                  >
                    {/* Marked with a glyph as well as colour, so the outcome is
                        not carried by colour alone. */}
                    {answered && isAnswer ? <span aria-hidden="true">✓ </span> : null}
                    {answered && isChoice && !isAnswer ? <span aria-hidden="true">✕ </span> : null}
                    {label}
                  </button>
                );
              })}
            </div>

            {answered && (
              <PrimaryCard className="flex flex-col gap-2">
                <p className={TEXT.body}>
                  {status === "correct" ? challenge.explanation.correct : challenge.explanation.incorrect}
                </p>
                {status === "correct" && stats.streak >= 3 && (
                  <p className={TEXT.caption}>{stats.streak} in a row.</p>
                )}
                {event && event.kind !== "none" && (
                  <p className={`${TEXT.caption} text-premium-gold`} role="status">
                    {event.message}
                  </p>
                )}
                {/* Ollie speaks only when the mistake was a RUSHED one — a
                    wrong answer inside two seconds. Saying "slow down" to
                    someone who thought carefully and still got it wrong would
                    be both wrong and annoying. A fast wrong answer is never
                    counted as progress. */}
                {status === "wrong" && (elapsed ?? 0) < 2000 && (
                  <OllieNote>
                    Fast is useful — but accurate comes first. Speed is what accuracy turns into,
                    not the other way round.
                  </OllieNote>
                )}
                {dailyLimit.reached ? (
                  <DailyLimitNotice categoryLabel="Reaction" />
                ) : (
                  <Button tone="premium" onClick={next} className="w-full">
                    Next position →
                  </Button>
                )}
              </PrimaryCard>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-2 py-2 text-center">
      <dt className={TEXT.meta}>{label}</dt>
      <dd className="font-classic-display text-base text-premium-ivory">{value}</dd>
    </div>
  );
}
