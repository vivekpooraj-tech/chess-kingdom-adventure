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