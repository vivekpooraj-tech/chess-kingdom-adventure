import { getChessMindCategory } from "@/content/chessMindCategories";

export interface AcademyRecommendation {
  label: string;
  reason: string;
  href: string;
}

const SKILL_TAG_TO_CATEGORY: Record<string, string> = {
  fork_pattern: "pattern",
  pin_pattern: "pattern",
  back_rank_mate: "pattern",
  queen_king_mate: "pattern",
  tactics_mixed: "pattern",
  knight_movement: "visualization",
  knight_outpost: "visualization",
  bishop_movement: "spatial",
  bishop_pair: "spatial",
  rook_movement: "spatial",
  open_file: "spatial",
  rook_doubling: "spatial",
  queen_movement: "spatial",
  queen_safety: "spatial",
  king_movement: "memory",
  king_safety: "memory",
  pawn_movement: "mathematics",
  pawn_capture: "mathematics",
  pawn_structure: "mathematics",
  basic_endgames: "mathematics",
  promotion: "mathematics",
};

// Checked first — a specific tactical skill (e.g. "fork_pattern") should win
// over a generic piece-movement tag on the same lesson (e.g. "knight_movement"),
// since spotting the fork is what that lesson was really about.
const PRIORITY_TAGS = ["fork_pattern", "pin_pattern", "back_rank_mate", "queen_king_mate", "tactics_mixed"];

const CRYSTAL_TO_CATEGORY: Record<string, string> = {
  pawn: "mathematics",
  knight: "visualization",
  bishop: "spatial",
  rook: "spatial",
  queen: "spatial",
  king: "memory",
};

/**
 * Suggests one Chess Mind challenge related to the lesson the child just
 * finished — the LEARN -> PRACTICE -> THINK -> PLAY loop from the product
 * spec (e.g. a Knight lesson recommends Visualization, a Bishop lesson
 * recommends Spatial Thinking). Opening lessons point at the existing
 * Opening Explorer (built in Phase 9B) instead of a Chess Mind category,
 * since "opening pattern recognition" already lives there.
 */
export function getAcademyRecommendation(
  crystal: string,
  skillTags: string[]
): AcademyRecommendation | null {
  if (skillTags.includes("opening_principles")) {
    return {
      label: "Opening Explorer",
      reason: "Ready to spot this in a real game? Explore openings that use it.",
      href: "/academy/openings",
    };
  }

  const priorityTag = skillTags.find((t) => PRIORITY_TAGS.includes(t));
  const categoryId = priorityTag
    ? SKILL_TAG_TO_CATEGORY[priorityTag]
    : SKILL_TAG_TO_CATEGORY[skillTags[0]] ?? CRYSTAL_TO_CATEGORY[crystal];

  if (!categoryId) return null;
  const category = getChessMindCategory(categoryId);
  if (!category?.href) return null;

  const crystalLabel = crystal.charAt(0).toUpperCase() + crystal.slice(1);
  return {
    label: category.title,
    reason: `You just practiced the ${crystalLabel} — try a related Chess Mind challenge.`,
    href: category.href,
  };
}
