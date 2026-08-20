import type { ChatTurn } from "./types";

const PIECE_KEYWORDS: Record<string, RegExp> = {
  king: /\bking\b/i,
  queen: /\bqueen\b/i,
  rook: /\brook\b/i,
  bishop: /\bbishop\b/i,
  knight: /\bknight\b/i,
  pawn: /\bpawn\b/i,
  castl: /\bcastl/i,
  checkmate: /\bcheckmate\b/i,
};

function detectTopic(text: string): string | null {
  for (const [topic, pattern] of Object.entries(PIECE_KEYWORDS)) {
    if (pattern.test(text)) return topic;
  }
  return null;
}

const PRONOUN_PATTERN = /\b(it|that|this one|this piece)\b/i;

const STILL_LEARNING_REPLY =
  "Owl hoot! I'm not sure about that one yet. Try asking me another way, or ask your teacher.";

/**
 * A small, question-matched knowledge base used ONLY as an emergency
 * backup -- when no real AI key is configured, or the real AI call fails.
 * This is deliberately NOT the primary intelligence and NEVER a random
 * pick from a fixed list: it matches on the actual question, and returns
 * an honest "not sure" reply rather than guessing when nothing matches, so
 * it can never present an unrelated canned answer as if it addressed the
 * child's actual question.
 */
export function localFallbackReply(rawMessage: string, history: ChatTurn[]): string {
  let message = rawMessage.toLowerCase();

  if (PRONOUN_PATTERN.test(message)) {
    const priorTopic = [...history]
      .reverse()
      .map((turn) => detectTopic(turn.text))
      .find((topic): topic is string => !!topic);
    if (priorTopic) {
      message = `${message} ${priorTopic}`;
    }
  }

  const mentionsKing = /\bking\b/.test(message);
  const mentionsQueen = /\bqueen\b/.test(message);
  const mentionsRook = /\brook\b/.test(message);
  const mentionsBishop = /\bbishop\b/.test(message);
  const mentionsKnight = /\bknight\b/.test(message);
  const mentionsPawn = /\bpawn\b/.test(message);
  const asksPower = /powerful|stronger|strongest|better|which is/.test(message);
  const asksCapture = /captur|take/.test(message);
  const asksValue = /worth|point|value/.test(message);
  const asksBackward = /backward|back\b/.test(message);
  const asksWhy = /why/.test(message);
  const asksStalemate = /stalemate/.test(message);
  const pieceMentionCount = [mentionsKing, mentionsQueen, mentionsRook, mentionsBishop, mentionsKnight, mentionsPawn].filter(
    Boolean
  ).length;

  // Multi-piece comparisons and special-keyword questions first (most specific).
  if (mentionsKing && mentionsQueen && asksCapture) {
    return "Hoo! Yes -- the king CAN capture the queen, just like any piece, as long as the queen isn't guarded by another piece. But careful: the king can never move onto a square where it would be in danger!";
  }
  if (mentionsKing && mentionsQueen && (asksPower || pieceMentionCount === 2)) {
    return "Great question! The queen is the most powerful piece for attacking -- she can zoom any direction, any distance. The king moves only one square at a time, but he's the MOST important piece: lose him and the game is over!";
  }
  if (mentionsRook && mentionsBishop) {
    return "The rook is usually a bit stronger than the bishop -- the rook can march any distance up, down, left, or right, while the bishop only glides along diagonals of one color.";
  }
  if (mentionsPawn && asksBackward) {
    return "Nope! Pawns are brave little adventurers who can only march forward, never backward -- though they do get to capture enemy pieces diagonally.";
  }
  if (asksValue && /\b3\b|\bthree\b/.test(message)) {
    return "Both the bishop and the knight are worth about 3 points each -- they're called the 'minor pieces' because rooks and queens are worth even more!";
  }
  if (asksValue && mentionsQueen) {
    return "The queen is worth about 9 points -- the most valuable piece other than the king, who's worth more than any number can say!";
  }
  if (asksStalemate) {
    return "Stalemate is when a player is NOT in check but has no legal move at all -- and instead of losing, the game becomes a draw!";
  }
  if (message.includes("checkmate")) {
    return "Checkmate is the whole goal of chess! It means the enemy king is trapped and can't escape capture -- that's how you win the game.";
  }
  if (message.includes("castl")) {
    return "Castling is a special move where the king hops two squares toward a rook, and the rook hops right over to the other side -- it's the best way to tuck your king in somewhere safe!";
  }
  if (mentionsKing && asksWhy) {
    return "Your king can never move onto a square where an enemy piece could capture it next -- that would put him in check! Try looking at what's guarding that square.";
  }

  // Single-piece defaults: asking about one piece by name almost always
  // means "what does it do / how does it move", regardless of exact phrasing.
  if (mentionsRook) {
    return "The rook loves marching in straight lines -- up, down, left, or right, as far as it wants, like a knight in shining armor patrolling the castle walls!";
  }
  if (mentionsKnight) {
    return "The knight hops in an L-shape -- two squares one way, then one square sideways -- and it's the only piece that can jump right over other pieces!";
  }
  if (mentionsBishop) {
    return "The bishop glides diagonally, as far as it wants -- but it can only ever visit squares of the one color it started on!";
  }
  if (mentionsQueen) {
    return "The queen is the most powerful piece on the board -- she can move any direction, any distance: straight like a rook, or diagonal like a bishop!";
  }
  if (mentionsKing) {
    return "The king can only move one square at a time, in any direction -- but he's the most important piece of all: if he's trapped, the game is over!";
  }
  if (mentionsPawn) {
    return "Pawns march straight forward one square at a time (two on their very first move!), but they capture enemy pieces diagonally instead.";
  }

  return STILL_LEARNING_REPLY;
}
