"use client";

import { PrimaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";

/**
 * Shown when the day's chess time is used up.
 *
 * Deliberately calm and factual rather than a cartoon lock-out. Chess Mind is
 * used by adults and teenagers as well as children, and the previous screen
 * ("Time to rest for today!" over a large moon) read as a punishment aimed at a
 * small child — the wrong tone for a fourteen-year-old, and faintly absurd for
 * an adult.
 *
 * It also states the facts a person actually wants at that moment: how long
 * they had, how much they used, when it comes back, and who controls it. A
 * limit that explains itself feels like a rule; one that does not feels like a
 * malfunction.
 */
export function TimeCompleteOverlay({
  limitMinutes,
  usedMinutes,
}: {
  limitMinutes: number;
  usedMinutes: number;
}) {
  const hours = Math.floor(limitMinutes / 60);
  const mins = limitMinutes % 60;
  const limitLabel =
    limitMinutes === 0
      ? "No chess time is scheduled today"
      : hours > 0
        ? `${hours}h${mins ? ` ${mins}m` : ""} today`
        : `${mins} minutes today`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-time-title"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-premium-midnight/95 px-5 py-8 backdrop-blur-sm"
    >
      <PrimaryCard className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className={`${TEXT.meta} text-premium-gold`}>Screen time</p>
          <h1 id="screen-time-title" className="font-classic-display text-2xl text-premium-ivory">
            Today&apos;s chess time is complete
          </h1>
          <p className={TEXT.body}>
            {limitMinutes === 0
              ? "There is no chess time scheduled for today. Your next session begins tomorrow."
              : "Your time picks up again tomorrow. Everything you finished today has been saved."}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-3 py-2.5">
            <dt className={TEXT.meta}>Daily limit</dt>
            <dd className="font-classic-display text-lg text-premium-ivory">{limitLabel}</dd>
          </div>
          <div className="rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-3 py-2.5">
            <dt className={TEXT.meta}>Time used</dt>
            <dd className="font-classic-display text-lg text-premium-ivory">
              {usedMinutes} min
            </dd>
          </div>
        </dl>

        <p className={`${TEXT.caption} normal-case`}>
          Chess time is set by a parent in the Parent Dashboard. Ask them if you need it changed —
          a new limit takes effect straight away.
        </p>
      </PrimaryCard>
    </div>
  );
}
