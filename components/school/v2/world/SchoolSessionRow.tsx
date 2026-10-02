"use client";

import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import type { SchoolProgress, SchoolSession } from "@/content/school/types";
import type { WorldId } from "@/lib/world/worlds";
import { canOpenSession, type SchoolAccess } from "@/lib/school/v2/access";
import { isSessionUnlocked } from "@/lib/school/v2/progress";
import { sessionHref } from "../SessionRunner";

export function SchoolSessionRow({
  session,
  progress,
  access,
  world,
  current,
}: {
  session: SchoolSession;
  progress: SchoolProgress;
  access: SchoolAccess;
  world: WorldId;
  current?: boolean;
}) {
  const complete = progress.completedSessions.includes(session.number);
  const unlocked = isSessionUnlocked(progress, session.number) && canOpenSession(access, session.number);
  const inner = (
    <div
      className={`world-school-row sch-row flex min-h-[48px] items-center gap-3 px-3 py-2.5 ${
        complete
          ? "sch-row--done"
          : current
            ? "sch-row--here"
            : unlocked
              ? "sch-row--open"
              : "sch-row--locked"
      }`}
    >
      <span className="sch-row__mark" aria-hidden="true">
        {complete ? "✓" : session.number}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`${TEXT.body} truncate`}>
          {session.starred ? "★ " : ""}
          {session.title}
        </p>
        <p className={`${TEXT.caption} truncate`}>{session.subtitle}</p>
      </div>
      {!unlocked && !complete ? (
        <span aria-hidden="true" className="text-premium-ivory/40">
          🔒
        </span>
      ) : null}
    </div>
  );
  return unlocked || complete ? <Link href={sessionHref(session.id, world)}>{inner}</Link> : inner;
}
