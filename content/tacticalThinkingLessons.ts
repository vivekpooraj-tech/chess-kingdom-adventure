import type { CourseLesson } from "@/lib/academy/courseTypes";

/**
 * TACTICAL THINKING — the "how do I think?" course.
 *
 * SERVER ONLY. Reached through lib/academy/courses.server.ts and served one
 * lesson at a time by /api/academy/lesson, so none of this reaches the browser.
 *
 * This is deliberately NOT another pattern course. Chess Mind already teaches
 * pattern recognition (Chess Mind > Pattern Recognition) and named motifs
 * (Academy > Tactics). What neither teaches is the SEARCH — the habit of
 * scanning a position in a fixed order instead of playing the first move that
 * looks reasonable. That habit is Checks, Captures, Threats, and then the
 * question almost every beginner skips: "what does my opponent do back?"
 *
 * POSITIONS ARE NOT HAND-WRITTEN. Every FEN and solution here was selected by
 * scripts/build-tactical-thinking.js from data/puzzles/tactics-library.json —
 * 5,000 positions already validated move-by-move with chess.js — and then
 * re-checked against the specific claim of its lesson: lesson 1's moves really
 * are checks, lesson 2's really are captures, lesson 3's really are quiet moves
 * that create a threat (and specifically NOT deflection sacrifices, which an
 * earlier draft of the selector happily returned and which would have taught
 * the opposite of the lesson), and lesson 4's are forcing so the reply really
 * is predictable. Re-run that script to reselect.
 */
