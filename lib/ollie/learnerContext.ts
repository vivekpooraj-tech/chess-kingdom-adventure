/**
 * Learner awareness for the Ollie coach.
 *
 * Ollie's differentiator is "Ollie sees what you miss" — but until now he only
 * ever saw the single game in front of him. This module turns the signals the
 * app ALREADY records (child_skill_signals via bump_skill_signal, and
 * child_game_reviews) into a small, honest picture of the learner across
 * sessions, so Ollie can say "this keeps coming up" or "you're getting faster
 * at this" instead of reacting to one game in isolation.
 *
 * Same anti-fabrication contract as boardContext.ts / reviewContext.ts:
 * every statement here must be backed by a real counter. Nothing is inferred,
 * softened, or invented, and when the data is too thin to support a claim the
 * field is simply omitted — an absent field is always better than a guess,
 * because a child told "you keep missing forks" when they never have will stop
 * trusting the coach.
 *
 * Pure — no I/O, no Supabase types, no React. The caller fetches; this decides
 * what may honestly be said.
 */

import { RECURRING_SKILL_THRESHOLD } from "@/lib/analysis/gameReviewSignals";
import { getSkill, isSpecificSkill, type SkillId } from "@/lib/analysis/skills";
import type { SkillSignal } from "@/lib/supabase/queries";

/**
 * Practice attempts needed before a hit-rate means anything. Below this a
 * single lucky or unlucky answer swings the number wildly, so we say nothing.
 */
export const MIN_PRACTICE_ATTEMPTS = 4;

/** Reviews needed before we'll claim a direction of travel (2 per half). */
export const MIN_REVIEWS_FOR_TREND = 4;

/** A hit-rate at or above this on a skill the child once kept missing is
 * genuine, celebratable progress rather than noise. */
const PRACTICE_STRONG_RATE = 0.7;

export interface LearnerReviewRow {
  accuracy: number | null;
  reviewedAt: string;
}

export interface OllieLearnerProfile {
  /** The skill the child most often gets flagged on — only when it has
   * recurred enough times to be a real pattern. */
  focusSkill?: SkillId;
  focusSkillName?: string;
  focusSkillWeakCount?: number;
  /** How they're doing when they practise that skill, once there are enough
   * attempts to be meaningful. */
  focusPracticeAttempts?: number;
  focusPracticeCorrect?: number;
  /** True only when the child has practised the focus skill enough AND is
   * getting most of them right — i.e. real, earned improvement. */
  improvingOnFocusSkill?: boolean;
  /** Direction of accuracy across recent reviews, older half vs newer half. */
  accuracyTrend?: "improving" | "steady" | "declining";
  reviewCount?: number;
}

/**
 * Pick the skill worth focusing on: most-flagged first, and only if it has
 * crossed the recurring threshold. `advantage_loss` is the deliberate neutral
 * bucket used when the analysis could not confidently name a theme, so it is
 * never presented to a child as something to "work on" — telling a learner to
 * practise "advantage loss" is not actionable coaching.
 */
function pickFocusSkill(signals: Record<string, SkillSignal>): SkillSignal | undefined {
  let best: SkillSignal | undefined;
  for (const signal of Object.values(signals)) {
    if (signal.weakCount < RECURRING_SKILL_THRESHOLD) continue;
    if (!isSpecificSkill(signal.skill as SkillId)) continue;
    if (!best || signal.weakCount > best.weakCount) best = signal;
  }
  return best;
}

/**
 * Compare the older half of the child's reviews against the newer half. Needs
 * MIN_REVIEWS_FOR_TREND scored reviews; anything less is a mood, not a trend.
 * A 5-point band counts as "steady" so ordinary game-to-game noise doesn't get
 * announced as improvement or decline.
 */
