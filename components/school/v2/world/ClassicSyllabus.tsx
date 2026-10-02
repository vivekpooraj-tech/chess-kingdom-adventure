"use client";

import { TEXT } from "@/lib/designSystem";
import { ChessBoard } from "@/components/board/ChessBoard";
import type { SchoolModule, SchoolProgress, SchoolSession } from "@/content/school/types";
import { SCHOOL_MODULES, SCHOOL_ACTS } from "@/content/school/modules";
import { SCHOOL_SESSIONS, TOTAL_SESSIONS } from "@/content/school/sessions";
import type { SchoolAccess } from "@/lib/school/v2/access";
import { isSessionComplete } from "@/lib/school/v2/progress";
import {
  firstLessonFen,
  firstTeachLines,
  schoolArenaKicker,
  schoolArenaTitle,
  schoolProgressLine,
} from "@/lib/school/schoolArena";
import { childProgressLine } from "@/lib/school/v2/parentSummary";
import { OllieCoach, SchoolChip } from "../Coach";
import { SchoolPrimaryAction } from "./SchoolPrimaryAction";
import { SchoolSessionRow } from "./SchoolSessionRow";
import { SchoolHomeFooter } from "./EnchantedJourney";

/**
 * Classic Pro classroom — Classical Chess Academy.
 *
 * Current lesson and the curriculum sit side by side on tablet, stacked on
 * phone. Every title, count and diagram is the session's own data; the board
 * appears only when the session's first teaching step carries a real FEN.
 */
export function ClassicSyllabus({
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
  const world = "classic" as const;
  const live = next && !graduated ? next : null;
  const fen = live ? firstLessonFen(live) : undefined;
  const notes = live ? firstTeachLines(live) : undefined;

  return (
    <div className="sch-study">
      <header className="sch-mast sch-mast--sheet">
        <p className="world-kicker">{schoolArenaKicker(world)}</p>
        <h1 className={`world-title ${TEXT.display} mt-1`}>{schoolArenaTitle(world)}</h1>
        <div className="sch-ledger">
          <span className="sch-ledger__count tabular-nums">{schoolProgressLine(done, TOTAL_SESSIONS)}</span>
          <span className="sch-ledger__track" aria-hidden="true">
            <span style={{ width: `${(done / TOTAL_SESSIONS) * 100}%` }} />
          </span>
        </div>
      </header>

      <div className="sch-cols">
        <div className="sch-col">
          {live ? (
            <section className="world-primary-card sch-sheet" aria-labelledby="sch-current-title">
              <div className="sch-sheet__head">
                <p className="sch-sheet__kicker">Current lesson</p>
                <p className="sch-sheet__count tabular-nums">
                  Session {live.number} of {TOTAL_SESSIONS}
                </p>
              </div>
              {module ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SchoolChip>{SCHOOL_ACTS[module.act]}</SchoolChip>
                  <SchoolChip tone="gold">
                    Module {module.number} · {module.title}
                  </SchoolChip>
                </div>
              ) : null}
              <h2 id="sch-current-title" className="sch-sheet__title">
                {live.title}
              </h2>
              <p className={`${TEXT.body} mt-1`}>{live.subtitle}</p>
              {fen ? (
                <div className="sch-diagram">
                  <ChessBoard fen={fen} readOnly focusMode size={320} />
                </div>
              ) : null}
              {notes && notes.length > 0 ? (
                <ul className="sch-notes">
                  {notes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              <p className={`${TEXT.caption} mt-3`}>About {live.estimatedMinutes} minutes</p>
            </section>
          ) : null}

          <SchoolPrimaryAction world={world} next={next} graduated={graduated} done={done} access={access} />
          <OllieCoach line={welcome} tone={graduated ? "proud" : "calm"} />

          <section className="world-school-card sch-support">
            <p className="sch-sheet__kicker">Progress</p>
            <p className={`${TEXT.body} mt-2`}>{childProgressLine(progress)}</p>
            {claims.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {claims.map((c) => (
                  <li key={c} className={`${TEXT.body}`}>
                    You can {c}.
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <section className="sch-syllabus sch-col" aria-labelledby="sch-syllabus-title">
          <h2 id="sch-syllabus-title" className="sch-sheet__kicker">
            Grandmaster curriculum
          </h2>
          <ol className="sch-syllabus__list">
            {SCHOOL_MODULES.map((m) => {
              const sessions = m.sessionNumbers
                .map((n) => SCHOOL_SESSIONS.find((x) => x.number === n))
                .filter((s): s is SchoolSession => Boolean(s));
              const finished = sessions.filter((s) => isSessionComplete(progress, s.number)).length;
              const isCurrent = !graduated && module?.id === m.id;
              const state =
                finished === sessions.length && sessions.length > 0 ? "done" : isCurrent ? "here" : "ahead";
              return (
                <li key={m.id} className="sch-module" data-state={state}>
                  <details open={isCurrent}>
                    <summary className="sch-module__head">
                      <span className="min-w-0">
                        <span className="sch-module__act">{SCHOOL_ACTS[m.act]}</span>
                        <span className="sch-module__title">
                          {m.number}. {m.title}
                        </span>
                      </span>
                      <span className="sch-module__count tabular-nums">
                        {finished}/{sessions.length}
                      </span>
                    </summary>
                    <ul className="sch-module__rows">
                      {sessions.map((s) => (
                        <li key={s.id}>
                          <SchoolSessionRow
                            session={s}
                            progress={progress}
                            access={access}
                            world={world}
                            current={next?.id === s.id && !graduated}
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <SchoolHomeFooter graduated={graduated} done={done} />
    </div>
  );
}
