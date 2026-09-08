/**
 * Ollie's deterministic knowledge layer.
 *
 * WHY THIS EXISTS.
 *
 * Ollie is a hybrid: a real LLM when one is configured, and this when one is
 * not. lib/ollie/aiProvider.ts falls through to the local layer whenever
 * callAnthropic() returns null — which it does for a missing key, a non-OK
 * response, OR any thrown error, all indistinguishable. So in production this
 * layer may well be answering every question, and a Chess School needs a
 * teacher that works either way.
 *
 * THE BUG THIS REPLACES. The previous matcher computed an `asksPower` flag but
 * used it in exactly one branch, which ALSO required the child to have named
 * both the king and the queen. So "which is the powerful chess piece in the
 * board" — no piece named — fell through every rule to "Owl hoot! I'm not sure
 * about that one yet", even though the correct answer sat three rules below,
 * reachable only by children who already knew to say "queen".
 *
 * The fix is to classify INTENT first (what is being asked) and treat the
 * pieces named as one signal among several, rather than as the entry
 * condition for every rule.
 *
 * TRUTHFULNESS. The product answers below state only what this repository
 * actually contains — 30 lessons, the real puzzle counts, real progress. Chess
 * Mind World is described as in development because, as of this commit, no
 * world/scene/location code exists. Nothing here may claim a feature the app
 * does not have.
 *
 * Pure: message and history in, answer out. No I/O, no clock, no randomness —
 * the same question always gets the same answer, which is what makes it
 * testable without a live model.
 */
import type { ChatTurn } from "./types";

export interface KnowledgeAnswer {
  /** Stable id — lets tests assert routing, and lets the fallback ladder
   *  tell "we already said this" from "we have not". */
  id: string;
  text: string;
}

export type PieceName = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

const PIECE_PATTERNS: Record<PieceName, RegExp> = {
  king: /\bkings?\b/i,
  queen: /\bqueens?\b/i,
  rook: /\brooks?\b|\bcastles?\b(?!\s*ing)/i,
  bishop: /\bbishops?\b/i,
  knight: /\bknights?\b|\bhorse\b/i,
  pawn: /\bpawns?\b/i,
};

export interface QuestionContext {
  text: string;
  pieces: PieceName[];
  /** "most powerful", "strongest", "best piece" — with or without a name. */
  asksSuperlative: boolean;
  asksValue: boolean;
  asksCapture: boolean;
  asksBackward: boolean;
  asksWhy: boolean;
  asksProduct: boolean;
}

/** Pronouns resolve against the last piece mentioned, so "how does it move?"
 *  after talking about rooks still works. */
const PRONOUN_PATTERN = /\b(it|that|this one|this piece|they|them)\b/i;

function piecesIn(text: string): PieceName[] {
  return (Object.keys(PIECE_PATTERNS) as PieceName[]).filter((p) =>
    PIECE_PATTERNS[p].test(text)
  );
}

export function classify(rawMessage: string, history: readonly ChatTurn[] = []): QuestionContext {
  let text = String(rawMessage ?? "").toLowerCase();

  if (PRONOUN_PATTERN.test(text) && piecesIn(text).length === 0) {
    const prior = [...history]
      .reverse()
      .map((turn) => piecesIn(String(turn?.text ?? "").toLowerCase()))
      .find((found) => found.length > 0);
    if (prior?.length) text = `${text} ${prior.join(" ")}`;
  }

  return {
    text,
    pieces: piecesIn(text),
    // The load-bearing one. Deliberately does NOT require a piece name.
    asksSuperlative:
      /\b(most|more)\s+(powerful|valuable|important)\b/.test(text) ||
      /\b(strongest|powerfullest|best|strong|stronger|better)\b/.test(text) ||
      /\bpowerful\b/.test(text) ||
      /\bwhich\s+(is|piece|one)\b.*\b(power|strong|best|good)/.test(text),
    asksValue: /\bworth\b|\bpoints?\b|\bvalue\b/.test(text),
    asksCapture: /\bcaptur|\btakes?\b|\beat\b|\bkill\b/.test(text),
    asksBackward: /\bbackwards?\b|\bback\b/.test(text),
    asksWhy: /\bwhy\b/.test(text),
    // Product intent, but never for a chess phrase that merely contains one of
    // these words: "world champion" is a chess question, not a question about
    // Chess Mind World.
    asksProduct:
      /\bchess mind\b|\bchess school\b|\bapps?\b|\bpremium\b|\bpuzzles?\b|\bprogress\b|\bworld\b|\b(30|thirty) days?\b/.test(
        text
      ) && !/\bworld (champion|championship|record|cup)\b/.test(text),
  };
}

