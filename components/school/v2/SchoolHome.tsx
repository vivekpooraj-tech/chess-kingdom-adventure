"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import type { SchoolProgress } from "@/content/school/types";
import { SCHOOL_SESSIONS, TOTAL_SESSIONS } from "@/content/school/sessions";
import { SCHOOL_ACTS, SCHOOL_MODULES, getSuperpower } from "@/content/school/modules";
import {
  completedCount,
  currentModule,
  hasGraduated,
  isSessionUnlocked,
  nextBigMoment,
  nextSession,
  unlockedSuperpowerIds,
} from "@/lib/school/v2/progress";
import { childProgressLine, orderedSkillClaims } from "@/lib/school/v2/parentSummary";
import { canOpenSession, type SchoolAccess } from "@/lib/school/v2/access";
import { loadSchoolProgress } from "@/lib/school/v2/queries";
import { mergeProgress } from "@/lib/school/v2/storage";
import { OllieCoach, SchoolChip } from "./Coach";
import { UnlockSchoolButton } from "./UnlockSchoolButton";
import { GRADUATE_HREF, sessionHref } from "./SessionRunner";

/**
 * The classroom — Chess School's home.
 *
 * NOT A LESSON LIST. The Kingdom Journey answers "what is day 12"; this screen
 * answers "what happens to me next". So it leads with Ollie and one button,
 * then the thing to look forward to, then what the child can now do in their
 * own words, and only at the bottom the map of everything. A child should be
 * able to tap Continue without reading anything else.
 *
 * EVERY CLAIM IS EARNED. "You can now fork" appears because session 12 is
 * complete, not because a bar reached 40%. There is one number on the screen
 * — sessions finished of thirty — and it counts things that happened.
 */
