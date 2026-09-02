import type { SupabaseClient } from "@supabase/supabase-js";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { LESSONS } from "@/content/lessons";
import {
  effectiveExperienceLevel,
  type ExperienceLevel,
} from "@/lib/learner/experienceLevel";

export type WeeklyActivitySnapshot = {
  lessonsCompleted: number;
  puzzlesSolved: number;
  gamesPlayed: number;
  learningMinutes: number;
};

export type ParentNextStep = {
  title: string;
  description: string;
  href: string;
  durationLabel: string;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getWeeklyActivitySnapshot(
  supabase: SupabaseClient,
  childId: string
): Promise<WeeklyActivitySnapshot> {
  const since = daysAgoIso(7);

  const [lessonsRes, libraryPuzzlesRes, lessonPuzzlesRes, gamesRes, minutes] = await Promise.all([
    supabase
      .from("child_lesson_progress")
      .select("day_number", { count: "exact", head: true })
      .eq("child_id", childId)
      .eq("status", "completed")
      .gte("completed_at", since),
    // Puzzle Trainer + Daily Challenge solves, deduped: puzzle_library_solves
    // has one row per (child, puzzle) regardless of which surface solved it
    // (Phase 14C), so a puzzle solved through both is counted once. This
    // supersedes the old daily_challenge_history-only count, which missed
    // every Puzzle Trainer solve.
    supabase
      .from("puzzle_library_solves")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .gte("solved_at", since),
    // Academy lesson-day puzzles — a separate id space (day_number), counted
    // as before.
    supabase
      .from("puzzle_attempts")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .eq("is_correct", true)
      .gte("created_at", since),
    supabase
      .from("free_game_usage")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .gte("started_at", since),
    supabase
      .from("screen_time_usage")
      .select("minutes_used")
      .eq("child_id", childId)
      .gte("usage_date", since.slice(0, 10)),
  ]);

  const learningMinutes = (minutes.data ?? []).reduce((sum, row) => sum + (row.minutes_used ?? 0), 0);

  return {
    lessonsCompleted: lessonsRes.count ?? 0,
    puzzlesSolved: (libraryPuzzlesRes.count ?? 0) + (lessonPuzzlesRes.count ?? 0),
    gamesPlayed: gamesRes.count ?? 0,
    learningMinutes,
  };
}

export function getParentNextStep(input: {
  experienceLevel: ExperienceLevel | null;
  currentDay: number;
  completedDaysCount: number;
  chessMindStats: Record<string, number>;
  puzzleFirstTryRate: number | null;
}): ParentNextStep {
  const level = effectiveExperienceLevel(input.experienceLevel);

  if (level === "plays_regularly") {
    return {
      title: "Puzzle practice",
      description: "Solve 5 puzzles to sharpen calculation and pattern recognition.",
      href: "/puzzles",
      durationLabel: "10-minute activity",
    };
  }

  if (level === "knows_basics") {
    return {
      title: "Tactics lesson",
      description: "Work through the next Academy tactics lesson on forks and pins.",
      href: "/academy/tactics",
      durationLabel: "10-minute activity",
    };
  }

  const nextLesson = LESSONS.find((l) => l.dayNumber === input.currentDay);
  if (nextLesson && input.completedDaysCount < LESSONS.length) {
    return {
      title: `Kingdom Day ${nextLesson.dayNumber}`,
      description: nextLesson.storyBeat,
      href: `/lesson/${nextLesson.dayNumber}`,
      durationLabel: "15-minute activity",
    };
  }

  const weakestModule = CHESS_MIND_CATEGORIES.filter((c) => c.href).sort(
    (a, b) => (input.chessMindStats[a.id] ?? 0) - (input.chessMindStats[b.id] ?? 0)
  )[0];

  if (weakestModule?.href) {
    return {
      title: weakestModule.title,
      description: `Practice ${weakestModule.title.toLowerCase()} — a developing skill area.`,
      href: weakestModule.href,
      durationLabel: "10-minute activity",
    };
  }

  if (input.puzzleFirstTryRate !== null && input.puzzleFirstTryRate < 0.5) {
    return {
      title: "Puzzle Trainer",
      description: "Extra puzzle practice will help with first-try accuracy.",
      href: "/puzzles",
      durationLabel: "10-minute activity",
    };
  }

  return {
    title: "Daily Challenge",
    description: "One focused puzzle to build consistency.",
    href: "/puzzles",
    durationLabel: "5-minute activity",
  };
}

export type SkillSnapshot = {
  strong: string[];
  developing: string[];
  needsPractice: string[];
};

export function getSkillSnapshot(input: {
  chessMindStats: Record<string, number>;
  openingsStudied: number;
  puzzleFirstTryRate: number | null;
  lessonsCompleted: number;
}): SkillSnapshot {
  const modules = CHESS_MIND_CATEGORIES.filter((c) => c.href);
  const sorted = [...modules].sort(
    (a, b) => (input.chessMindStats[b.id] ?? 0) - (input.chessMindStats[a.id] ?? 0)
  );

  const strong: string[] = [];
  const developing: string[] = [];
  const needsPractice: string[] = [];

  for (const mod of sorted) {
    const count = input.chessMindStats[mod.id] ?? 0;
    if (count >= 15) strong.push(mod.title);
    else if (count >= 5) developing.push(mod.title);
    else needsPractice.push(mod.title);
  }

  if (input.openingsStudied >= 3 && !strong.includes("Openings")) {
    strong.push("Openings");
  } else if (input.openingsStudied >= 1) {
    developing.push("Openings");
  } else {
    needsPractice.push("Openings");
  }

  if (input.lessonsCompleted >= 10) {
    developing.push("Kingdom Journey");
  } else {
    needsPractice.push("Kingdom Journey");
  }

  if (input.puzzleFirstTryRate !== null) {
    if (input.puzzleFirstTryRate >= 0.7) strong.push("Puzzle accuracy");
    else if (input.puzzleFirstTryRate >= 0.4) developing.push("Puzzle accuracy");
    else needsPractice.push("Puzzle accuracy");
  }

  return {
    strong: strong.slice(0, 3),
    developing: developing.slice(0, 3),
    needsPractice: needsPractice.slice(0, 3),
  };
}
