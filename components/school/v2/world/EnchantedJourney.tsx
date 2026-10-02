"use client";

import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import type { SchoolModule, SchoolProgress, SchoolSession } from "@/content/school/types";
import { SCHOOL_SESSIONS, TOTAL_SESSIONS } from "@/content/school/sessions";
import { SCHOOL_ACTS } from "@/content/school/modules";
import type { PieceSuperpower } from "@/content/school/types";
import type { SchoolAccess } from "@/lib/school/v2/access";
import { schoolArenaKicker, schoolArenaTitle, schoolProgressLine } from "@/lib/school/schoolArena";
import { isSessionUnlocked } from "@/lib/school/v2/progress";
import { canOpenSession } from "@/lib/school/v2/access";
import { childProgressLine } from "@/lib/school/v2/parentSummary";
import { GRADUATE_HREF, sessionHref } from "../SessionRunner";
import { OllieCoach, SchoolChip } from "../Coach";
import { SchoolCta } from "../SchoolCta";
import { SchoolPrimaryAction } from "./SchoolPrimaryAction";

export function EnchantedJourney({
  childName: _childName,
  done,
  graduated,
  next,
  module,
  bigMoment,
  superpowers,
  claims,
  progress,
  access,
  welcome,
}: {
  childName: string;
  done: number;
  graduated: boolean;
  next: SchoolSession | null;
  module: SchoolModule | null;
  bigMoment: SchoolSession | null;
  superpowers: (PieceSuperpower | null | undefined)[];
  claims: string[];
  progress: SchoolProgress;
  access: SchoolAccess;
  welcome: string;
}) {
  const world = "enchanted" as const;
  const stages = (module?.sessionNumbers ?? []).map((n) => SCHOOL_SESSIONS.find((s) => s.number === n)).filter(Boolean) as SchoolSession[];

  return (
    <div className="sch-journey">
      <header className="sch-mast">
        <p className="world-kicker">{schoolArenaKicker(world)}</p>
        <h1 className={`world-title ${TEXT.display} mt-1`}>{schoolArenaTitle(world)}</h1>
        {next && !graduated ? (
          <p className={`${TEXT.caption} mt-2`}>
            Session {next.number} · {next.title}
          </p>
        ) : null}
        <p className={`${TEXT.caption} mt-1 tabular-nums text-premium-ivory/55`}>
          {schoolProgressLine(done, TOTAL_SESSIONS)}
        </p>
      </header>

      <ol className="sch-trail" aria-label="Adventure progress">
        {SCHOOL_SESSIONS.map((s) => {
          const complete = progress.completedSessions.includes(s.number);
          const here = next?.number === s.number && !graduated;
          return (
            <li
              key={s.id}
              data-state={complete ? "done" : here ? "here" : "ahead"}
              title={s.title}
            >
              {complete ? "✓" : s.number}
            </li>
          );
        })}
      </ol>

      <ol className="sch-path" aria-label="Kingdom path">
        {stages.map((s) => {
          const complete = progress.completedSessions.includes(s.number);
          const here = next?.id === s.id && !graduated;
          const open = isSessionUnlocked(progress, s.number) && canOpenSession(access, s.number);
          const node = (
            <span className="sch-path__node">
              <span className="sch-path__mark">{complete ? "✓" : here ? "★" : s.number}</span>
              <span className="sch-path__copy">
                <strong>{s.title}</strong>
                <em>{s.subtitle}</em>
              </span>
              {!open && !complete ? <span aria-hidden="true">🔒</span> : null}
            </span>
          );
          return (
            <li key={s.id} data-state={complete ? "done" : here ? "here" : open ? "open" : "locked"}>
              {open || complete ? <Link href={sessionHref(s.id, world)}>{node}</Link> : node}
            </li>
          );
        })}
      </ol>

      {next && !graduated ? (
        <section className="world-primary-card sch-stage">
          {module ? (
            <div className="flex flex-wrap items-center gap-2">
              <SchoolChip>{SCHOOL_ACTS[module.act]}</SchoolChip>
              <SchoolChip tone="gold">
                Stage {module.number} · {module.title}
              </SchoolChip>
            </div>
          ) : null}
          <p className={`${TEXT.meta} mt-4 text-premium-ivory/50`}>CURRENT DESTINATION</p>
          <p className={`${TEXT.subheading} mt-1`}>{next.title}</p>
          <p className={`${TEXT.body} mt-1`}>{next.subtitle}</p>
          <p className={`${TEXT.caption} mt-3`}>About {next.estimatedMinutes} minutes</p>
        </section>
      ) : null}

      <OllieCoach line={welcome} tone={graduated ? "proud" : "calm"} />
      <SchoolPrimaryAction world={world} next={next} graduated={graduated} done={done} access={access} />

      {bigMoment && !graduated ? (
        <section className="world-enter world-milestone sch-reward">
          <p className={`${TEXT.meta} text-premium-gold`}>AHEAD ON THE PATH</p>
          <p className={`${TEXT.subheading} mt-1`}>★ {bigMoment.title}</p>
          <p className={`${TEXT.body} mt-1`}>{bigMoment.subtitle}</p>
        </section>
      ) : null}

      <section className="world-school-card sch-support">
        <p className={`${TEXT.meta} text-premium-ivory/50`}>WHAT YOU CAN DO NOW</p>
        <p className={`${TEXT.body} mt-2`}>{childProgressLine(progress)}</p>
        {claims.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {claims.map((c) => (
              <li key={c} className={`${TEXT.body} flex gap-2`}>
                <span aria-hidden="true" className="text-premium-gold">✓</span>
                <span>You can {c}.</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {superpowers.length > 0 ? (
        <section>
          <p className={`${TEXT.meta} mb-2 text-premium-ivory/50`}>REWARDS EARNED</p>
          <div className="grid grid-cols-2 gap-2">
            {superpowers.map((s) =>
              s ? (
                <div key={s.id} className="world-school-row sch-reward-tile p-3">
                  <p className="text-2xl leading-none" aria-hidden="true">{s.emoji}</p>
                  <p className={`${TEXT.subheading} mt-2 text-base uppercase tracking-wide`}>{s.name}</p>
                  <p className={`${TEXT.caption} mt-1`}>{s.power}</p>
                </div>
              ) : null
            )}
          </div>
        </section>
      ) : null}

      <SchoolHomeFooter graduated={graduated} done={done} />
    </div>
  );
}

export function SchoolHomeFooter({
  graduated,
  done,
}: {
  graduated: boolean;
  done: number;
}) {
  return (
    <>
      <Link
        href="/chess-school/parent"
        className="world-school-card flex min-h-[48px] items-center justify-between p-4"
      >
        <div>
          <p className={`${TEXT.subheading} text-base`}>For parents</p>
          <p className={`${TEXT.caption} mt-0.5`}>What they&rsquo;ve learned, and what to try together tonight.</p>
        </div>
        <span aria-hidden="true" className="text-premium-gold">→</span>
      </Link>
      <section
        className={`world-primary-card p-5 text-center ${
          graduated ? "border-premium-gold/45 bg-premium-gold/10" : ""
        }`}
      >
        <p className="text-3xl" aria-hidden="true">🎓</p>
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
            <SchoolCta block>Open certificate</SchoolCta>
          </Link>
        )}
      </section>
    </>
  );
}
