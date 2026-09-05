"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChessBoard } from "@/components/board/ChessBoard";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { PrimaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { TEXT } from "@/lib/designSystem";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { OllieNote } from "@/components/ollie/OllieNote";
import type { ReactionChallenge, ReactionResponse } from "@/lib/chessMind/reactionTypes";

/**
 * Reaction — recognise the right move quickly.
 *
 * The measurement is the feature, so the timing is handled carefully:
 *
 *  - The clock starts only after the position has actually been painted, via a
 *    double requestAnimationFrame. Starting it at fetch time, or at the top of
 *    a render, would count network and layout time as thinking time.
 *  - The next challenge is prefetched while the learner reads their feedback,
 *    so loading never sits between challenges.
 *  - performance.now() is used rather than Date.now(): it is monotonic and
 *    unaffected by clock adjustments.
 *  - A challenge whose timer never legitimately started is not recorded at all,
 *    rather than recorded with a fabricated duration.
 *
 * Every number shown to the learner is measured. Nothing here is decorative.
 */

const BEST_KEY = "chessmind-reaction-best";
type Status = "waiting" | "live" | "correct" | "wrong";

interface SessionStats {
  attempts: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** Total measured time across CORRECT answers only, in ms. Mixing in wrong
   *  answers would make "average reaction time" meaningless. */
  totalMs: number;
}

const EMPTY: SessionStats = { attempts: 0, correct: 0, streak: 0, bestStreak: 0, totalMs: 0 };

