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
  /** Optional flat-mode extras (ignored for image-backed skins, which bake
   * their own frame/labels into boardImageUrl). frameColor draws an inset
   * border around the board; coordinateColor overrides the default
   * light/dark-derived file/rank label color. Both optional and additive —
   * skins that omit them render exactly as before. */
  frameColor?: string;
  coordinateColor?: string;
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
  /**
   * Rendered HEIGHT of each piece as a fraction of one board square — the
   * single optical coordinate system every piece in the set shares. Without
   * this each piece was fitted to its own bounding box, so a short wide
   * silhouette (the rook) rendered visually larger than a tall narrow one
   * (the king). These values mirror the real height relationships of a
   * Staunton set — king tallest, then queen, bishop, knight, rook, and the
   * pawn always smallest — derived from each set's own cropped SVG viewBox
   * heights and eased into a comfortable on-square range. Light and dark
   * share one folder, so they are identical by construction. The
   * interactive square underneath is never resized by this.
   */
  opticalScale: Record<PieceSymbol, number>;
}

export interface ChessPuzzle {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  /**
   * No stored solution move list — validated algorithmically instead (see
   * lib/chess-engine/puzzleValidation.ts, isSoundMateInNFirstMove/
   * hasMateInN). mate-in-1: any move that delivers checkmate is correct.
   * mate-in-2/3: each non-final move must lead to a forced mate one move
   * shorter against EVERY legal opponent reply, not just one hand-picked
   * line — that's the actual definition of a sound forcing sequence, and it
   * means the puzzle stays correct no matter which legal defense the
   * opponent (or a curious kid poking at replies) actually plays. Every
   * entry in content/puzzles.ts is verified via exactMateDepth() to have
   * exactly this mate distance, not an easier one.
   */
  mateIn: 1 | 2 | 3;
  theme: string;
  /**
   * Internal 1-6 difficulty tier used by the Daily Challenge selection RPC
   * (get_daily_challenge) — computed objectively from solution precision
   * and defender reply counts (see scripts/compute-puzzle-levels.js), not
   * hand-guessed. Never shown to the player as a raw number or a label
   * like "Beginner"/"Expert" — see components/home/DailyChallengeCard.tsx.
   * Mirrored in supabase/migrations/0025_daily_challenge_progression.sql's
   * daily_challenge_puzzles table; keep both in sync by hand, same
   * tradeoff already accepted for TIME_CONTROLS ids.
   */
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface LessonStep {
  id: string;
  type: "story" | "piece_intro" | "minigame" | "puzzle" | "ai_chat" | "mini_match" | "reward";
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
