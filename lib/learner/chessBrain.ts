/**
 * "Your Chess Brain" — the learner-facing read of the signals the app records.
 *
 * It answers four questions a child actually asks: what am I good at, what
 * should I improve, what should I practise next, and am I getting better.
 *
 * Deliberately NOT a scorecard. There is no honest way to turn these counters
 * into "Tactical Vision: 62%" — the app records how often a skill caused a
 * flagged mistake and how practice on it went, which supports a direction
 * ("needs practice", "getting stronger") but not a magnitude. Inventing a
 * percentage would make the whole panel untrustworthy, and a child who
 * notices one made-up number stops believing the real ones too.
 *
 * So every row here is a qualitative status backed by a count the child could
 * verify, and a skill with too little history simply does not appear.
 *
 * Pure — no I/O. The caller fetches; this decides what may honestly be shown.
 */

import { RECURRING_SKILL_THRESHOLD } from "@/lib/analysis/gameReviewSignals";
import { getSkill, isSpecificSkill, type SkillId } from "@/lib/analysis/skills";
import type { SkillSignal } from "@/lib/supabase/queries";
import { MIN_PRACTICE_ATTEMPTS, type LearnerReviewRow, type OllieLearnerProfile } from "@/lib/ollie/learnerContext";

/** Hit-rate at or above this counts as a strength rather than noise. */
const STRONG_RATE = 0.7;
/** Below this, with enough attempts, the skill is still being worked out. */
const WORKING_RATE = 0.4;

export type BrainStatus = "needs_practice" | "working_on_it" | "getting_stronger" | "strong";

export interface BrainSkillRow {
  skill: SkillId;
  name: string;
  emoji: string;
  status: BrainStatus;
  /** Plain-language reason, always tied to a real count. */
  detail: string;
  /** Times this skill was the flagged cause of a mistake. */
  weakCount: number;
  practiceAttempts: number;
  practiceCorrect: number;
}

export interface ChessBrainView {
  /** Skills the child is demonstrably handling well. */
  strengths: BrainSkillRow[];
  /** Skills that keep costing them games. */
  areasToImprove: BrainSkillRow[];
  /** The single thing to work on next — the most-flagged unresolved skill. */
  focus: BrainSkillRow | null;
  /** Direction of accuracy across recent reviews, when there are enough. */
  trend?: OllieLearnerProfile["accuracyTrend"];
  reviewCount: number;
  /** True when there is genuinely nothing to show yet. */
  isEmpty: boolean;
}

const STATUS_LABEL: Record<BrainStatus, string> = {
  needs_practice: "Needs practice",
  working_on_it: "Working on it",
  getting_stronger: "Getting stronger",
  strong: "Strong",
};

export function brainStatusLabel(status: BrainStatus): string {
  return STATUS_LABEL[status];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Classify one skill from its counters.
 *
 * The order matters: practice evidence outranks the weakness count, because a
 * child who kept missing forks and has since gone 8-for-10 on fork puzzles is
 * improving, and still labelling that "needs practice" would be both wrong and
 * demoralising — the exact thing that makes a learner give up on a skill.
 */
function classify(signal: SkillSignal): BrainSkillRow | null {
  const skill = signal.skill as SkillId;
  if (!isSpecificSkill(skill)) return null;

  const info = getSkill(skill);
  const { weakCount, practiceAttempts, practiceCorrect } = signal;
  const hasPractice = practiceAttempts >= MIN_PRACTICE_ATTEMPTS;
  const rate = hasPractice ? practiceCorrect / practiceAttempts : null;

  let status: BrainStatus;
  let detail: string;

  if (rate !== null && rate >= STRONG_RATE) {
    status = weakCount >= RECURRING_SKILL_THRESHOLD ? "getting_stronger" : "strong";
    detail =
      status === "getting_stronger"
        ? `Used to cost you games — now ${practiceCorrect} of ${practiceAttempts} in practice.`
        : `${practiceCorrect} of ${practiceAttempts} right in practice.`;
  } else if (rate !== null && rate >= WORKING_RATE) {
    status = "working_on_it";
    detail = `${practiceCorrect} of ${practiceAttempts} right in practice so far.`;
  } else if (weakCount >= RECURRING_SKILL_THRESHOLD) {
    status = "needs_practice";
    detail = `Came up in ${plural(weakCount, "game", "games")} you reviewed.`;
  } else if (rate !== null) {
    status = "working_on_it";
    detail = `${practiceCorrect} of ${practiceAttempts} right in practice so far.`;
  } else {
    // Not enough of either kind of evidence — say nothing about this skill.
    return null;
  }

  return {
    skill,
    name: info.name,
    emoji: info.emoji,
    status,
    detail,
    weakCount,
    practiceAttempts,
    practiceCorrect,
  };
}

export function buildChessBrainView(
  signals: Record<string, SkillSignal>,
  reviews: LearnerReviewRow[],
  profile: OllieLearnerProfile
): ChessBrainView {
  const rows = Object.values(signals)
    .map(classify)
    .filter((r): r is BrainSkillRow => r !== null);

  const strengths = rows
    .filter((r) => r.status === "strong" || r.status === "getting_stronger")
    // Getting-stronger first: hard-won progress is the more motivating thing
    // to lead with, and it is the story this product is actually about.
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "getting_stronger" ? -1 : 1;
      return b.practiceCorrect - a.practiceCorrect;
    })
    .slice(0, 3);

  const areasToImprove = rows
    .filter((r) => r.status === "needs_practice" || r.status === "working_on_it")
    .sort((a, b) => b.weakCount - a.weakCount)
    .slice(0, 3);

  // The focus is the profile's focus skill (the one Ollie also talks about),
  // so the two surfaces never disagree about what to work on next.
  const focus =
    (profile.focusSkill && areasToImprove.find((r) => r.skill === profile.focusSkill)) ??
    areasToImprove[0] ??
    null;

  return {
    strengths,
    areasToImprove,
    focus,
    trend: profile.accuracyTrend,
    reviewCount: reviews.length,
    isEmpty: strengths.length === 0 && areasToImprove.length === 0,
  };
}
