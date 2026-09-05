/**
 * Generates content/endgameLessons.ts from verified position data.
 *
 *   node scripts/build-endgames.js > endgames.json
 *   node scripts/emit-endgame-lessons.js endgames.json
 *
 * The prose below is authored. The POSITIONS, the answers and the move lines
 * are not — they come from build-endgames.js, which selects from the endgame
 * positions in the verified 5,000-puzzle library. Generating the content file
 * rather than hand-copying eighteen FENs removes the transcription step, which
 * is exactly where wrong chess gets into a teaching product.
 *
 * Each lesson's success message may only assert what the selector actually
 * verified about its positions. Nothing here claims more than that.
 */
const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const PROSE = {
  "king-activity": {
    order: 1,
    title: "The King Joins In",
    concept: "In the endgame your king stops hiding and starts working.",
    intro:
      "For most of the game the king is a liability you tuck away. Once the queens and most pieces come off, that changes completely — the king becomes one of the strongest pieces on the board.",
    explanation:
      "A king in the centre of an empty board controls eight squares and can support pawns on either wing. The player whose king gets there first is usually the player who wins the pawn race, because their king defends its own pawns and attacks the opponent's at the same time.\n\nThe practical mistake is hesitation. Players who spent forty moves keeping the king safe keep doing it out of habit, shuffling it on the back rank while the opponent's king marches to the centre. By the time the danger is obvious, the race is already lost.",
    whatToLookFor:
      "No queens on the board and few pieces left? Ask where your king is heading before you move anything else.",
    successNote: (san) =>
      `Correct — ${san}. With the queens gone, the king is a fighting piece, and this one is heading somewhere useful.`,
    failure:
      "Not this time. Look for the king move: in this kind of position the king's journey matters more than any single pawn move.",
    prompt: "The queens are gone. Find the king move that brings your king into the game.",
    quiz: {
      question: "Why does king activity matter so much more in the endgame than in the middlegame?",
      options: [
        "Because with few pieces left there is little that can attack it, so its power is free to use",
        "Because the king moves faster once the board is emptier",
        "Because the rules change after move 40",
      ],
      correctIndex: 0,
    },
    takeaway:
      "When the queens come off, ask one question before anything else: where is my king going?",
  },
  "pawn-endgames": {
    order: 2,
    title: "King and Pawn Endings",
    concept: "Only kings and pawns — where every single tempo decides the result.",
    intro:
      "King and pawn endings are the foundation everything else rests on, because every other endgame can simplify into one. They are also unforgiving: there are no pieces left to rescue a mistake.",
    explanation:
      "With only kings and pawns, the position is nearly pure calculation. A single wasted move flips a win into a draw, because the outcome usually hinges on who runs out of useful moves first and who reaches a key square first.\n\nThis is where the idea of opposition lives: when the kings face each other with one square between them, the player who does NOT have to move is the one making progress. Rather than memorising that as a rule, notice what it really is — a counting problem about who is forced to give ground.",
    whatToLookFor:
      "Count. Which king reaches the critical squares first, and who is forced to move when neither side wants to?",
    successNote: (san) =>
      `Correct — ${san}. In an ending of only kings and pawns there is nothing to hide behind: this is the move that counts out.`,
    failure:
      "Not quite. With only kings and pawns, count the moves for each plan before choosing — the difference is usually a single tempo.",
    prompt: "Only kings and pawns remain. Find the move that keeps you on the right side of the count.",
    quiz: {
      question: "In a king and pawn ending, why is a single wasted move so often decisive?",
      options: [
        "Because the result usually turns on who runs out of useful moves first",
        "Because pawns move faster when there are no pieces",
        "Because a wasted move loses the right to castle",
      ],
      correctIndex: 0,
    },
    takeaway:
      "In king and pawn endings, calculate rather than guess. One tempo is usually the whole game.",
  },
  "passed-pawns": {
    order: 3,
    title: "Passed Pawns",
    concept: "A pawn with nothing in its way is a promotion threat that must be answered.",
    intro:
      "A passed pawn has no enemy pawn in front of it on its own file or either neighbouring file. Nothing but pieces can stop it — and pieces that are stopping a pawn are not doing anything else.",
    explanation:
      "That second point is the one most players miss. A passed pawn's value is not only that it might promote; it is that it ties down the defender. A rook sitting in front of a passer has been removed from the game as surely as if it were captured.\n\nSo passed pawns should be pushed when the push creates real problems, and created deliberately when your structure allows it. The further it advances, the more force is needed to hold it, and the more the rest of the board tilts your way.",
    whatToLookFor:
      "Check each of your pawns: is any file ahead of it clear of enemy pawns, including both neighbours? That pawn is your asset.",
    successNote: (san) =>
      `Correct — ${san}. No enemy pawn stands ahead of it on its file or either neighbour: that is a genuine passed pawn, and now it has to be dealt with.`,
    failure:
      "Not this one. Look for the pawn that has a clear path — no enemy pawn on its file or on either side of it.",
    prompt: "One of these pawns has a clear road ahead. Push it.",
    quiz: {
      question: "Beyond possibly promoting, what makes a passed pawn valuable?",
      options: [
        "It ties down enemy pieces, which then cannot do anything else",
        "It cannot be captured while it is passed",
        "It allows the king to castle a second time",
      ],
      correctIndex: 0,
    },
    takeaway:
      "A passed pawn is not just a future queen. It is a piece of the opponent's army taken out of circulation.",
  },
  promotion: {
    order: 4,
    title: "Promotion",
    concept: "The moment a pawn becomes a queen — and how to make sure it arrives.",
    intro:
      "Every pawn is a queen that has not arrived yet. Endgames are largely the argument about whether it gets there.",
    explanation:
      "Promotion decides most endgames, and it usually arrives with tempo: the new queen appears with a check, or attacks something, and the opponent never gets time to organise. That is why the last rank is worth calculating carefully rather than approximately.\n\nWatch for underpromotion too. Almost always a queen is right, but occasionally a knight promotes with check, or a rook avoids stalemate where a queen would not. The point is not to memorise the exceptions — it is to actually look at the position on the promotion square instead of assuming.",
    whatToLookFor:
      "When a pawn reaches the seventh rank, calculate the promotion to the end. What does the new piece do the moment it appears?",
    successNote: (san) =>
      `Correct — ${san}. The pawn finishes its journey, and it arrives with the initiative rather than as an afterthought.`,
    failure:
      "Not this move. There is a pawn one step from the last rank — work out what happens the moment it promotes.",
    prompt: "A pawn is one square from home. Finish the job.",
    quiz: {
      question: "Why is promotion so often decisive rather than merely useful?",
      options: [
        "Because the new piece usually arrives with tempo, leaving the opponent no time to reorganise",
        "Because promoting also removes an enemy piece",
        "Because a promoted queen cannot be captured",
      ],
      correctIndex: 0,
    },
    takeaway:
      "Calculate promotions to the very end. What matters is what the new piece does on the move it appears.",
  },
  "rook-endgames": {
    order: 5,
    title: "Rook Endings",
    concept: "The most common endgame in chess, and the one worth understanding first.",
    intro:
      "Rook endings appear more often than every other endgame combined. They are also drawish enough that knowing a few real ideas converts a lot of half points into whole ones.",
    explanation:
      "Rooks are long-range pieces that hate being passive. A rook tied to defending a pawn from in front of it is doing almost nothing; the same rook behind a passed pawn — either yours or the opponent's — is doing a great deal. That single principle explains a large share of rook endgame mistakes.\n\nActivity beats material here more than anywhere else on the board. Giving up a pawn to get your rook behind the enemy passer and your king into the game is frequently correct, and it is the trade most players refuse to make.",
    whatToLookFor:
      "Is your rook active or babysitting? Ask whether it could get behind a passed pawn or onto an open file instead.",
    successNote: (san) =>
      `Correct — ${san}. This is a pure rook and pawn ending, and the rook does its work by being active rather than defensive.`,
    failure:
      "Not this one. In rook endings, look first for the rook move that increases activity rather than the one that defends.",
    prompt: "Rooks and pawns only. Find the rook move.",
    quiz: {
      question: "What is the most common way to go wrong in a rook endgame?",
      options: [
        "Leaving the rook passive, tied to defending a pawn",
        "Trading rooks too early in every position",
        "Advancing the king before the rook has moved",
      ],
      correctIndex: 0,
    },
    takeaway:
      "An active rook is usually worth a pawn. Passive defence in a rook ending loses games that were drawn.",
  },
  converting: {
    order: 6,
    title: "Converting a Won Position",
    concept: "Being winning and actually winning are two different skills.",
    intro:
      "Getting an advantage is one skill. Finishing is another, and it is the one that decides results — a winning position thrown away costs the same full point as a losing one.",
    explanation:
      "The habit that converts is simple: when you are winning, prefer the clear line over the clever one. Forcing moves reduce your opponent's options, and every option you remove is a chance for something to go wrong that no longer exists. Trading pieces — not pawns — usually helps, because it strips away counterplay while leaving your material edge intact.\n\nThe most common way to lose a won game is to relax and start playing generally rather than concretely. Right at the point where the position is easiest, keep calculating.",
    whatToLookFor:
      "When you are clearly better, ask which move gives the opponent the fewest replies, not which looks most impressive.",
    successNote: (san, isForcing) =>
      isForcing
        ? `Correct — ${san}. A forcing move: the opponent's options shrink, and so do your chances of going wrong.`
        : `Correct — ${san}. The straightforward conversion — simplify the win rather than complicate it.`,
    failure:
      "Not this one. You are winning here: look for the move that most limits what your opponent can do.",
    prompt: "You are winning. Find the move that finishes cleanly.",
    quiz: {
      question: "When you have a winning position, which trade generally helps most?",
      options: [
        "Trading pieces but keeping pawns, which removes counterplay",
        "Trading pawns but keeping pieces, which opens lines",
        "Avoiding all trades to keep maximum force",
      ],
      correctIndex: 0,
    },
    takeaway:
      "When winning, choose the clearest path, not the prettiest. Fewer options for the opponent means fewer accidents for you.",
  },
};

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

