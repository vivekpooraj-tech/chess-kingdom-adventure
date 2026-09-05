/**
 * Generates content/strategyLessons.ts from engine-verified position data.
 *
 *   node scripts/emit-strategy-lessons.js strat-a.json [strat-b.json ...]
 *
 * The prose is authored. The positions and answers are not: build-strategy.js
 * finds positions where STOCKFISH'S OWN top move is an instance of the idea a
 * lesson teaches, so the exercise answer is the engine's move by construction.
 *
 * Only lessons with enough verified positions are emitted. A concept that the
 * search could not support is left out of the course rather than filled with an
 * authored guess — a strategy lesson built on an unverified "best move" is
 * exactly the kind of confident wrongness this pipeline exists to prevent.
 */
const fs = require("fs");
const path = require("path");

const data = {};
for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) continue;
  const part = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [k, v] of Object.entries(part)) {
    data[k] = [...(data[k] ?? []), ...v];
  }
}

const PROSE = {
  "king-safety": {
    order: 1,
    title: "Get the King Out of the Centre",
    concept: "Castling is not a formality — it is usually the most valuable move available.",
    intro:
      "Most attacking games are decided by which king was still sitting in the centre when the position opened up. Castling is the cheapest insurance in chess, and it is the move players most often postpone for one move too long.",
    explanation:
      "A king on its starting square sits on the file most likely to be opened, in front of pieces that want to move. Once lines open, every enemy piece aiming at the centre is aiming at your king, and defending costs far more time than castling would have.\n\nThe practical rule is simple: once your king can go, ask hard whether anything is genuinely more urgent. Usually nothing is. The exceptions are real — a forcing tactic, an immediate threat that must be met — but they are exceptions, and the habit should be to castle rather than to find reasons not to.",
    whatToLookFor:
      "Can your king still castle? Are central files starting to open? If both are true, castling is probably the move.",
    successNote: (san) =>
      `Correct — ${san}. The king steps off the open lines and the rook joins the game. This is Stockfish's move here too.`,
    failure:
      "Not this one. The king is still in the centre and the position is opening up — deal with that first.",
    prompt: "Your king is still in the centre. Fix that.",
    quiz: {
      question: "You can castle, and nothing is currently attacking you. What should you usually do?",
      options: [
        "Castle — safety is cheapest before the position opens, not after",
        "Wait to see which side the opponent attacks on first",
        "Develop one more piece, then decide",
      ],
      correctIndex: 0,
    },
    takeaway:
      "When castling is available and nothing forces your hand, castle. Postponing it is the most common way good positions collapse.",
  },
  outposts: {
    order: 2,
    title: "Outposts",
    concept: "A square no enemy pawn can ever attack is a permanent home for a knight.",
    intro:
      "Some squares cannot be challenged. If no enemy pawn can ever attack a square — because the pawns that would do it are gone or have already passed by — then a piece placed there can never be chased away.",
    explanation:
      "That permanence is what makes outposts different from merely good squares. A knight on a normal central square can be kicked by a pawn in a move or two; a knight on an outpost has to be traded off, and trading a defender usually costs the opponent something else.\n\nKnights benefit most, because they are short-range pieces whose value depends almost entirely on where they stand. A knight on a protected outpost deep in enemy territory can be worth more than a rook. Look for these squares in front of backward pawns and on half-open files, and support them with a pawn so the outpost cannot simply be exchanged away.",
    whatToLookFor:
      "Find a square in enemy territory where no enemy pawn can ever attack you, and check whether one of your own pawns defends it.",
    successNote: (san) =>
      `Correct — ${san}. No enemy pawn can ever attack that square, and the knight is defended: it cannot be driven away.`,
    failure:
      "Not this square. Look for a square in enemy territory where no enemy pawn can ever come to attack you.",
    prompt: "There is a square here no enemy pawn can ever attack. Put your knight on it.",
    quiz: {
      question: "What makes a square an outpost rather than just a good square?",
      options: [
        "No enemy pawn can ever attack it, so a piece there cannot be driven away",
        "It is in the centre of the board",
        "It is defended by more pieces than the opponent attacks it with",
      ],
      correctIndex: 0,
    },
    takeaway:
      "Before moving a knight, ask which squares the enemy pawns can never reach. Those are the squares worth aiming at.",
  },
  "pawn-breaks": {
    order: 3,
    title: "Pawn Breaks",
    concept: "Pawns are how you change a position that has stopped changing.",
    intro:
      "When neither side can make progress with pieces, the position is decided by pawn breaks — advances that make contact with the enemy pawn chain and force it to resolve.",
    explanation:
      "Pieces can only work with the lines the pawns leave them. If your rooks have no open file and your bishops no open diagonal, no amount of shuffling will help: the structure has to change first, and only a pawn can change it.\n\nA break is a pawn advance that touches the enemy structure and asks a question — capture, advance, or allow the exchange. Each answer creates something: an open file, a passed pawn, a weak square. That is the point. The skill is choosing a break that opens lines for pieces you have already placed well, and timing it for when you are ready rather than when it first becomes possible.",
    whatToLookFor:
      "Which of your pawns can advance to make contact with an enemy pawn? What line does it open, and is a piece of yours already aiming down it?",
    successNote: (san) =>
      `Correct — ${san}. The pawn makes contact with the enemy structure and forces it to resolve. Stockfish agrees this is the move.`,
    failure:
      "Not this move. Look for the pawn advance that makes contact with an enemy pawn and forces the structure to change.",
    prompt: "The position is locked. Find the pawn advance that breaks it open.",
    quiz: {
      question: "Why does a blocked position usually require a pawn break rather than piece play?",
      options: [
        "Because only a pawn advance can change the structure that limits where pieces can go",
        "Because pawns are worth less, so they can be risked",
        "Because pieces cannot move in blocked positions",
      ],
      correctIndex: 0,
    },
    takeaway:
      "When nothing is happening, stop moving pieces and ask which pawn break changes the structure in your favour.",
  },
  "piece-activity": {
    order: 4,
    title: "Piece Activity",
    concept: "A piece's value is not what it is — it is what it does.",
    intro:
      "A bishop that sees three squares and a bishop that sees eleven are not the same piece, whatever the material count says. Activity, not material, is what most positions turn on.",
    explanation:
      "Counting material is easy, which is why it is over-relied on. What decides most games is how much each piece actually controls — how many useful squares it reaches, and whether those squares matter. A rook on a closed file is close to a spectator; the same rook on an open file can dominate.\n\nSo when a position has no forcing move, the productive question is not 'what can I win?' but 'which of my pieces is doing least, and where would it do more?' That question converts an aimless position into a concrete plan, and it is available every single move.",
    whatToLookFor:
      "Count what each of your pieces actually controls. The one seeing fewest useful squares is the one to move.",
    successNote: (san) =>
      `Correct — ${san}. That piece now controls markedly more of the board, and Stockfish rates it among the best moves here.`,
    failure:
      "Not this one. Look for the piece with the least scope, and find it a square where it sees more.",
    prompt: "No tactics here. Find the move that most increases a piece's reach.",
    quiz: {
      question: "In a quiet position with no tactics, what is the most productive question to ask?",
      options: [
        "Which of my pieces is doing least, and where would it do more?",
        "Which piece can I trade off fastest?",
        "Which pawn can I push furthest?",
      ],
      correctIndex: 0,
    },
    takeaway:
      "In a quiet position, improve your least active piece. It is the plan that is always available.",
  },
  "worst-piece": {
    order: 5,
    title: "Improve Your Worst Piece",
    concept: "The most reliable plan in chess, available in almost every position.",
    intro:
      "Strong players have a default move for positions with nothing forcing in them: find the worst-placed piece and improve it. It is not glamorous, and it wins an enormous number of games.",
    explanation:
      "The reason it works is that it is always available. Attacks require a target; combinations require a weakness. But there is always a piece doing less than the others, and moving it costs nothing while making every future plan easier to execute.\n\nIt also protects you from the real danger in quiet positions, which is drifting — making moves that neither improve your position nor commit to anything, until the opponent has quietly improved everything and you are worse without ever having blundered. Ask the question every move and drifting becomes impossible.",
    whatToLookFor:
      "Identify your least active piece first. Only then ask where it belongs.",
    successNote: (san) =>
      `Correct — ${san}. That was the least active piece on the board, and it now has real scope. The engine rates this among the best moves.`,
    failure:
      "Not quite. Find the piece with the fewest available squares first, then ask where it would do more.",
    prompt: "One piece is doing far less than the others. Improve it.",
    quiz: {
      question: "Why is 'improve your worst piece' such a reliable plan?",
      options: [
        "It is available in every position, even when there is no target to attack",
        "It always wins material within a few moves",
        "It forces the opponent to respond",
      ],
      correctIndex: 0,
    },
    takeaway:
      "When you do not know what to do, improve your worst piece. It is never a wasted move.",
  },
};

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