export function SchoolHome({
  childId,
  childName,
  initialProgress,
  access,
}: {
  childId: string;
  childName: string;
  initialProgress: SchoolProgress;
  access: SchoolAccess;
}) {
  const [progress, setProgress] = useState(initialProgress);
  // A one-time, cheap CSS-only stagger for newly-listed superpowers -- the
  // "small signature reveal" the product brief asks for, without a single
  // extra dependency or a frame of animation the board has to compete with.
  const [powersRevealed, setPowersRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPowersRevealed(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSchoolProgress(createClient(), childId).then(({ progress: merged }) => {
      // Merge with what the server already rendered: a transient client-side
      // read failure must never downgrade a child below what the server knew.
      if (!cancelled) setProgress((current) => mergeProgress(current, merged));
    });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  const done = completedCount(progress);
  const graduated = hasGraduated(progress);
  const next = nextSession(progress);
  const module = currentModule(progress);
  const bigMoment = nextBigMoment(progress);
  const superpowers = unlockedSuperpowerIds(progress).map(getSuperpower).filter(Boolean);
  const claims = orderedSkillClaims(progress).slice(0, 3);
  const nextIsOpen = next ? canOpenSession(access, next.number) : false;

  const welcome = graduated
    ? "You finished. You're a chess player now — go and find someone to play."
    : done === 0
    ? `Welcome, ${childName}. Session 1 takes about ten minutes, and by the end of it you'll have made your first chess move.`
    : `Welcome back, ${childName}. Ready for your next move?`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-20 pt-4">
      {/* Identity strip: this is a classroom, not the kingdom. */}
      <header>
        <p className={`${TEXT.meta} text-premium-gold`}>CHESS SCHOOL</p>
        <h1 className={`${TEXT.display} mt-1`}>From zero to playing real people.</h1>
        <p className={`${TEXT.caption} mt-1`}>Thirty sessions. Your own pace. No streaks.</p>
      </header>

      <OllieCoach line={welcome} tone={graduated ? "proud" : "calm"} />

      {/* The one button. */}
      {graduated ? (
        <Link href={GRADUATE_HREF}>
          <Button tone="premium" block size="lg">
            🎓 See your certificate
          </Button>
        </Link>
      ) : next ? (
        nextIsOpen ? (
          <Link href={sessionHref(next.id)}>
            <Button tone="premium" block size="lg">
              {done === 0 ? "Start session 1" : `Continue · Session ${next.number}`}
            </Button>
          </Link>
        ) : (
          <UnlockSchoolButton nextSessionNumber={next.number} />
        )
      ) : null}

      {/* Where you are and what's next, in words. */}
      {next && !graduated ? (
        <section className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-2">
            {module ? <SchoolChip>{SCHOOL_ACTS[module.act]}</SchoolChip> : null}
            {module ? (
              <SchoolChip tone="gold">
                Module {module.number} · {module.title}
              </SchoolChip>
            ) : null}
          </div>
          <p className={`${TEXT.meta} mt-4 text-premium-ivory/50`}>UP NEXT</p>
          <p className={`${TEXT.subheading} mt-1`}>{next.title}</p>
          <p className={`${TEXT.body} mt-1`}>{next.subtitle}</p>
          <p className={`${TEXT.caption} mt-3`}>About {next.estimatedMinutes} minutes</p>
        </section>
      ) : null}

      {/* The thing to look forward to. */}
      {bigMoment && !graduated ? (
        <section className="rounded-premiumCard border border-premium-gold/25 bg-gradient-to-br from-premium-gold/[0.08] to-transparent p-5">
          <p className={`${TEXT.meta} text-premium-gold`}>COMING UP · BIG MOMENT</p>
          <p className={`${TEXT.subheading} mt-1`}>★ {bigMoment.title}</p>
          <p className={`${TEXT.body} mt-1`}>{bigMoment.subtitle}</p>
          {bigMoment.number !== next?.number ? (
            <p className={`${TEXT.caption} mt-2`}>
              {bigMoment.number - (next?.number ?? 1)} session{bigMoment.number - (next?.number ?? 1) === 1 ? "" : "s"} away
            </p>
          ) : null}
        </section>
      ) : null}

      {/* What you can do now — claims, not scores. */}
      <section className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5">
        <p className={`${TEXT.meta} text-premium-ivory/50`}>WHAT YOU CAN DO NOW</p>
        <p className={`${TEXT.body} mt-2 text-premium-ivory/90`}>{childProgressLine(progress)}</p>
        {claims.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {claims.map((c) => (
              <li key={c} className={`${TEXT.body} flex gap-2`}>
                <span aria-hidden="true" className="text-premium-gold">
                  ✓
                </span>
                <span>You can {c}.</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Superpowers. */}
      {superpowers.length > 0 ? (
        <section>
          <p className={`${TEXT.meta} mb-2 text-premium-ivory/50`}>PIECE SUPERPOWERS</p>
          <div className="grid grid-cols-2 gap-2">
            {superpowers.map((s, i) =>
              s ? (
                <div
                  key={s.id}
                  className={`rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-all duration-500 ${
                    powersRevealed ? "opacity-100 scale-100" : "opacity-0 scale-90"
                  }`}
                  style={{ transitionDelay: `${Math.min(i, 5) * 90}ms` }}
                >
                  <p className="text-2xl leading-none" aria-hidden="true">
                    {s.emoji}
                  </p>
                  <p className={`${TEXT.subheading} mt-2 text-base uppercase tracking-wide`}>{s.name}</p>
                  <p className={`${TEXT.caption} mt-1`}>{s.power}</p>
                </div>
              ) : null
            )}
          </div>
        </section>
      ) : null}

      {/* For the grown-up. */}
      <Link
        href="/chess-school/parent"
        className="flex items-center justify-between rounded-premiumCard border border-white/10 bg-white/[0.04] p-4 hover:border-premium-gold/30"
      >
        <div>
          <p className={`${TEXT.subheading} text-base`}>For parents</p>
          <p className={`${TEXT.caption} mt-0.5`}>What they&rsquo;ve learned, and what to try together tonight.</p>
        </div>
        <span aria-hidden="true" className="text-premium-gold">
          →
        </span>
      </Link>

      {/* The map. Acts and modules, every session, honest locks. */}
      <section>
        <p className={`${TEXT.meta} mb-3 text-premium-ivory/50`}>THE WHOLE COURSE</p>
        <div className="space-y-5">
          {SCHOOL_MODULES.map((m) => (
            <div key={m.id}>
              <p className={`${TEXT.caption}`}>{SCHOOL_ACTS[m.act]}</p>
              <p className={`${TEXT.subheading} mt-0.5`}>
                {m.number}. {m.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {m.sessionNumbers.map((n) => {
                  const s = SCHOOL_SESSIONS.find((x) => x.number === n);
                  if (!s) return null;
                  const complete = progress.completedSessions.includes(n);
                  const unlocked = isSessionUnlocked(progress, n) && canOpenSession(access, n);
                  const inner = (
                    <div
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                        complete
                          ? "border-premium-gold/25 bg-premium-gold/[0.05]"
                          : unlocked
                          ? "border-white/15 bg-white/[0.05]"
                          : "border-white/[0.06] bg-transparent opacity-60"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full font-classic-body text-xs ${
                          complete
                            ? "bg-premium-gold text-premium-midnight"
                            : "bg-white/10 text-premium-ivory/70"
                        }`}
                      >
                        {complete ? "✓" : n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`${TEXT.body} truncate text-premium-ivory/90`}>
                          {s.starred ? "★ " : ""}
                          {s.title}
                        </p>
                        <p className={`${TEXT.caption} truncate`}>{s.subtitle}</p>
                      </div>
                      {!unlocked && !complete ? (
                        <span aria-hidden="true" className="text-premium-ivory/40">
                          🔒
                        </span>
                      ) : null}
                    </div>
                  );
                  return (
                    <li key={s.id}>
                      {unlocked || complete ? <Link href={sessionHref(s.id)}>{inner}</Link> : inner}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Graduation as a destination. */}
      <section
        className={`rounded-premiumCard border p-5 text-center ${
          graduated
            ? "border-premium-gold/45 bg-premium-gold/10"
            : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <p className="text-3xl" aria-hidden="true">
          🎓
        </p>
        <p className={`${TEXT.subheading} mt-2`}>Graduation Day</p>
        <p className={`${TEXT.body} mt-1`}>
          {graduated
            ? "You did it. Your certificate is ready."
            : `Session ${TOTAL_SESSIONS}: a real duel, no hints, and a certificate with your name on it.`}
        </p>
        {!graduated ? (
          <p className={`${TEXT.caption} mt-2`}>
            {TOTAL_SESSIONS - done} session{TOTAL_SESSIONS - done === 1 ? "" : "s"} to go
          </p>
        ) : (
          <Link href={GRADUATE_HREF} className="mt-3 block">
            <Button tone="premium" block>
              Open certificate
            </Button>
          </Link>
        )}
      </section>

    </main>
  );
}
