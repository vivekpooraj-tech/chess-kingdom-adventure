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
    };

type Params = {
  experienceLevel: ExperienceLevel | null;
  currentDay: number;
  isPremium: boolean;
  zoneEmoji: string;
};

/**
 * Single adaptive home lead card — Kingdom Journey for new learners,
 * Academy/puzzles/play emphasis for more experienced players.
 */
export function getHomeLeadRecommendation({
  experienceLevel,
  currentDay,
  isPremium,
  zoneEmoji,
}: Params): HomeLeadRecommendation {
  const level = effectiveExperienceLevel(experienceLevel);

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

  return { kind: "practice" };
}