function accuracyTrend(reviews: LearnerReviewRow[]): OllieLearnerProfile["accuracyTrend"] {
  const scored = reviews
    .filter((r) => typeof r.accuracy === "number")
    .slice(0, 10) as Array<{ accuracy: number; reviewedAt: string }>;
  if (scored.length < MIN_REVIEWS_FOR_TREND) return undefined;

  // Callers pass newest-first; split into newer and older halves.
  const half = Math.floor(scored.length / 2);
  const newer = scored.slice(0, half);
  const older = scored.slice(half);
  const mean = (xs: Array<{ accuracy: number }>) => xs.reduce((s, x) => s + x.accuracy, 0) / xs.length;
  const delta = mean(newer) - mean(older);

  if (delta >= 5) return "improving";
  if (delta <= -5) return "declining";
  return "steady";
}

/**
 * Build the honest cross-session picture. Both inputs are best-effort: an
 * empty object / empty array (the shape these queries return on failure or
 * before the migration lands) yields an empty profile, and an empty profile
 * adds nothing to the prompt.
 */
export function deriveLearnerProfile(
  signals: Record<string, SkillSignal>,
  reviews: LearnerReviewRow[]
): OllieLearnerProfile {
  const profile: OllieLearnerProfile = {};

  const focus = pickFocusSkill(signals);
  if (focus) {
    profile.focusSkill = focus.skill as SkillId;
    profile.focusSkillName = getSkill(focus.skill).name;
    profile.focusSkillWeakCount = focus.weakCount;

    if (focus.practiceAttempts >= MIN_PRACTICE_ATTEMPTS) {
      profile.focusPracticeAttempts = focus.practiceAttempts;
      profile.focusPracticeCorrect = focus.practiceCorrect;
      profile.improvingOnFocusSkill = focus.practiceCorrect / focus.practiceAttempts >= PRACTICE_STRONG_RATE;
    }
  }

  if (reviews.length > 0) profile.reviewCount = reviews.length;
  const trend = accuracyTrend(reviews);
  if (trend) profile.accuracyTrend = trend;

  return profile;
}

/** True when there is nothing real to tell Ollie. */
export function isEmptyLearnerProfile(profile: OllieLearnerProfile): boolean {
  return profile.focusSkill === undefined && profile.accuracyTrend === undefined;
}

/**
 * The system-prompt block. Deliberately framed as "things you have observed",
 * with an explicit instruction not to lead with them — a coach who opens every
 * reply with "you keep missing forks" is nagging, not teaching. Ollie should
 * answer the child's actual question first and reach for this only when it
 * genuinely helps.
 */
export function buildLearnerContextLine(profile: OllieLearnerProfile): string {
  if (isEmptyLearnerProfile(profile)) return "";

  const facts: string[] = [];

  if (profile.focusSkillName && profile.focusSkillWeakCount) {
    facts.push(
      `Across their recent games, the skill flagged most often is ${profile.focusSkillName} ` +
        `(${profile.focusSkillWeakCount} times).`
    );
  }

  if (
    profile.focusSkillName &&
    profile.focusPracticeAttempts !== undefined &&
    profile.focusPracticeCorrect !== undefined
  ) {
    facts.push(
      `They have practised ${profile.focusSkillName} ${profile.focusPracticeAttempts} times and got ` +
        `${profile.focusPracticeCorrect} right.`
    );
    if (profile.improvingOnFocusSkill) {
      facts.push(
        `That is real progress on something they used to miss — worth acknowledging warmly if it comes up, ` +
          `without making a fuss of it.`
      );
    }
  }

  if (profile.accuracyTrend === "improving") {
    facts.push("Their accuracy has been trending up across recent reviewed games.");
  } else if (profile.accuracyTrend === "declining") {
    facts.push(
      "Their accuracy has dipped a little across recent reviewed games. Do NOT tell the child their " +
        "results are getting worse — use this only to pitch encouragement and keep things achievable."
    );
  }

  if (!facts.length) return "";

  return (
    `\n\nWHAT YOU HAVE NOTICED ABOUT THIS LEARNER — these come from counters the app actually recorded, ` +
    `so treat them as true, but do NOT invent anything beyond them and never quote raw numbers back at a ` +
    `child as a score. Do NOT open your reply with these; answer what the child asked first. Bring them in ` +
    `only when they genuinely help — to connect today's question to something recurring, or to recognise ` +
    `improvement. Celebrate progress on a skill they used to miss more readily than you celebrate winning.\n` +
    facts.join(" ")
  );
}
