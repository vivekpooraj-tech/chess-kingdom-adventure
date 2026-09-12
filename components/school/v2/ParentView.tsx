"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import type { SchoolProgress } from "@/content/school/types";
import { SCHOOL_MODULES, SCHOOL_ACTS } from "@/content/school/modules";
import { parentSummary } from "@/lib/school/v2/parentSummary";
import { moduleProgress } from "@/lib/school/v2/progress";
import { loadSchoolProgress } from "@/lib/school/v2/queries";
import { mergeProgress } from "@/lib/school/v2/storage";

/**
 * The parent view, hydrated with the device's own progress.
 *
 * A parent usually reads this on the same phone the child learns on. If the
 * server row is behind — or the progress table has not been migrated yet —
 * the device still knows what happened, and a parent screen that says "0 of
 * 30" next to a child who finished three sessions tonight is exactly the kind
 * of wrong number this course refuses to show. Same merge as the classroom.
 */
export function ParentView({
  childId,
  name,
  initialProgress,
}: {
  childId: string;
  name: string;
  initialProgress: SchoolProgress;
}) {
  const [progress, setProgress] = useState(initialProgress);
  useEffect(() => {
    let cancelled = false;
    loadSchoolProgress(createClient(), childId).then(({ progress: merged }) => {
      if (!cancelled) setProgress((current) => mergeProgress(current, merged));
    });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  const summary = parentSummary(progress);
  const modules = moduleProgress(progress);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-20 pt-4">
      <header>
        <p className={`${TEXT.meta} text-premium-gold`}>CHESS SCHOOL · FOR PARENTS</p>
        <h1 className={`${TEXT.display} mt-1`}>How {name} is doing</h1>
        <p className={`${TEXT.caption} mt-1`}>{summary.sessionsLine} finished. No scores here — just what they can do.</p>
      </header>

      {/* The whole picture in three blocks a non-chess parent can read in
          seconds: what they can do, what they are on now, what comes next. */}
      <section className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5">
        <p className={`${TEXT.meta} text-premium-gold`}>{name.toUpperCase()} CAN NOW</p>
        {summary.allSkills.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {summary.allSkills.map((line) => (
              <li key={line} className={`${TEXT.body} flex gap-2 text-premium-ivory/90`}>
                <span aria-hidden="true" className="text-premium-gold">
                  ✓
                </span>
                <span>{line.charAt(0).toUpperCase() + line.slice(1)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${TEXT.body} mt-2`}>
            Nothing yet — they haven&rsquo;t finished a session. That is a completely normal place to start.
          </p>
        )}

        {!summary.graduated ? (
          <>
            <p className={`${TEXT.meta} mt-5 text-premium-ivory/50`}>CURRENTLY LEARNING</p>
            <p className={`${TEXT.body} mt-1 flex gap-2 text-premium-ivory/90`}>
              <span aria-hidden="true" className="text-premium-gold">
                →
              </span>
              <span>
                {summary.currentlyLearning.charAt(0).toUpperCase() + summary.currentlyLearning.slice(1)}
                <span className="text-premium-ivory/50"> · {summary.learningNext}</span>
              </span>
            </p>
            {summary.afterThat ? (
              <>
                <p className={`${TEXT.meta} mt-4 text-premium-ivory/50`}>NEXT</p>
                <p className={`${TEXT.body} mt-1 flex gap-2 text-premium-ivory/90`}>
                  <span aria-hidden="true" className="text-premium-gold">
                    →
                  </span>
                  <span>{summary.afterThat}</span>
                </p>
              </>
            ) : null}
          </>
        ) : (
          <p className={`${TEXT.body} mt-4 text-premium-ivory/90`}>{summary.currentFocus}</p>
        )}
      </section>

      <section className="rounded-premiumCard border border-premium-gold/30 bg-gradient-to-br from-premium-gold/[0.08] to-transparent p-5">
        <p className={`${TEXT.meta} text-premium-gold`}>TRY THIS TOGETHER TONIGHT</p>
        <p className={`${TEXT.body} mt-2 text-premium-ivory/90`}>{summary.practiceTogether}</p>
      </section>

      <section>
        <p className={`${TEXT.meta} mb-3 text-premium-ivory/50`}>THE COURSE</p>
        <ul className="space-y-2">
          {modules.map(({ module, completed, total, isCurrent }) => (
            <li
              key={module.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                isCurrent ? "border-premium-gold/35 bg-premium-gold/[0.06]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="min-w-0">
                <p className={`${TEXT.caption}`}>{SCHOOL_ACTS[module.act]}</p>
                <p className={`${TEXT.body} text-premium-ivory/90`}>
                  {module.number}. {module.title}
                </p>
              </div>
              <p className={`${TEXT.caption} flex-none`}>
                {completed} / {total}
              </p>
            </li>
          ))}
        </ul>
        <p className={`${TEXT.caption} mt-3`}>
          {SCHOOL_MODULES.length} modules, {modules.reduce((n, m) => n + m.total, 0)} sessions. Self-paced — there is no
          streak to keep and nothing expires.
        </p>
      </section>

      <section className="rounded-premiumCard border border-white/10 bg-white/[0.03] p-5">
        <p className={`${TEXT.meta} text-premium-ivory/50`}>SAFETY</p>
        <p className={`${TEXT.body} mt-2`}>
          Chess School has no chat and no strangers. Parent Mode and pass-and-play happen on this device, between people
          in the same room.
        </p>
      </section>

      <Link href="/chess-school/classroom">
        <Button tone="premium" block>
          Back to the classroom
        </Button>
      </Link>
    </main>
  );
}