const MIN_ENTRIES = 3; // 1 example + at least 2 exercises
const usable = Object.entries(PROSE)
  .filter(([k]) => (data[k]?.length ?? 0) >= MIN_ENTRIES)
  .sort((a, b) => a[1].order - b[1].order);

const skipped = Object.keys(PROSE).filter((k) => (data[k]?.length ?? 0) < MIN_ENTRIES);

const out = [];
out.push(`import type { CourseLesson } from "@/lib/academy/courseTypes";

/**
 * The Strategy course — how to think when there is no tactic.
 *
 * GENERATED by scripts/emit-strategy-lessons.js. Edit the prose there, not here.
 *
 * SERVER ONLY. Reached through lib/academy/courses.server.ts and served one
 * lesson at a time by /api/academy/lesson, so none of this reaches the browser.
 *
 * Every position was found by scripts/build-strategy.js, which searches real
 * positions for ones where STOCKFISH'S OWN top move is an instance of the idea
 * the lesson teaches. The answer to each exercise is therefore the engine's
 * move, not an author's opinion — which matters more here than in tactics,
 * where correctness is decidable outright.
 */
export const STRATEGY_LESSONS: CourseLesson[] = [`);

let order = 1;
for (const [key, p] of usable) {
  const entries = data[key];
  const example = entries[0];
  const exercises = entries.slice(1, 4);

  out.push(`  {
    id: "${key}",
    order: ${order++},
    title: "${esc(p.title)}",
    concept: "${esc(p.concept)}",
    intro: "${esc(p.intro)}",
    explanation: "${esc(p.explanation)}",
    whatToLookFor: "${esc(p.whatToLookFor)}",
    examples: [
      {
        fen: "${example.fen}",
        caption: "${esc(`${example.sideToMove === "w" ? "White" : "Black"} to play. The move is ${example.san}.`)}",
      },
    ],
    exercises: [`);

  for (const e of exercises) {
    out.push(`      {
        fen: "${e.fen}",
        sideToMove: "${e.sideToMove}",
        prompt: "${esc(p.prompt)}",
        solutionFrom: "${e.from}",
        solutionTo: "${e.to}",
        successMessage: "${esc(p.successNote(e.san))}",
        failureMessage: "${esc(p.failure)}",
      },`);
  }

  out.push(`    ],
    quiz: {
      question: "${esc(p.quiz.question)}",
      options: [${p.quiz.options.map((o) => `"${esc(o)}"`).join(", ")}],
      correctIndex: ${p.quiz.correctIndex},
    },
    takeaway: "${esc(p.takeaway)}",
  },`);
}

out.push(`];
`);

if (!usable.length) {
  console.error("no lesson had enough verified positions — nothing written");
  process.exit(1);
}

fs.writeFileSync(path.join(process.cwd(), "content", "strategyLessons.ts"), out.join("\n"), "utf8");
console.error(
  `wrote content/strategyLessons.ts: ${usable.length} lessons, ` +
    `${usable.reduce((n, [k]) => n + Math.min(3, data[k].length - 1), 0)} exercises`
);
if (skipped.length) {
  console.error(`skipped (too few verified positions): ${skipped.join(", ")}`);
}
