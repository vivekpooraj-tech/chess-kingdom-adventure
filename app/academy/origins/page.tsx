"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getAcademyProgress,
  saveAcademyVideoProgress,
  completeAcademyContent,
  getEarnedAchievementKeys,
  evaluateAndAwardAchievements,
  getCompletedDays,
  getCompletedAcademyContentIds,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { HISTORY_OF_CHESS } from "@/content/academyVideos";
import { getAchievement } from "@/content/achievements";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { HistoryVideo } from "@/components/academy/HistoryVideo";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { TEXT } from "@/lib/designSystem";

type Stage = "loading" | "watching" | "quiz" | "done";

const SAVE_INTERVAL_MS = 5000;

export default function ChessOriginsPage() {
  const router = useRouter();
  const content = HISTORY_OF_CHESS;

  const [childId, setChildId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [readTimeline, setReadTimeline] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [newAchievement, setNewAchievement] = useState<string | null>(null);
  // The last whole-second we wrote a progress row for — timeupdate fires
  // ~4x/sec, so without this the same second was upserted several times.
  const lastSavedSecondRef = useRef(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
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

      const progress = await getAcademyProgress(supabase, child.id, content.id);
      if (progress) {
        // Only the completion flag is used — the video always starts from
        // the beginning on every visit (no resume-from-last-position), so
        // progress.progressSeconds is deliberately ignored here.
        setAlreadyCompleted(progress.status === "completed");
      }
      setStage("watching");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Best-effort "this child has seen the origins content" tracking (the
  // first-time cinematic in app/welcome keys off any row existing). Only
  // the flag matters — playback always restarts at 0:00 (HistoryVideo).
  function handleVideoProgress(currentTime: number) {
    if (!childId) return;
    const t = Math.floor(currentTime);
    if (t > 0 && t % 5 === 0 && t !== lastSavedSecondRef.current) {
      lastSavedSecondRef.current = t;
      saveAcademyVideoProgress(createClient(), childId, content.id, t).catch(() => {});
    }
  }

  function selectAnswer(questionId: string, index: number) {
    if (stage !== "quiz") return;
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
  }

  async function submitQuiz() {
    const correct = content.quiz.filter((q) => answers[q.id] === q.correctIndex).length;
    setScore(correct);
    setStage("done");

    if (childId) {
      const supabase = createClient();
      await completeAcademyContent(supabase, childId, content.id, correct).catch(() => {});

      const user = await getVerifiedUser(supabase);
      const completedDays = await getCompletedDays(supabase, childId);
      const completedAcademyIds = await getCompletedAcademyContentIds(supabase, childId);
      const { data: parent } = user
        ? await supabase
            .from("parents")
            .select(PARENT_PREMIUM_COLUMNS)
            .eq("auth_user_id", user.id)
            .single()
        : { data: null };
      const { newlyEarned } = await evaluateAndAwardAchievements(
        supabase,
        childId,
        completedDays,
        resolvePremiumState(parent).isPremium,
        completedAcademyIds
      ).catch(() => ({ newlyEarned: [] as string[], allEarned: [] as string[] }));
      if (newlyEarned.length > 0) {
        const def = getAchievement(newlyEarned[0]);
        if (def) setNewAchievement(def.title);
      }
    }
  }

  if (stage === "loading") {
    return (
      <>
        <ScreenSkeleton maxWidth="compact" />
        <PrimaryNav />
      </>
    );
  }

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          {alreadyCompleted && (
            <span className="inline-block font-classic-body text-[11px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full px-2 py-1 mb-3">
              ✓ COMPLETED
            </span>
          )}
          <h1 className={TEXT.display}>{content.title}</h1>
          <p className={`${TEXT.body} mt-2`}>{content.subtitle}</p>
        </div>

        {/* Video hero. Portrait 9:16 source: on phones the frame matches the
            clip; from lg up it becomes a 16:9 letterbox so it doesn't tower
            over the reading column. Playback is inline; a custom (web)
            fullscreen button lives on the player — see HistoryVideo. */}
        {content.videoUrl ? (
          <HistoryVideo
            src={content.videoUrl}
            poster={content.posterUrl ?? undefined}
            orientation={content.orientation}
            captionsUrl={content.captionsUrl}
            onProgress={handleVideoProgress}
          />
        ) : (
          <div
            data-orientation={content.orientation}
            className="history-video--inline relative mx-auto flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-midnight shadow-premiumCard"
          >
            <span className="text-4xl">🏛️</span>
            <p className="font-classic-body text-xs text-premium-ivory/40">Video coming soon</p>
          </div>
        )}

        {/* Timeline — the real content, available today regardless of the video. */}
        <div className="flex w-full flex-col gap-3">
          {content.timeline.map((entry) => (
            <div
              key={entry.era}
              className="rounded-premiumCard bg-premium-navy/70 p-4 flex flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-classic-display text-base text-premium-ivory">{entry.era}</p>
                <span className="font-classic-body text-[11px] text-premium-gold/70 whitespace-nowrap">
                  {entry.period}
                </span>
              </div>
              <p className="font-classic-body text-sm text-premium-ivory/60 leading-relaxed">
                {entry.text}
              </p>
            </div>
          ))}
        </div>

        {stage === "watching" && !readTimeline && (
          <Button tone="premium" onClick={() => setReadTimeline(true)}>I'm ready for the quiz →</Button>
        )}

        {stage === "watching" && readTimeline && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
            <p className="font-classic-display text-lg text-premium-ivory">What did you learn?</p>
            <Button tone="premium" onClick={() => setStage("quiz")}>Start the Quiz →</Button>
          </div>
        )}

        {stage === "quiz" && (
          <div className="flex w-full flex-col gap-4">
            {content.quiz.map((q, qi) => (
              <div key={q.id} className="rounded-premiumCard bg-premium-navy p-4 flex flex-col gap-2">
                <p className="font-classic-body text-sm text-premium-ivory">
                  {qi + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(q.id, oi)}
                      className={`text-left font-classic-body text-xs rounded-premiumBtn px-3 py-2 border transition-colors ${
                        answers[q.id] === oi
                          ? "border-premium-gold bg-premium-gold/10 text-premium-gold"
                          : "border-premium-ivory/10 text-premium-ivory/70"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button
              tone="premium"
              disabled={Object.keys(answers).length < content.quiz.length}
              onClick={submitQuiz}
            >
              Submit Answers →
            </Button>
          </div>
        )}

        {stage === "done" && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center rounded-premiumCard bg-premium-navy shadow-premiumCard p-6">
            <span className="text-5xl">🏛️</span>
            <p className="font-classic-display text-xl text-premium-ivory">
              You got {score} of {content.quiz.length} right!
            </p>
            <p className="font-classic-body text-sm text-premium-ivory/60">
              Great work exploring where chess came from.
            </p>
            {newAchievement && (
              <p className="font-classic-body text-sm text-premium-gold">
                🏆 Achievement unlocked: {newAchievement}
              </p>
            )}
            <Link href="/academy">
              <Button tone="premium" variant="ghost">Back to the Academy</Button>
            </Link>
          </div>
        )}

        <Link
          href="/academy"
          className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Academy
        </Link>
      </Screen>
      <PrimaryNav />
    </>
  );
}
