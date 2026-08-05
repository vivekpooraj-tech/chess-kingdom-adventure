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

export interface BoardSkinOption {
  id: string;
  name: string;
  emoji: string;
  /** CSS color value (rgba/hex) — not a Tailwind class, since ChessBoard
   * applies these via inline style (Tailwind's JIT can't see dynamically
   * assembled class names like `bg-${skin.lightSquare}`). Used for the flat
   * square fill (skins without boardImageUrl) and always as the picker's
   * checkerboard swatch preview, even for image-backed skins. */
  lightSquare: string;
  darkSquare: string;
  /**
   * When set, ChessBoard renders this full pre-rendered board image (frame,
   * texture, coordinate labels all baked in) behind a transparent, inset
   * interactive grid instead of filling squares with lightSquare/darkSquare.
   * Must be a square image with an even border frame — see
   * BOARD_IMAGE_FRAME_PERCENT in components/board/ChessBoard.tsx for how the
   * grid is inset to line up with the image's drawn squares.
   */
  boardImageUrl?: string;
}

export interface PieceSetOption {
  id: string;
  name: string;
  emoji: string;
  /** Subfolder under public/pieces/ (e.g. "wood-classic") with its own
   * light/dark piece SVGs. Omitted = the original default set directly at
   * public/pieces/{light,dark}/*.svg. Independent of BoardSkinOption — any
   * piece set can pair with any board skin. */
  folder?: string;
  /**
   * This set's SVG viewBox dimensions, passed as the <img> width/height
   * HTML attributes (not CSS) so the browser has an unambiguous intrinsic
   * aspect ratio to scale from — these SVGs declare a viewBox but no root
   * width/height, and relying on the browser to infer aspect ratio from
   * viewBox alone proved unreliable in testing (classic's square 100x100
   * rendered wildly oversized/clipped in at least one render). CSS
   * max-width/max-height still does the actual visual constraining.
   */
  intrinsicSize: { width: number; height: number };
}

export interface ChessPuzzle {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  /**
   * No stored solution move list — validated algorithmically instead (see
   * lib/chess-engine/puzzleValidation.ts). mate-in-1: any move that
   * delivers checkmate is correct. mate-in-2: the first move must lead to
   * mate-in-1 against EVERY legal opponent reply, not just one hand-picked
   * line — that's the actual definition of a sound mate-in-2, and it means
   * the puzzle stays correct no matter which legal defense the opponent
   * (or a curious kid poking at replies) actually plays.
   */
  mateIn: 1 | 2;
  theme: string;
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
