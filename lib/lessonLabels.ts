/**
 * Human-readable labels for lesson skillTags (content/lessons.ts) — powers
 * the Reward screen's "You Learned" checklist (Phase 11 point 15) from real
 * per-lesson data instead of inventing outcomes. Every tag actually used
 * across all 30 lessons is covered; if a lesson introduces a new tag later,
 * the checklist falls back to a readable version of the raw tag rather than
 * silently dropping it.
 */
const SKILL_TAG_LABELS: Record<string, string> = {
  pawn_movement: "How the Pawn moves",
  pawn_capture: "How the Pawn captures",
  pawn_structure: "Building a strong pawn structure",
  knight_movement: "How the Knight moves",
  knight_outpost: "Placing a Knight on a strong outpost",
  bishop_movement: "How the Bishop moves",
  bishop_pair: "The strength of the bishop pair",
  rook_movement: "How the Rook moves",
  rook_doubling: "Doubling Rooks on a file",
  open_file: "Using an open file",
  queen_movement: "How the Queen moves",
  queen_safety: "Keeping the Queen safe",
  king_movement: "How the King moves",
  king_safety: "Keeping the King safe",
  fork_pattern: "Finding a fork",
  pin_pattern: "Finding a pin",
  back_rank_mate: "Spotting a back-rank mate",
  queen_king_mate: "Delivering checkmate with Queen and King",
  opening_principles: "Sound opening principles",
  promotion: "Promoting a pawn",
  basic_endgames: "Basic endgame technique",
  tactics_mixed: "Spotting tactics in a real position",
};

function fallbackLabel(tag: string): string {
  return tag.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function getSkillTagLabel(tag: string): string {
  return SKILL_TAG_LABELS[tag] ?? fallbackLabel(tag);
}
