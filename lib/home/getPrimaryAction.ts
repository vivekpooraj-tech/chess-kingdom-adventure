import { nextSession, hasGraduated, completedCount } from "@/lib/school/v2/progress";
import { TOTAL_SESSIONS } from "@/content/school/sessions";
import type { SchoolProgress } from "@/content/school/types";
import { effectiveExperienceLevel, type ExperienceLevel } from "@/lib/learner/experienceLevel";

/**
 * Home's single primary action (Phase 3).
 *
 * Chess School V2 is the flagship curriculum now, so it leads for any child
 * who has not finished it — replacing the old two-card
 * ChessSchoolCard + HeroJourneyCard combination Home used to show. Once a
 * child graduates, this falls back to the same adaptive signals Home used
 * before Chess School V2 existed (a real recurring weakness, then a
 * per-level default) — MINUS the old "lesson" branch, which pointed at
 * Kingdom Journey's day-numbered content/lessons.ts. That branch is
 * deliberately gone: Kingdom Journey is being repositioned into Chess Mind
 * World, and a graduated learner should never be routed back into the old
 * day-numbered journey as if it were still the main course.
 */
export type PrimaryAction =
  | {
      kind: "school";
      sessionNumber: number;
      title: string;
      subtitle: string;
      href: string;
      startedCount: number;
      totalSessions: number;
      isFirstSession: boolean;
    }
  | { kind: "focus"; skillName: string; weakCount: number; href: string }
  | { kind: "practice" }
  | { kind: "puzzles"; title: string; subtitle: string }
  | { kind: "academy"; title: string; subtitle: string; href: string }
  | { kind: "play"; title: string; subtitle: string };

export function getPrimaryAction(params: {
  schoolProgress: SchoolProgress;
  experienceLevel: ExperienceLevel | null;
  focus?: { skillName: string; weakCount: number; href: string } | null;
}): PrimaryAction {
  const { schoolProgress, experienceLevel, focus } = params;

  if (!hasGraduated(schoolProgress)) {
    const session = nextSession(schoolProgress);
    if (session) {
      return {
        kind: "school",
        sessionNumber: session.number,
        title: session.title,
        subtitle: session.subtitle,
        href: `/chess-school/session/${session.id}`,
        startedCount: completedCount(schoolProgress),
        totalSessions: TOTAL_SESSIONS,
        isFirstSession: completedCount(schoolProgress) === 0,
      };
    }
  }

  const level = effectiveExperienceLevel(experienceLevel);

  if (focus) {
    return { kind: "focus", skillName: focus.skillName, weakCount: focus.weakCount, href: focus.href };
  }

  if (level === "knows_basics") {
    return {
      kind: "academy",
      title: "Tactics Training",
      subtitle: "Forks, pins, and patterns — build real chess skill.",
      href: "/academy/tactics",
    };
  }

  if (level === "plays_regularly") {
    return {
      kind: "play",
      title: "Ready for a game?",
      subtitle: "Play the computer, worldwide, or a friend.",
    };
  }

  return {
    kind: "puzzles",
    title: "Puzzle Trainer",
    subtitle: "You've graduated Chess School — time to sharpen your tactics!",
  };
}
