/**
 * One-way, partial bridge from Chess School's learning-progression tags
 * (SchoolSkillTag) to the existing Chess Mind weakness-signal vocabulary
 * (SkillId, stored in child_skill_signals).
 *
 * Deliberately partial: only tags with an honest tactical/strategic
 * counterpart are mapped. Mechanics-only tags (piece movement, board setup,
 * castling, planning, ...) return null rather than being forced into a
 * bucket — writing those as a "weakness" would misrepresent "not yet taught"
 * as "struggling with it", which is exactly what child_skill_signals is not
 * supposed to mean. This does not redesign SkillId or child_skill_signals;
 * it only decides which existing SchoolSkillTag values are eligible to bump
 * an existing signal.
 */
import type { SchoolSkillTag } from "@/content/school/types";
import type { SkillId } from "@/lib/analysis/skills";

const SCHOOL_SKILL_TO_SIGNAL: Partial<Record<SchoolSkillTag, SkillId>> = {
  fork: "forks",
  pin: "pins",
  skewer: "skewers",
  check: "checks",
  hanging_pieces: "piece_safety",
  king_safety: "king_safety",
  opening_principles: "opening_principles",
  endgame_king: "endgame",
};

/** Null for any tag with no honest SkillId counterpart. */
export function mapSchoolSkillToSignal(tag: SchoolSkillTag): SkillId | null {
  return SCHOOL_SKILL_TO_SIGNAL[tag] ?? null;
}

/** De-duplicated, honest-mapping-only SkillIds for a session's skillTags. */
export function mapSessionSkillsToSignals(tags: readonly SchoolSkillTag[]): SkillId[] {
  const out = new Set<SkillId>();
  for (const tag of tags) {
    const mapped = mapSchoolSkillToSignal(tag);
    if (mapped) out.add(mapped);
  }
  return [...out];
}