/**
 * Level 3 — Chess Mind product facts.
 *
 * Every figure here is real and checked against the repository: 30 lessons in
 * content/lessons.ts, 1,003 verified mate puzzles, 5,000 verified tactics
 * puzzles, three Academy courses. Chess Mind World is stated as not yet
 * available, because it is not.
 */
const PRODUCT_RULES: { id: string; test: (c: QuestionContext) => boolean; text: string }[] = [
  {
    id: "product.world",
    test: (c) => /\bworld\b/.test(c.text),
    text: "Chess Mind World is still being built! The idea is to let you play chess in extraordinary places. It isn't available yet — but everything else here is ready for you right now.",
  },
  {
    id: "product.school.days",
    test: (c) =>
      /\bhow many\b/.test(c.text) && /\bdays?|lessons?\b/.test(c.text),
    text: "Chess School has 30 days! Each day is one short lesson with a story, a mini-game, a puzzle and a little match. You go at your own pace — one day at a time.",
  },
  {
    id: "product.school",
    test: (c) => /\bchess school|30 days?|thirty days?\b/.test(c.text),
    text: "Chess School is our 30-day course — 'Speak Chess in 30 Days'. Every day teaches one idea with a story, a mini-game, a puzzle and a mini match, and your progress is saved as you go.",
  },
  {
    id: "product.puzzles",
    test: (c) => /\bpuzzles?\b/.test(c.text),
    text: "Puzzles are quick chess challenges! There's a Daily Challenge, plus a big library of checkmate puzzles and tactics to practise whenever you like.",
  },
  {
    id: "product.progress",
    test: (c) => /\bprogress|streak|how (do|does).*(track|save)/.test(c.text),
    text: "Your progress is saved automatically. Chess School remembers which days you've finished, and puzzles remember what you've solved — so you can always pick up where you left off.",
  },
  {
    id: "product.premium",
    test: (c) => /\bpremium|free|pay|cost|price\b/.test(c.text),
    text: "Some lessons are free to try, and Premium unlocks the full journey. Your grown-up can see the details on the Premium page — I'll leave that one to them!",
  },
  {
    id: "product.compare",
    test: (c) => /\bcompare|other apps?|better than|vs\b|versus\b/.test(c.text),
    text: "I can't really review other apps! What I can tell you is what's here: a 30-day Chess School, thousands of puzzles, games against the computer or friends, and your own progress tracking. Want me to show you where to start?",
  },
  {
    id: "product.general",
    test: (c) => /\bchess mind\b|\bapps?\b/.test(c.text),
    text: "Chess Mind is your chess home! There's Chess School — a 30-day course — plus puzzles, real games, and tracking so you can see yourself improve. What would you like to try?",
  },
];

/**
 * Level 2 — general chess facts.
 *
 * Ordered most-specific first. Each rule states the answer up front, then a
 * short reason, which is the shape the brief asks for: answer the question,
 * then explain.
 */
