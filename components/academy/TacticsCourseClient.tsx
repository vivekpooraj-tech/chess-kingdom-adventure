"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TACTICS_LESSONS } from "@/content/tacticsLessons";
import { ListItemRow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { TacticsPaywall } from "@/components/upgrade/TacticsPaywall";

type LessonStatus = "not-started" | "in-progress" | "completed";

const STATUS_ICON: Record<LessonStatus, string> = {
  "not-started": "○",
  "in-progress": "◐",
  completed: "✓",
};

const CONCEPTS_COVERED = [
  "Forks", "Pins", "Skewers", "Discovered Attacks", "Deflection", "Decoy", "Zwischenzug", "Back-Rank Mates",
];

export function TacticsCourseClient({
  isPremium,
  progressByLessonId,
}: {
  isPremium: boolean;
  progressByLessonId: Record<string, "in_progress" | "completed">;
}) {
  const router = useRouter();
  const [showPaywall, setShowPaywall] = useState(false);

  function statusFor(id: string): LessonStatus {
    const p = progressByLessonId[id];
    if (p === "completed") return "completed";
    if (p === "in_progress") return "in-progress";
    return "not-started";
  }

  const completedCount = TACTICS_LESSONS.filter((l) => statusFor(l.id) === "completed").length;
  const progressPercent = Math.round((completedCount / TACTICS_LESSONS.length) * 100);

  const nextLesson = TACTICS_LESSONS.find((l) => statusFor(l.id) !== "completed") ?? TACTICS_LESSONS[0];
  const nextLessonLocked = !nextLesson.free && !isPremium;

  function openLesson(id: string, free: boolean) {
    if (!free && !isPremium) {
      setShowPaywall(true);
      return;
    }
    router.push(`/academy/tactics/${id}`);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>Chess Mind Academy</p>
        <h1 className={`${TEXT.display} mt-1`}>Tactics</h1>
        <p className={`${TEXT.body} mt-2`}>
          Learn to spot the moves that win material, create threats, and turn opportunities into
          victories.
        </p>
      </div>

      <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-classic-display text-sm text-premium-ivory">
            {completedCount} / {TACTICS_LESSONS.length} lessons completed
          </p>
          <p className={TEXT.caption}>{progressPercent}%</p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-premium-goldMuted to-premium-gold"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <Button
          tone="premium"
          size="md"
          className="mt-1"
          onClick={() => openLesson(nextLesson.id, nextLesson.free)}
        >
          {nextLessonLocked ? "Unlock to Continue" : completedCount === 0 ? "Start the Course" : "Continue"}
        </Button>
      </div>

      <div>
        <p className={`${TEXT.caption} uppercase tracking-wide mb-2`}>What you'll learn</p>
        <div className="flex flex-wrap gap-1.5">
          {CONCEPTS_COVERED.map((c) => (
            <span
              key={c}
              className="font-classic-body text-xs text-premium-ivory/70 bg-premium-navy/70 border border-white/5 rounded-full px-2.5 py-1"
            >
              {c}
            </span>
          ))}
          <span className="font-classic-body text-xs text-premium-ivory/40 px-2.5 py-1">
            +{TACTICS_LESSONS.length - CONCEPTS_COVERED.length} more
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {TACTICS_LESSONS.map((lesson) => {
          const status = statusFor(lesson.id);
          const locked = !lesson.free && !isPremium;
          return (
            <ListItemRow key={lesson.id} onClick={() => openLesson(lesson.id, lesson.free)}>
              <span
                className={`font-classic-body text-base flex-none w-5 text-center ${
                  status === "completed" ? "text-premium-gold" : "text-premium-ivory/40"
                }`}
                aria-hidden="true"
              >
                {STATUS_ICON[status]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-classic-display text-sm text-premium-ivory truncate">
                  {lesson.order}. {lesson.title}
                </p>
              </div>
              {locked ? (
                <span className="font-classic-body text-[11px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                  🔒 Full Version
                </span>
              ) : (
                <span className="text-premium-gold text-lg flex-none">→</span>
              )}
            </ListItemRow>
          );
        })}
      </div>

      <Link
        href="/academy"
        className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/40 underline underline-offset-2 text-center"
      >
        Back to the Academy
      </Link>

      {showPaywall && <TacticsPaywall onDismiss={() => setShowPaywall(false)} />}
    </div>
  );
}
