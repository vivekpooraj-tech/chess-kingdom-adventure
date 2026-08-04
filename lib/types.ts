import type { PieceSymbol } from "chess.js";

export type Piece = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export interface AvatarOption {
  id: string;
  name: string;
  emoji: string; // placeholder for real sprite art
  colorFrom: string;
  colorTo: string;
}

export interface BuddyOption {
  id: string;
  name: string;
  piece: Piece | null; // buddies aren't tied to a piece, kept null
  emoji: string;
  personality: string;
  greeting: string;
  encouragement: string[];
  builtIn: boolean; // only the v1 buddy is fully implemented
}

export interface LessonStep {
  id: string;
  type: "story" | "minigame" | "puzzle" | "ai_chat" | "mini_match" | "reward";
  title: string;
}

export interface PuzzleContent {
  fen: string;
  prompt: string;
  /**
   * Which piece type(s) count as a correct first move — validates that the
   * child understood WHICH piece the lesson is teaching, not one exact
   * tactical square. Most puzzle positions are simplified movement-practice
   * (no opposing pieces to genuinely fork/pin), so "correct" here means
   * "moved the intended piece," a real and honest metric that doesn't
   * require fabricating single-answer tactics that don't actually exist in
   * these positions. "any" means every legal move counts (e.g. Day 30's
   * "make your first move" from the real starting position).
   */
  acceptedPieceTypes: PieceSymbol[] | "any";
}

export interface MiniMatchContent {
  fen: string;
  prompt: string;
  movesRequired: number;
}

export interface Lesson {
  dayNumber: number;
  crystal: Piece;
  title: string;
  storyBeat: string;
  skillTags: string[];
  /** References an id in content/minigame-catalog.ts and content/minigame-configs.ts */
  minigameId: string;
  puzzle: PuzzleContent;
  miniMatch: MiniMatchContent;
  steps: LessonStep[];
}
