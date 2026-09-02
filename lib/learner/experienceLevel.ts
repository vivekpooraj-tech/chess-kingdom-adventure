export type ExperienceLevel = "new" | "knows_basics" | "plays_regularly";
export type AgeBand = "young" | "tween" | "teen" | "adult";

export const EXPERIENCE_LEVEL_OPTIONS: {
  value: ExperienceLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "new",
    label: "I'm new to chess",
    description: "Start with guided Kingdom lessons and the basics.",
  },
  {
    value: "knows_basics",
    label: "I know the basics",
    description: "Jump into tactics, puzzles, and Academy training.",
  },
  {
    value: "plays_regularly",
    label: "I already play regularly",
    description: "Focus on puzzles, play, and improvement.",
  },
];

export const AGE_BAND_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: "young", label: "5–9 years" },
  { value: "tween", label: "10–13 years" },
  { value: "teen", label: "14–17 years" },
  { value: "adult", label: "18+ years" },
];

/** Legacy rows with NULL experience_level behave as new learners. */
export function effectiveExperienceLevel(
  level: ExperienceLevel | null | undefined
): ExperienceLevel {
  return level ?? "new";
}

export function shouldSkipWelcome(level: ExperienceLevel | null | undefined): boolean {
  const effective = effectiveExperienceLevel(level);
  return effective === "knows_basics" || effective === "plays_regularly";
}

export function prefersNeutralHomeTone(
  level: ExperienceLevel | null | undefined,
  ageBand: AgeBand | null | undefined
): boolean {
  return ageBand === "adult" || effectiveExperienceLevel(level) === "plays_regularly";
}