const order = Object.entries(PROSE).sort((a, b) => a[1].order - b[1].order);
const out = [];

out.push(`import type { CourseLesson } from "@/lib/academy/courseTypes";

/**
 * The Endgames course — six lessons on the endings that actually decide games.
 *
 * GENERATED by scripts/emit-endgame-lessons.js. Edit the prose there, not here.
 *
 * SERVER ONLY. Reached through lib/academy/courses.server.ts and served one
 * lesson at a time by /api/academy/lesson, so none of this reaches the browser
 * bundle.
 *
 * Every position is selected by scripts/build-endgames.js from the endgame
 * positions in the verified 5,000-puzzle library, and every answer is that
 * position's own already-validated solution move. No FEN here was written by
 * hand. scripts/verify-course-lessons.js re-checks all of them.
 */
export const ENDGAME_LESSONS: CourseLesson[] = [`);

for (const [key, p] of order) {
  const entries = data[key];
  if (!entries || entries.length < 2) {
    throw new Error(`not enough verified positions for lesson "${key}"`);
  }
  const example = entries[0];
  const exercises = entries.slice(1);

  out.push(`  {
    id: "${key}",
    order: ${p.order},
    title: "${esc(p.title)}",
    concept: "${esc(p.concept)}",
    intro: "${esc(p.intro)}",
    explanation: "${esc(p.explanation)}",
    whatToLookFor: "${esc(p.whatToLookFor)}",
    examples: [
      {
        fen: "${example.fen}",
        caption: "${esc(`${example.sideToMove === "w" ? "White" : "Black"} to play. The move is ${example.san} — ${p.concept.charAt(0).toLowerCase()}${p.concept.slice(1).replace(/\.$/, "")}.`)}",
      },
    ],
    exercises: [`);

  for (const e of exercises) {
    const isForcing = e.san.includes("+") || e.san.includes("#");
    const note =
      p.successNote.length >= 2 ? p.successNote(e.san, isForcing) : p.successNote(e.san);
    out.push(`      {
        fen: "${e.fen}",
        sideToMove: "${e.sideToMove}",
        prompt: "${esc(p.prompt)}",
        solutionFrom: "${e.from}",
        solutionTo: "${e.to}",
        successMessage: "${esc(note)}",
        failureMessage: "${esc(p.failure)}",
        line: "${esc(e.solutionSan.join(" "))}",
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

const target = path.join(process.cwd(), "content", "endgameLessons.ts");
fs.writeFileSync(target, out.join("\n"), "utf8");
console.error(
  `wrote ${target}: ${order.length} lessons, ${order.reduce((n, [k]) => n + data[k].length - 1, 0)} exercises`
);
