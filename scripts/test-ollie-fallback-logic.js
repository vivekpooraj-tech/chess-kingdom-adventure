// Pure-JS mirror of the local fallback knowledge base in
// lib/ollie/localFallback.ts -- no server, no network, no database. This is
// the emergency-backup path Ollie uses only when no real Anthropic key is
// configured or the real AI call fails; the real intelligence is the
// Anthropic call in app/api/ai/coach/route.ts, which this script does not
// (and cannot, without a real API key) exercise.
//
// Run: node scripts/test-ollie-fallback-logic.js

const PIECE_KEYWORDS = {
  king: /\bking\b/i,
  queen: /\bqueen\b/i,
  rook: /\brook\b/i,
  bishop: /\bbishop\b/i,
  knight: /\bknight\b/i,
  pawn: /\bpawn\b/i,
  castl: /\bcastl/i,
  checkmate: /\bcheckmate\b/i,
};

function detectTopic(text) {
  for (const [topic, pattern] of Object.entries(PIECE_KEYWORDS)) {
    if (pattern.test(text)) return topic;
  }
  return null;
}

const PRONOUN_PATTERN = /\b(it|that|this one|this piece)\b/i;
const STILL_LEARNING_REPLY =
  "Owl hoot! I'm not sure about that one yet. Try asking me another way, or ask your teacher.";

function localFallbackReply(rawMessage, history) {
  let message = rawMessage.toLowerCase();

  if (PRONOUN_PATTERN.test(message)) {
    const priorTopic = [...history]
      .reverse()
      .map((turn) => detectTopic(turn.text))
      .find((topic) => !!topic);
    if (priorTopic) message = `${message} ${priorTopic}`;
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

  if (mentionsKing && mentionsQueen && asksCapture) return "KING_CAN_CAPTURE_QUEEN";
  if (mentionsKing && mentionsQueen && (asksPower || pieceMentionCount === 2)) return "KING_VS_QUEEN_POWER";
  if (mentionsRook && mentionsBishop) return "ROOK_VS_BISHOP";
  if (mentionsPawn && asksBackward) return "PAWN_NO_BACKWARD";
  if (asksValue && /\b3\b|\bthree\b/.test(message)) return "MINOR_PIECE_VALUE";
  if (asksValue && mentionsQueen) return "QUEEN_VALUE";
  if (asksStalemate) return "STALEMATE";
  if (message.includes("checkmate")) return "CHECKMATE";
  if (message.includes("castl")) return "CASTLING";
  if (mentionsKing && asksWhy) return "KING_WHY_NO_MOVE";
  if (mentionsRook) return "ROOK_MOVE";
  if (mentionsKnight) return "KNIGHT_MOVE";
  if (mentionsBishop) return "BISHOP_MOVE";
  if (mentionsQueen) return "QUEEN_MOVE";
  if (mentionsKing) return "KING_MOVE";
  if (mentionsPawn) return "PAWN_MOVE";
  return STILL_LEARNING_REPLY;
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

// --- A. Basic questions get a topic-appropriate, non-generic answer ---
check('rook: "What does a rook do?"', localFallbackReply("What does a rook do?", []), "ROOK_MOVE");
check('knight: "How does a knight move?"', localFallbackReply("How does a knight move?", []), "KNIGHT_MOVE");
check('bishop: "What is a bishop?"', localFallbackReply("What is a bishop?", []), "BISHOP_MOVE");
check('castling: "What is castling?"', localFallbackReply("What is castling?", []), "CASTLING");
check('checkmate: "What is checkmate?"', localFallbackReply("What is checkmate?", []), "CHECKMATE");
check('stalemate: "What is stalemate?"', localFallbackReply("What is stalemate?", []), "STALEMATE");
check(
  'queen value: "How many points is a queen worth?"',
  localFallbackReply("How many points is a queen worth?", []),
  "QUEEN_VALUE"
);
check(
  'king captures queen: "Can a king capture a queen?"',
  localFallbackReply("Can a king capture a queen?", []),
  "KING_CAN_CAPTURE_QUEEN"
);

// --- B. Context / pronoun resolution ---
{
  const h1 = [{ from: "child", text: "What is a rook?" }, { from: "buddy", text: "ROOK_MOVE placeholder" }];
  check('pronoun "How does it move?" after rook resolves to rook', localFallbackReply("How does it move?", h1), "ROOK_MOVE");
}
{
  const h2 = [{ from: "child", text: "What is a bishop?" }, { from: "buddy", text: "BISHOP_MOVE placeholder" }];
  check(
    '"What about the queen?" switches topic away from prior bishop context',
    localFallbackReply("What about the queen?", h2),
    "QUEEN_MOVE"
  );
}

// --- E. Five different questions -> five distinct answers, none repeated ---
{
  const questions = [
    "What does a rook do?",
    "Is the queen stronger than the king?",
    "Can a knight jump over pieces?",
    "What happens when my pawn reaches the end?",
    "Why is castling useful?",
  ];
  const answers = questions.map((q) => localFallbackReply(q, []));
  const uniqueAnswers = new Set(answers);
  check("5 different questions produce 5 distinct answers", uniqueAnswers.size, answers.length);
  check("no answer is the generic 'still learning' fallback", answers.includes(STILL_LEARNING_REPLY), false);
}

// --- Never-guess: nonsense input gets the honest "not sure" reply, not a canned piece answer ---
check(
  'nonsense input gets the honest fallback, not a guess',
  localFallbackReply("purple elephant banana", []),
  STILL_LEARNING_REPLY
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
