import { LESSONS } from "@/content/lessons";
import { isDayFree } from "@/content/kingdomZones";
import {
  effectiveExperienceLevel,
  type ExperienceLevel,
} from "@/lib/learner/experienceLevel";

export type HomeLeadRecommendation =
  | {
      kind: "lesson";
      dayNumber: number;
      title: string;
      storyBeat: string;
      zoneEmoji: string;
      locked: boolean;
    }
  | { kind: "practice" }
  | {
      kind: "puzzles";
      title: string;
      subtitle: string;
    }
  | {
      kind: "academy";
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: "play";
      title: string;
      subtitle: string;
    }
  | {
      /** A skill this child keeps losing games to, with somewhere to work on
       *  it. Only ever produced from a real recurring signal — see `focus`. */
      kind: "focus";
      skillName: string;
      weakCount: number;
      href: string;
    };

type Params = {
  experienceLevel: ExperienceLevel | null;
  currentDay: number;
  isPremium: boolean;
  zoneEmoji: string;
  /**
   * The child's recurring weakness and where to work on it, when one exists.
   * Caller-supplied (from deriveLearnerProfile + the review flow's existing
   * skill-to-lesson mapping) so this stays a pure function with no I/O and no
   * second copy of the "what counts as a weakness" rule.
   */
  focus?: { skillName: string; weakCount: number; href: string } | null;
};

/**
 * Single adaptive home lead card.
 *
 * Order of preference:
 *  1. A skill the child keeps losing games to — the most useful thing they
 *     could do today, and the only branch grounded in their actual play.
 *  2. Kingdom Journey for brand-new learners, whose story order IS the
 *     curriculum; hijacking Day 5 for tactics practice would break the thread
 *     that makes the journey work for young children. So `new` learners keep
 *     the lesson lead until the journey runs out.
 *  3. The per-level defaults.
 *
 * Before this took `focus`, an experienced child saw the same "Puzzle Trainer"
 * lead every day forever: the card was adaptive to who they were on signup,
 * but not to anything they had done since.
 */
export function getHomeLeadRecommendation({
  experienceLevel,
  currentDay,
  isPremium,
  zoneEmoji,
  focus,
}: Params): HomeLeadRecommendation {
  const level = effectiveExperienceLevel(experienceLevel);

  if (focus && level !== "new") {
    return { kind: "focus", skillName: focus.skillName, weakCount: focus.weakCount, href: focus.href };
  }

  if (level === "plays_regularly") {
    return {
      kind: "puzzles",
      title: "Puzzle Trainer",
      subtitle: "Sharpen your tactics with a fresh puzzle from the library.",
    };
  }

  if (level === "knows_basics") {
    return {
      kind: "academy",
      title: "Tactics Training",
      subtitle: "Forks, pins, and patterns — build real chess skill.",
      href: "/academy/tactics",
    };
  }

  const nextLesson = LESSONS.find((l) => l.dayNumber === currentDay);
  if (nextLesson) {
    return {
      kind: "lesson",
      dayNumber: nextLesson.dayNumber,
      title: nextLesson.title,
      storyBeat: nextLesson.storyBeat,
      zoneEmoji,
      locked: !isDayFree(nextLesson.dayNumber) && !isPremium,
    };
  }

  // A new learner who has finished the journey: a real weakness is a better
  // lead than the generic "you've completed every lesson" card.
  if (focus) {
    return { kind: "focus", skillName: focus.skillName, weakCount: focus.weakCount, href: focus.href };
  }

  return { kind: "practice" };
}