export const TACTICAL_THINKING_LESSONS: CourseLesson[] = [
  {
    id: "forcing-moves",
    order: 1,
    title: "Forcing Moves",
    concept: "Checks, captures and threats — the moves your opponent cannot ignore.",
    intro:
      "Strong players do not look at every move. They look at the moves the opponent is not allowed to ignore, and they look at those first.",
    explanation:
      "A forcing move limits what your opponent can do next. A check is the most forcing move there is: they must get out of it, so instead of twenty possible replies they might have two. A capture is next — taking material usually demands an answer. A threat comes third: it does not force a reply this instant, but ignoring it costs something.\n\nThis matters because chess is hard mostly because there are too many possibilities. Forcing moves cut the tree down to a size you can actually calculate.",
    whatToLookFor:
      "Before anything else, ask: do I have a check? Every check, even the ones that look silly. Most will be bad — but you have to see them before you can reject them.",
    examples: [
      {
        fen: "1R6/6pk/5p1p/2N5/6PK/r6P/8/8 b - - 2 40",
        caption:
          "Black to move. There is a check here, and it is the start of a forced mate. Finding it means looking at checks first, not at what looks safe.",
      },
    ],
    exercises: [
      {
        fen: "1R6/6pk/5p1p/2N5/6PK/r6P/8/8 b - - 2 40",
        sideToMove: "b",
        prompt: "Black to move. Find the check.",
        solutionFrom: "g7",
        solutionTo: "g5",
        successMessage: "g5+ — a pawn check. The king must react, and that is what makes it work.",
        failureMessage: "Not this one. Scan for every move that gives check, including pawn moves.",
        line: "g5+ Kh5 Rxh3#",
      },
      {
        fen: "3k4/pp6/8/2p1RB2/5n2/P1PP4/1r5P/7K b - - 0 37",
        sideToMove: "b",
        prompt: "Black to move. Which check leads somewhere?",
        solutionFrom: "b2",
        solutionTo: "b1",
        successMessage: "Rb1+ — the check drags White's pieces where you want them.",
        failureMessage: "Look for a check along an open line.",
        line: "Rb1+ Re1 Rxe1#",
      },
      {
        fen: "3r3k/5rpp/5p2/3QP3/2P5/1q6/6P1/5RK1 w - - 0 28",
        sideToMove: "w",
        prompt: "White to move. A check that also takes something.",
        solutionFrom: "d5",
        solutionTo: "d8",
        successMessage: "Qxd8+ — a check and a capture at once. The most forcing kind of move.",
        failureMessage: "Try a move that gives check and wins material on the same square.",
        line: "Qxd8+ Rf8 Qxf8#",
      },
    ],
    quiz: {
      question: "You have three ideas and limited time. Which do you calculate FIRST?",
      options: [
        "The move that develops a piece",
        "Every check you can find",
        "The move that looks safest",
        "A pawn move to gain space",
      ],
      correctIndex: 1,
    },
    takeaway:
      "Checks first. They force a reply, which means fewer things to calculate — and sometimes the game just ends.",
  },
  {
    id: "captures",
    order: 2,
    title: "Every Capture, Even the Odd Ones",
    concept: "Look at all the captures before choosing — including the ones that look wrong.",
    intro:
      "The second scan is captures. Not the good captures — ALL of them. You cannot judge a capture you never noticed.",
    explanation:
      "Beginners look at captures that obviously win material and skip the rest. But a capture that looks like a losing trade is often the start of the tactic: you give something up to drag a defender away, open a line, or expose a king.\n\nThe rule is not 'take everything'. The rule is 'see everything, then decide'. Rejecting a capture on purpose is a real decision. Never noticing it is not.",
    whatToLookFor:
      "List every piece you can capture right now. For each one, ask what your opponent must do about it — not whether the trade looks even.",
    examples: [
      {
        fen: "8/5N2/3p3R/3k4/4p3/2r4P/3rn1PK/6R1 w - - 2 48",
        caption:
          "White to move. The winning idea starts with a capture that also gives check — forcing and material-winning at the same time.",
      },
    ],
    exercises: [
      {
        fen: "8/5N2/3p3R/3k4/4p3/2r4P/3rn1PK/6R1 w - - 2 48",
        sideToMove: "w",
        prompt: "White to move. Find the capture that comes with check.",
        solutionFrom: "h6",
        solutionTo: "d6",
        successMessage: "Rxd6+ — takes a pawn AND checks, so Black has no time to save the rook on d2.",
        failureMessage: "Look for a capture that also attacks the king.",
        line: "Rxd6+ Kc5 Rxd2",
      },
      {
        fen: "6r1/p1P2k2/8/3PBp1q/4p3/1P6/P5Q1/6K1 w - - 1 37",
        sideToMove: "w",
        prompt: "White to move. A capture most players would reject on sight.",
        solutionFrom: "g2",
        solutionTo: "g8",
        successMessage:
          "Qxg8+ — giving the queen for a rook looks awful, until you see the pawn promoting straight after.",
        failureMessage:
          "Consider the capture you would normally dismiss as losing material, then look one move further.",
        line: "Qxg8+ Kxg8 c8=Q+",
      },
      {
        fen: "2q2k2/5pp1/6p1/2b4r/4QP2/7P/3B2P1/4R2K b - - 2 36",
        sideToMove: "b",
        prompt: "Black to move. Which capture opens the king up?",
        solutionFrom: "h5",
        solutionTo: "h3",
        successMessage: "Rxh3+ — the rook is offered to tear open the pawn cover, and the queen finishes.",
        failureMessage: "Look at every capture near the enemy king, including ones that hang a piece.",
        line: "Rxh3+ gxh3 Qxh3#",
      },
    ],
    quiz: {
      question: "Why look at a capture that seems to lose material?",
      options: [
        "Because trades are always good",
        "Because it might drag a defender away or open a line",
        "Because the computer likes captures",
        "Because you should always take material when offered",
      ],
      correctIndex: 1,
    },
    takeaway:
      "See every capture, then decide. A capture you rejected on purpose is fine. A capture you never saw is a missed game.",
  },
  {
    id: "threats",
    order: 3,
    title: "Quiet Moves That Threaten",
    concept: "The move that does not capture or check, but that they still cannot ignore.",
    intro:
      "Checks and captures are loud. Threats are quiet — and they are often the strongest move on the board.",
    explanation:
      "A threat is a move that does nothing right now but promises something next move. It might attack two pieces, set up a capture, or take away the only square a piece has.\n\nQuiet moves are the hardest to find because nothing happens when you play them. That is exactly why they win games: your opponent is scanning for checks and captures too, and a quiet threat slips underneath that scan.",
    whatToLookFor:
      "After checks and captures come up empty, ask a different question: which of their pieces is undefended, trapped, or overloaded — and can I aim at it?",
    examples: [
      {
        fen: "8/p2b3p/3Pp1k1/1pq2pp1/2r5/3R2P1/PP1QKPBP/8 b - - 11 34",
        caption:
          "Black to move. Rc2 captures nothing and gives no check — it simply plants the rook where White cannot allow it.",
      },
    ],
    exercises: [
      {
        fen: "8/p2b3p/3Pp1k1/1pq2pp1/2r5/3R2P1/PP1QKPBP/8 b - - 11 34",
        sideToMove: "b",
        prompt: "Black to move. A quiet move — no capture, no check — that they cannot ignore.",
        solutionFrom: "c4",
        solutionTo: "c2",
        successMessage: "Rc2 — nothing is taken, but the pressure on the pinned queen decides the game.",
        failureMessage: "Stop looking for captures and checks. Which square would hurt them most?",
        line: "Rc2 Kd1 Rxd2+",
      },
      {
        fen: "2bk1b1r/p1p2pp1/3n3p/3Q4/5B2/6Pq/PPP2P1P/RN2K2R b KQ - 3 14",
        sideToMove: "b",
        prompt: "Black to move. Develop a piece and create a threat at the same time.",
        solutionFrom: "c8",
        solutionTo: "b7",
        successMessage: "Bb7 — a quiet developing move that suddenly aims at the undefended rook.",
        failureMessage: "Which of your sleeping pieces could point at something of theirs?",
        line: "Bb7 Qb3 Bxh1",
      },
      {
        fen: "r5k1/2pq2pp/p2ppb2/1p6/4PP2/2P5/PP1B2QP/R6K w - - 1 23",
        sideToMove: "w",
        prompt: "White to move. A pawn move that makes a threat.",
        solutionFrom: "e4",
        solutionTo: "e5",
        successMessage: "e5 — the pawn attacks the bishop and cracks the position open behind it.",
        failureMessage: "Even a pawn push can be a threat. Which one attacks something?",
        line: "e5 Rf8 exf6",
      },
    ],
    quiz: {
      question: "What makes a quiet move hard to spot?",
      options: [
        "It is always a pawn move",
        "Nothing is captured, so there is no obvious signal",
        "It is illegal in most positions",
        "Only computers can find them",
      ],
      correctIndex: 1,
    },
    takeaway:
      "When checks and captures come up empty, look for the quiet move that makes a threat. Your opponent is scanning for noise.",
  },
  {
    id: "their-reply",
    order: 4,
    title: "What Will They Do Back?",
    concept: "Before you move, work out their best answer.",
    intro:
      "This is the habit that separates a player who calculates from one who hopes. One question, every single move.",
    explanation:
      "Most blunders are not calculation failures. They are moves played without asking what the opponent gets to do next.\n\nAfter you pick a move, do not play it yet. Ask: what is their best reply? If the answer is 'they take my piece for free' or 'they check me and I lose the rook', you have just saved yourself a game. Forcing moves make this easier — after a check, they usually only have one or two legal answers, so you can actually see the whole thing.",
    whatToLookFor:
      "Play the move in your head. Then look at the position from their side and find THEIR checks, captures and threats. Same scan, other colour.",
    examples: [
      {
        fen: "8/4Rp2/6pp/8/3k1KP1/8/8/3r4 w - - 2 49",
        caption:
          "After Rd7+ the black king has almost no legal answers — which is exactly why the whole line can be calculated to the end before you play it.",
      },
    ],
    exercises: [
      {
        fen: "8/4Rp2/6pp/8/3k1KP1/8/8/3r4 w - - 2 49",
        sideToMove: "w",
        prompt: "White to move. Check first — then see what they are forced to play.",
        solutionFrom: "e7",
        solutionTo: "d7",
        successMessage: "Rd7+ — the king must step aside, and the rook on d1 falls next move.",
        failureMessage: "Find the check that also lines the rook up against something else.",
        line: "Rd7+ Kc4 Rxd1",
      },
      {
        fen: "5k2/4n1p1/R1p4p/2P5/4P3/8/1r3P1P/4K1R1 b - - 0 30",
        sideToMove: "b",
        prompt: "Black to move. Which check leaves them only one square?",
        solutionFrom: "b2",
        solutionTo: "b1",
        successMessage: "Rb1+ — the king is pushed to e2 and the rook on g1 is lost.",
        failureMessage: "Look for the check that attacks a second piece at the same time.",
        line: "Rb1+ Ke2 Rxg1",
      },
      {
        fen: "8/7p/6p1/5b2/BR3K2/7r/PP1k4/8 b - - 2 48",
        sideToMove: "b",
        prompt: "Black to move. Force the king somewhere useless.",
        solutionFrom: "h3",
        solutionTo: "h4",
        successMessage: "Rh4+ — the king is driven away and the bishop on b4 is picked up.",
        failureMessage: "Which check also puts your rook on the same line as another piece?",
        line: "Rh4+ Kg5 Rxb4",
      },
    ],
    quiz: {
      question: "You have found a move you like. What do you do before playing it?",
      options: [
        "Play it quickly before you lose confidence",
        "Find their best reply and check you are still happy",
        "Count the material on the board",
        "Look for a different move",
      ],
      correctIndex: 1,
    },
    takeaway:
      "Checks, captures, threats — then their reply. That order, every move, is what tactical thinking actually is.",
  },
];
