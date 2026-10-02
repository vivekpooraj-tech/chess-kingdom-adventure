"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SchoolProgress } from "@/content/school/types";
import { getSuperpower } from "@/content/school/modules";
import {
  completedCount,
  currentModule,
  hasGraduated,
  nextBigMoment,
  nextSession,
  unlockedSuperpowerIds,
} from "@/lib/school/v2/progress";
import { orderedSkillClaims } from "@/lib/school/v2/parentSummary";
import { type SchoolAccess } from "@/lib/school/v2/access";
import { loadSchoolProgress } from "@/lib/school/v2/queries";
import { mergeProgress } from "@/lib/school/v2/storage";
import { useWorld } from "@/lib/world/WorldContext";
import { AtelierCurriculum } from "./world/AtelierCurriculum";
import { ClassicSyllabus } from "./world/ClassicSyllabus";
import { EnchantedJourney } from "./world/EnchantedJourney";

/**
 * The classroom — Chess School's home.
 *
 * Presentation is world-specific (journey / academy / syllabus). Progress,
 * unlocks, Continue, and entitlement stay on the shared v2 engine.
 *
 * EVERY CLAIM IS EARNED. There is one number on the screen — sessions
 * finished of thirty — and it counts things that happened.
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
  const world = useWorld();
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

  const done = completedCount(progress);
  const graduated = hasGraduated(progress);
  const next = nextSession(progress);
  const module = currentModule(progress);
  const bigMoment = nextBigMoment(progress);
  const superpowers = unlockedSuperpowerIds(progress).map(getSuperpower).filter(Boolean);
  const claims = orderedSkillClaims(progress).slice(0, 3);

  const welcome = graduated
    ? "You finished. You're a chess player now — go and find someone to play."
    : done === 0
    ? `Welcome, ${childName}. Session 1 takes about ten minutes, and by the end of it you'll have made your first chess move.`
    : `Welcome back, ${childName}. Ready for your next move?`;

  const shared = {
    childName,
    done,
    graduated,
    next,
    module,
    progress,
    access,
    welcome,
    claims,
  };

  return (
    <main className="sch-home mx-auto flex w-full min-w-0 max-w-xl flex-col gap-6 overflow-x-hidden px-4 pb-20 pt-4">
      {world === "enchanted" ? (
        <EnchantedJourney {...shared} bigMoment={bigMoment} superpowers={superpowers} />
      ) : world === "atelier" ? (
        <AtelierCurriculum {...shared} />
      ) : (
        <ClassicSyllabus {...shared} />
      )}
    </main>
  );
}