const CHESS_RULES: { id: string; test: (c: QuestionContext) => boolean; text: string }[] = [
  // --- The reported failure. No piece name required. ---
  {
    id: "chess.mostPowerful",
    test: (c) =>
      c.asksSuperlative &&
      // With no piece named, the question must still be ABOUT pieces —
      // otherwise "what's the best opening?" would get an answer about the
      // queen. With no subject at all, Ollie says he doesn't know.
      ((c.pieces.length === 0 && /\bpiece/.test(c.text)) ||
        (c.pieces.includes("queen") && c.pieces.includes("king"))),
    text: "The queen is the most powerful piece 👑 — she can move any direction, any distance: straight like a rook or diagonally like a bishop. But the king is the most IMPORTANT piece: if he's checkmated, the game ends!",
  },
  {
    id: "chess.kingTakesQueen",
    test: (c) => c.pieces.includes("king") && c.pieces.includes("queen") && c.asksCapture,
    text: "Yes — the king CAN capture the queen, just like any piece, as long as she isn't guarded. But careful: the king can never move onto a square where he'd be in danger!",
  },
  {
    id: "chess.rookVsBishop",
    test: (c) => c.pieces.includes("rook") && c.pieces.includes("bishop"),
    text: "The rook is usually a little stronger than the bishop — the rook marches any distance up, down, left or right, while the bishop only glides on diagonals of one colour.",
  },
  {
    // Any other "is X better than Y?" — answered with the real values rather
    // than by falling through to a one-piece explanation that ignores half the
    // question.
    id: "chess.compare",
    test: (c) => c.asksSuperlative && c.pieces.length >= 2,
    text: "Here's the usual count: pawn 1, knight 3, bishop 3, rook 5, queen 9 — the bigger number is usually the stronger piece. The king has no number at all: he isn't strong, he's essential!",
  },
  {
    id: "chess.pawnBackward",
    test: (c) => c.pieces.includes("pawn") && c.asksBackward,
    text: "No — pawns are brave little adventurers who only ever march forward, never backward! They do capture diagonally, though.",
  },
  // --- Named concepts ---
  {
    id: "chess.fork",
    test: (c) => /\bfork/.test(c.text),
    text: "A fork is when ONE piece attacks two things at once! 🍴 Knights are famous for it. Your opponent can only save one — so you win the other.",
  },
  {
    id: "chess.pin",
    test: (c) => /\bpin\b|\bpinned\b/.test(c.text),
    text: "A pin is when a piece can't move because something more valuable is hiding behind it. Move it, and you'd lose the bigger piece — so it's stuck!",
  },
  {
    id: "chess.skewer",
    test: (c) => /\bskewer/.test(c.text),
    text: "A skewer is like a pin turned around: you attack a big piece, it moves away, and you capture the smaller piece that was behind it.",
  },
  // Stalemate BEFORE checkmate, and both anchored on both sides: an unanchored
  // /mate\b/ matches the tail of "stalemate" and would answer a stalemate
  // question with the checkmate rule.
  {
    id: "chess.stalemate",
    test: (c) => /\bstalemate\b/.test(c.text),
    text: "Stalemate is when a player is NOT in check but has no legal move at all. Instead of losing, the game is a draw!",
  },
  {
    id: "chess.checkmate",
    test: (c) => /\bcheckmate\b|\bmate\b/.test(c.text),
    text: "Checkmate is how you win! It means the enemy king is attacked and there's no way out — he can't move away, block, or capture the attacker.",
  },
  {
    id: "chess.check",
    test: (c) => /\bcheck\b/.test(c.text),
    text: "Check means the king is under attack right now! You must get out of it immediately — move the king, block the attack, or capture the attacker.",
  },
  {
    id: "chess.castling",
    test: (c) => /\bcastl(e|ing)\b/.test(c.text),
    text: "Castling is a special move: the king hops two squares toward a rook, and the rook jumps over to his other side. It's the best way to tuck your king somewhere safe!",
  },
  {
    id: "chess.enPassant",
    test: (c) => /\ben passant|passant\b/.test(c.text),
    text: "En passant is a rare pawn capture! If an enemy pawn leaps two squares to land beside yours, your pawn may capture it as though it had only moved one.",
  },
  {
    id: "chess.promotion",
    test: (c) => /\bpromot|queening\b/.test(c.text),
    text: "If a pawn marches all the way to the far end of the board, it gets promoted — usually into a queen! That's why every little pawn matters.",
  },
  {
    id: "chess.whoStarts",
    test: (c) => /\bwho (goes|moves|starts) first|first move\b/.test(c.text),
    text: "White always moves first! Then players take turns, one move each.",
  },
  // --- Values ---
  {
    id: "chess.valueMinor",
    test: (c) => c.asksValue && /\b3\b|\bthree\b/.test(c.text),
    text: "The bishop and the knight are each worth about 3 points — they're called the 'minor pieces', because rooks and queens are worth more.",
  },
  {
    id: "chess.valueQueen",
    test: (c) => c.asksValue && c.pieces.includes("queen"),
    text: "The queen is worth about 9 points — the most valuable piece after the king, who is beyond any price!",
  },
  {
    id: "chess.values",
    test: (c) => c.asksValue,
    text: "Here's the usual count: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king has no number — losing him loses the game!",
  },
  {
    id: "chess.kingSafety",
    test: (c) => c.pieces.includes("king") && c.asksWhy,
    text: "Your king can never move onto a square an enemy piece is attacking — that would be moving into check. Have a look at what's guarding that square!",
  },
  // --- Single piece: naming a piece almost always means "what does it do". ---
  {
    id: "chess.rook",
    test: (c) => c.pieces.includes("rook"),
    text: "The rook marches in straight lines — up, down, left or right, as far as it likes. Perfect for patrolling open files!",
  },
  {
    id: "chess.knight",
    test: (c) => c.pieces.includes("knight"),
    text: "The knight hops in an L-shape — two squares one way, then one square sideways. It's the only piece that can jump right over others! 🐴",
  },
  {
    id: "chess.bishop",
    test: (c) => c.pieces.includes("bishop"),
    text: "The bishop glides diagonally as far as it likes — but it always stays on the colour of square it started on.",
  },
  {
    id: "chess.queen",
    test: (c) => c.pieces.includes("queen"),
    text: "The queen is the most powerful piece — she moves any direction, any distance: straight like a rook, or diagonally like a bishop! 👑",
  },
  {
    id: "chess.king",
    test: (c) => c.pieces.includes("king"),
    text: "The king moves one square at a time in any direction. He's slow — but he's the most important piece of all: if he's trapped, the game ends.",
  },
  {
    id: "chess.pawn",
    test: (c) => c.pieces.includes("pawn"),
    text: "Pawns march straight forward one square (two on their very first move!), but they capture diagonally. Reach the far side and a pawn becomes a queen!",
  },
];

/**
 * Answer from the knowledge layer, or null when nothing genuinely matches.
 *
 * Null is a real answer here: it means "we do not know", and the caller says
 * so honestly rather than returning an unrelated canned reply as if it
 * addressed the question. Product rules run first only when the question is
 * clearly about the app, so "what is a pin?" is never captured by a product
 * rule matching a stray word.
 */
export function answerFromKnowledge(ctx: QuestionContext): KnowledgeAnswer | null {
  if (ctx.asksProduct) {
    for (const rule of PRODUCT_RULES) {
      if (rule.test(ctx)) return { id: rule.id, text: rule.text };
    }
  }
  for (const rule of CHESS_RULES) {
    if (rule.test(ctx)) return { id: rule.id, text: rule.text };
  }
  return null;
}

/** Exposed so tests can assert coverage without reaching into internals. */
export const KNOWLEDGE_RULE_IDS = [
  ...PRODUCT_RULES.map((r) => r.id),
  ...CHESS_RULES.map((r) => r.id),
];