export function ReactionTrainer() {
  const [challenge, setChallenge] = useState<ReactionChallenge | null>(null);
  const [status, setStatus] = useState<Status>("waiting");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [stats, setStats] = useState<SessionStats>(EMPTY);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const startedAt = useRef<number | null>(null);
  const prefetched = useRef<ReactionChallenge | null>(null);
  const seen = useRef<string[]>([]);
  const childId = useRef<string | null>(null);
  const streakRef = useRef(0);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user || cancelled) return;
        const res = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        if (!cancelled) childId.current = res.child?.id ?? null;
      } catch {
        /* progress just won't be recorded */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchChallenge = useCallback(async (): Promise<ReactionChallenge | null> => {
    const params = new URLSearchParams({
      streak: String(streakRef.current),
      exclude: seen.current.slice(-40).join(","),
    });
    try {
      const res = await fetch(`/api/chess-mind/reaction?${params}`);
      if (!res.ok) return null;
      const json: ReactionResponse = await res.json();
      return json.challenge;
    } catch {
      return null;
    }
  }, []);

  /** Show a challenge and start its clock only once it is on screen. */
  const present = useCallback((next: ReactionChallenge | null) => {
    if (!next) {
      setFailed(true);
      return;
    }
    seen.current.push(next.id);
    startedAt.current = null;
    setChosen(null);
    setElapsed(null);
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
  }, []);

  useEffect(() => {
    void (async () => present(await fetchChallenge()))();
    // Mount only: subsequent challenges come from next().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function answer(index: number) {
    if (status !== "live" || !challenge || startedAt.current === null) return;
    const ms = performance.now() - startedAt.current;
    const right = index === challenge.correctIndex;

    setChosen(index);
    setElapsed(ms);
    setStatus(right ? "correct" : "wrong");

    setStats((s) => {
      const streak = right ? s.streak + 1 : 0;
      streakRef.current = streak;
      return {
        attempts: s.attempts + 1,
        correct: s.correct + (right ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        totalMs: s.totalMs + (right ? ms : 0),
      };
    });

    if (right) {
      if (bestMs === null || ms < bestMs) {
        setBestMs(ms);
        try {
          window.localStorage.setItem(BEST_KEY, String(Math.round(ms)));
        } catch {
          /* not storable — the in-session best still shows */
        }
      }
      const id = childId.current;
      if (id) {
        void recordChessMindSolve(createClient(), id, "reaction").catch(() => {
          /* progress is best-effort; never interrupt training */
        });
      }
    }

    // Load the next one now, while the learner is reading feedback.
    void fetchChallenge().then((c) => {
      prefetched.current = c;
    });
  }

  function next() {
    const ready = prefetched.current;
    prefetched.current = null;
    if (ready) {
      present(ready);
    } else {
      setStatus("waiting");
      void fetchChallenge().then(present);
    }
  }

  const avgMs = stats.correct > 0 ? stats.totalMs / stats.correct : null;
  const accuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : null;

  if (failed) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>Reaction training could not load a position.</p>
        <Link href="/chess-mind">
          <Button tone="premium">Back to Chess Mind</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-premium-midnight px-5 pt-6 pb-nav-safe">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/chess-mind"
            className="flex min-h-[44px] items-center font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            ← Chess Mind
          </Link>
          {challenge && (
            <span className={TEXT.caption}>
              {challenge.tier} · {challenge.rating}
            </span>
          )}
        </div>

        <div>
          <h1 className="font-classic-display text-2xl text-premium-ivory">Reaction</h1>
          <p className={`${TEXT.body} mt-1`}>
            Spot the move that wins. Accuracy first — speed is what accuracy turns into.
          </p>
        </div>

        {/* Live session numbers, all measured. */}
        {/* Two columns on the narrowest phones: at 320px four columns clipped
            the "Accuracy" label, and a statistic you cannot read is not a
            statistic. Four across from 640px up. */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Session statistics">
          <Stat label="Streak" value={String(stats.streak)} />
          <Stat label="Accuracy" value={accuracy === null ? "—" : `${accuracy}%`} />
          <Stat label="Average" value={avgMs === null ? "—" : `${(avgMs / 1000).toFixed(2)}s`} />
          <Stat label="Best" value={bestMs === null ? "—" : `${(bestMs / 1000).toFixed(2)}s`} />
        </dl>

        {!challenge ? (
          <SkeletonBlock className="w-full aspect-square" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <SideToMoveIndicator color={challenge.sideToMove} tone="premium" />
              <span className={TEXT.caption} role="status">
                {status === "waiting"
                  ? "Getting the position ready…"
                  : status === "live"
                    ? "Choose the winning move"
                    : status === "correct"
                      ? `Correct in ${((elapsed ?? 0) / 1000).toFixed(2)} seconds`
                      : "Not that one"}
              </span>
            </div>

            <div className="w-full max-w-[360px] mx-auto">
              <ChessBoard readOnly fen={challenge.fen} size={340} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {challenge.options.map((opt, i) => {
                const reveal = status === "correct" || status === "wrong";
                const isAnswer = i === challenge.correctIndex;
                const isChoice = chosen === i;
                return (
                  <button
                    key={`${opt.from}${opt.to}`}
                    type="button"
                    onClick={() => answer(i)}
                    disabled={status !== "live"}
                    aria-label={`Play ${opt.san}`}
                    className={`min-h-[52px] rounded-premiumBtn border px-3 py-2 font-classic-body text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 disabled:cursor-default ${
                      reveal && isAnswer
                        ? "border-premium-gold bg-premium-gold/15 text-premium-ivory"
                        : reveal && isChoice
                          ? "border-red-400/60 bg-red-500/10 text-premium-ivory"
                          : "border-white/10 bg-premium-navy/70 text-premium-ivory hover:border-premium-gold/30"
                    }`}
                  >
                    {/* Marked with a glyph as well as colour, so the outcome is
                        not carried by colour alone. */}
                    {reveal && isAnswer ? <span aria-hidden="true">✓ </span> : null}
                    {reveal && isChoice && !isAnswer ? <span aria-hidden="true">✕ </span> : null}
                    {opt.san}
                  </button>
                );
              })}
            </div>

            {(status === "correct" || status === "wrong") && (
              <PrimaryCard className="flex flex-col gap-2">
                <p className={TEXT.body}>
                  {status === "correct"
                    ? stats.streak >= 3
                      ? `${stats.streak} in a row. The positions will get harder from here.`
                      : "Right move."
                    : `The move was ${challenge.options[challenge.correctIndex].san}.`}
                </p>
                {/* Ollie speaks only when the mistake was a RUSHED one — a
                    wrong answer inside two seconds. Saying "slow down" to
                    someone who thought carefully and still got it wrong would
                    be both wrong and annoying. */}
                {status === "wrong" && (elapsed ?? 0) < 2000 && (
                  <OllieNote>
                    Fast is useful — but accurate comes first. Speed is what accuracy turns into,
                    not the other way round.
                  </OllieNote>
                )}
                <Button tone="premium" onClick={next} className="w-full">
                  Next position →
                </Button>
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
