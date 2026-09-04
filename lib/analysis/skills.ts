/**
 * The Chess Mind skill taxonomy — the single source of truth for the
 * skill categories the Game Review can attribute a mistake to and the
 * Personalized Practice loop can send a child to practice.
 *
 * These are the categories from the product spec. Each has a stable id
 * (used in the /api/game-analysis/explain response and by
 * lib/training/recommendation.ts), a child-facing display name, a one-line
 * description, an emoji (the design system's icon convention — see the
 * emoji used throughout content/chessMindCategories.ts, achievements, etc.)
 * and a reusable child-friendly principle.
 *
 * There is intentionally no second skill system: parentInsights.ts's
 * "Skills Snapshot" is a coarse practice-volume proxy over the Chess Mind
 * *modules*; this is the fine-grained *tactical/strategic* vocabulary the
 * review speaks. Phase D is where the two are joined; for now this list
 * only drives review + practice routing.
 */
export type SkillId =
  | "piece_safety"
  | "checks"
  | "captures"
  | "threats"
  | "forks"
  | "pins"
  | "skewers"
  | "discovered_attacks"
  | "king_safety"
  | "opening_principles"
  | "development"
  | "center_control"
  | "calculation"
  | "tactical_awareness"
  | "endgame"
  | "pawn_structure"
  /** Deliberate neutral bucket — used when the facts do not confidently
   * support any specific skill. Never invent a theme to avoid this. */
  | "advantage_loss";

export interface SkillInfo {
  id: SkillId;
  name: string;
  emoji: string;
  /** One line, parent/child readable. */
  description: string;
  /**
   * The reusable "what to notice" principle a child can carry into the
   * next game. Kept generic on purpose — the position-specific "why" comes
   * from the explain API; this is the takeaway.
   */
  principle: string;
}

export const SKILLS: Record<SkillId, SkillInfo> = {
  piece_safety: {
    id: "piece_safety",
    name: "Piece Safety",
    emoji: "🛡️",
    description: "Keeping your pieces defended and out of danger.",
    principle: "Before you move, check whether any of your pieces can be captured for free.",
  },
  checks: {
    id: "checks",
    name: "Checks",
    emoji: "⚡",
    description: "Spotting checks — yours and your opponent's.",
    principle: "Every move, ask: is there a check for me, or a check coming at me?",
  },
  captures: {
    id: "captures",
    name: "Captures",
    emoji: "✖️",
    description: "Looking at every capture before choosing a move.",
    principle: "Look at all the captures on the board first, even the ones that look strange.",
  },
  threats: {
    id: "threats",
    name: "Threats",
    emoji: "❗",
    description: "Noticing what your opponent is trying to do.",
    principle: "After your opponent moves, ask: what are they now attacking?",
  },
  forks: {
    id: "forks",
    name: "Forks",
    emoji: "🍴",
    description: "Attacking two things at once with one piece.",
    principle: "A knight or queen near two enemy pieces might be able to fork them.",
  },
  pins: {
    id: "pins",
    name: "Pins",
    emoji: "📌",
    description: "A piece that can't move because something important is behind it.",
    principle: "A piece lined up in front of its king or queen is pinned — it can't safely move.",
  },
  skewers: {
    id: "skewers",
    name: "Skewers",
    emoji: "🥢",
    description: "Forcing a valuable piece to move so you can win the one behind it.",
    principle: "Line up your rook, bishop or queen against a big piece with something behind it.",
  },
  discovered_attacks: {
    id: "discovered_attacks",
    name: "Discovered Attacks",
    emoji: "🎭",
    description: "Moving one piece to unleash an attack from another.",
    principle: "Moving a piece out of the way can open a line for the piece behind it.",
  },
  king_safety: {
    id: "king_safety",
    name: "King Safety",
    emoji: "🏰",
    description: "Keeping your king tucked away and defended.",
    principle: "Castle early, and keep the pawns in front of your king in place.",
  },
  opening_principles: {
    id: "opening_principles",
    name: "Opening Principles",
    emoji: "🌅",
    description: "Starting the game the right way.",
    principle: "In the opening: control the centre, develop your pieces, and castle.",
  },
  development: {
    id: "development",
    name: "Development",
    emoji: "🧩",
    description: "Getting all your pieces into the game.",
    principle: "Try not to move the same piece twice in the opening while others are still at home.",
  },
  center_control: {
    id: "center_control",
    name: "Center Control",
    emoji: "🎯",
    description: "Fighting for the middle four squares.",
    principle: "Pawns and pieces that control the centre give your whole army more room.",
  },
  calculation: {
    id: "calculation",
    name: "Calculation",
    emoji: "🧮",
    description: "Looking ahead a few moves before deciding.",
    principle: "Picture the position after your move and your opponent's best reply before you commit.",
  },
  tactical_awareness: {
    id: "tactical_awareness",
    name: "Tactical Awareness",
    emoji: "👀",
    description: "Seeing the tactic that's available right now.",
    principle: "Before every move, scan for checks, captures and threats — for both sides.",
  },
  endgame: {
    id: "endgame",
    name: "Endgame",
    emoji: "👑",
    description: "Playing well when few pieces are left.",
    principle: "In the endgame, activate your king and push your passed pawns.",
  },
  pawn_structure: {
    id: "pawn_structure",
    name: "Pawn Structure",
    emoji: "♟️",
    description: "Keeping your pawns working together.",
    principle: "Pawns can't move backwards — think before you push one.",
  },
  advantage_loss: {
    id: "advantage_loss",
    name: "Staying Alert",
    emoji: "🔎",
    description: "Not letting a good position slip away.",
    principle: "When you're doing well, keep checking every move — that's when advantages get given back.",
  },
};

export const ALL_SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export function getSkill(id: string | null | undefined): SkillInfo {
  if (id && id in SKILLS) return SKILLS[id as SkillId];
  return SKILLS.advantage_loss;
}

/** True for the real skill ids (everything except the neutral bucket). */
export function isSpecificSkill(id: SkillId): boolean {
  return id !== "advantage_loss";
}
