"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { BRAND } from "@/lib/brand";
import type { SchoolProgress } from "@/content/school/types";
import { SCHOOL_UNLOCKS, TOTAL_SESSIONS } from "@/content/school/sessions";
import { completedCount, hasGraduated } from "@/lib/school/v2/progress";
import { orderedSkillClaims } from "@/lib/school/v2/parentSummary";
import { loadSchoolProgress } from "@/lib/school/v2/queries";
import { mergeProgress } from "@/lib/school/v2/storage";
import { MilestoneCard, OllieCoach } from "./Coach";

/**
 * The certificate, hydrated with the device's own progress.
 *
 * A child who finished session 30 on this phone has graduated whether or not
 * the server row has caught up (or exists yet), and the certificate is the
 * one screen where "come back later" would be unforgivable. Same merge as the
 * classroom and the parent page; the server-rendered state is never
 * downgraded.
 *
 * Everything printed is a fact from progress: the name on the profile, the
 * timestamp the final session was recorded, the skills the completed sessions
 * actually teach. No level, no rating, no score.
 */
export function CertificateView({
  childId,
  childName,
  initialProgress,
}: {
  childId: string;
  childName: string;
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

  const graduated = hasGraduated(progress);
  const done = completedCount(progress);
  const graduateUnlock = SCHOOL_UNLOCKS.find((u) => u.id === "graduate")!;

  if (!graduated) {
    const left = TOTAL_SESSIONS - done;
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-20 pt-4">
        <p className={`${TEXT.meta} text-premium-gold`}>CHESS SCHOOL</p>
        <h1 className={TEXT.display}>Graduation Day</h1>
        <OllieCoach
          line={`Not yet. ${left} session${left === 1 ? "" : "s"} to go, and the last one is a real duel. I'll be there.`}
        />
        <Link href="/chess-school/classroom">
          <Button tone="premium" block>
            Back to the classroom
          </Button>
        </Link>
      </main>
    );
  }

  const date = new Date(progress.graduatedAt as string);
  // No Intl API at all -- not even with a fixed locale. Whether
  // Intl.DateTimeFormat("en-US", ...) prints "September 12, 2026" or
  // "12 September 2026" depends on whether the runtime's ICU data is full or
  // small (a real difference between this Node server and a browser, found
  // by this pass), and either way is a hydration mismatch on the certificate's
  // one date. Building the string by hand is the only way both renders are
  // guaranteed to produce the identical bytes.
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  const skills = orderedSkillClaims(progress);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-20 pt-4">
      <OllieCoach line="You're not learning chess anymore. You're a chess player." tone="proud" />

      {/* The certificate proper. */}
      <section
        aria-label="Chess School graduation certificate"
        className="relative overflow-hidden rounded-premiumCard border-2 border-premium-gold/50 bg-gradient-to-b from-[#1b1a33] to-[#0f1629] p-7 text-center shadow-premiumCard"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-[1.1rem] border border-premium-gold/20"
        />
        <p className={`${TEXT.meta} text-premium-gold`}>{BRAND.name.toUpperCase()}</p>
        <p className={`${TEXT.meta} mt-0.5 text-premium-ivory/60`}>CHESS SCHOOL</p>
        <p className="mt-3 font-classic-display text-lg tracking-widest text-premium-ivory/90">
          CERTIFICATE OF GRADUATION
        </p>
        <p className={`${TEXT.caption} mt-4`}>This certifies that</p>
        <h1 className="mt-2 font-classic-display text-3xl text-premium-ivory">{childName}</h1>
        <p className={`${TEXT.body} mt-3 text-premium-ivory/85`}>
          has completed Chess School — all {TOTAL_SESSIONS} sessions — and is ready to play chess.
        </p>
        <p className="mt-2 font-classic-display text-2xl tracking-wide text-premium-gold">
          GRADUATED CHESS PLAYER
        </p>
        {dateLabel ? <p className={`${TEXT.caption} mt-4`}>{dateLabel}</p> : null}
        <p className={`${TEXT.caption} mt-6 italic text-premium-ivory/50`}>
          🦉 Ollie — Chess Coach
        </p>

        <div className="mt-6 text-left">
          <p className={`${TEXT.meta} text-premium-ivory/50`}>CAN NOW</p>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {skills.map((s) => (
              <li key={s} className={`${TEXT.caption} flex gap-2 text-premium-ivory/80`}>
                <span aria-hidden="true" className="text-premium-gold">
                  ✓
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The share card — the version meant to be screenshotted. */}
      <div>
        <p className={`${TEXT.meta} mb-2 text-premium-ivory/50`}>SHARE CARD</p>
        <MilestoneCard unlock={graduateUnlock} childName={childName} />
        <p className={`${TEXT.caption} mt-2 text-center`}>Screenshot this and show someone. Then challenge them.</p>
      </div>

      <Link href="/free-play">
        <Button tone="premium" block size="lg">
          Play a game
        </Button>
      </Link>
      <Link
        href="/chess-school/classroom"
        className={`${TEXT.caption} text-center underline underline-offset-2`}
      >
        Back to the classroom
      </Link>
    </main>
  );
}
