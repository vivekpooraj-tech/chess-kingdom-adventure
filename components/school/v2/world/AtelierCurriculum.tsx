"use client";

import { TEXT } from "@/lib/designSystem";
import type { SchoolModule, SchoolProgress, SchoolSession } from "@/content/school/types";
import { SCHOOL_MODULES, SCHOOL_ACTS } from "@/content/school/modules";
import { SCHOOL_SESSIONS, TOTAL_SESSIONS } from "@/content/school/sessions";
import type { SchoolAccess } from "@/lib/school/v2/access";
import { schoolArenaKicker, schoolArenaTitle, schoolProgressLine } from "@/lib/school/schoolArena";
import { childProgressLine } from "@/lib/school/v2/parentSummary";
import { OllieCoach, SchoolChip } from "../Coach";
import { SchoolPrimaryAction } from "./SchoolPrimaryAction";
import { SchoolSessionRow } from "./SchoolSessionRow";
import { SchoolHomeFooter } from "./EnchantedJourney";

export function AtelierCurriculum({
  childName: _childName,
  done,
  graduated,
  next,
  module,
  progress,
  access,
  welcome,
  claims,
}: {
  childName: string;
  done: number;
  graduated: boolean;
  next: SchoolSession | null;
  module: SchoolModule | null;
  progress: SchoolProgress;
  access: SchoolAccess;
  welcome: string;
  claims: string[];
}) {
  const world = "atelier" as const;

  return (
    <div className="sch-academy">
      <header className="sch-mast">
        <p className="world-kicker">{schoolArenaKicker(world)}</p>
        <h1 className={`world-title ${TEXT.display} mt-1`}>{schoolArenaTitle(world)}</h1>
        {next && !graduated ? (
          <p className={`${TEXT.caption} mt-2`}>
            Session {next.number} of {TOTAL_SESSIONS} · {next.title}
          </p>
        ) : null}
        <p className={`${TEXT.caption} mt-1 tabular-nums text-premium-ivory/55`}>
          {schoolProgressLine(done, TOTAL_SESSIONS)}
        </p>
      </header>

      {next && !graduated ? (
        <section className="world-primary-card sch-block">
          <p className={`${TEXT.meta}`}>CURRENT TRAINING BLOCK</p>
          {module ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SchoolChip>{SCHOOL_ACTS[module.act]}</SchoolChip>
              <SchoolChip tone="gold">
                Module {module.number} · {module.title}
              </SchoolChip>
            </div>
          ) : null}
          <p className={`${TEXT.subheading} mt-4`}>{next.title}</p>
          <p className={`${TEXT.body} mt-1`}>{next.subtitle}</p>
          <p className={`${TEXT.caption} mt-3`}>About {next.estimatedMinutes} minutes</p>
        </section>
      ) : null}

      <OllieCoach line={welcome} tone={graduated ? "proud" : "calm"} />
      <SchoolPrimaryAction world={world} next={next} graduated={graduated} done={done} access={access} />

      <section className="sch-curriculum">
        <p className={`${TEXT.meta} mb-3`}>CURRICULUM</p>
        <div className="space-y-5">
          {SCHOOL_MODULES.map((m) => (
            <div key={m.id} className={m.id === module?.id ? "sch-curriculum__now" : undefined}>
              <p className={`${TEXT.caption}`}>{SCHOOL_ACTS[m.act]}</p>
              <p className={`${TEXT.subheading} mt-0.5`}>
                {m.number}. {m.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {m.sessionNumbers.map((n) => {
                  const s = SCHOOL_SESSIONS.find((x) => x.number === n);
                  if (!s) return null;
                  return (
                    <li key={s.id}>
                      <SchoolSessionRow
                        session={s}
                        progress={progress}
                        access={access}
                        world={world}
                        current={next?.id === s.id && !graduated}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="world-school-card sch-support">
        <p className={`${TEXT.meta}`}>TRAINING NOTES</p>
        <p className={`${TEXT.body} mt-2`}>{childProgressLine(progress)}</p>
        {claims.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {claims.map((c) => (
              <li key={c} className={`${TEXT.body} flex gap-2`}>
                <span aria-hidden="true">·</span>
                <span>You can {c}.</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <SchoolHomeFooter graduated={graduated} done={done} />
    </div>
  );
}
