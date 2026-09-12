"use client";

import { useEffect, useMemo, useState } from "react";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { moveMatches, canonicalSan } from "@/lib/school/v2/moves";
import { drillOutcome } from "@/lib/school/v2/progress";
import {
  PASS_AND_PLAY_LINES,
  gameEndLine,
  gameGoalLine,
  gameProgressLine,
  illegalLine,
  missLine,
  perseveranceLine,
  solvedLine,
} from "@/lib/school/v2/ollieLines";
import { Chess } from "chess.js";
import type {
  BotMatchStep,
  CeremonyStep,
  ExamStep,
  GuidedBoardStep,
  PassAndPlayStep,
  PuzzleDrillStep,
  RecapStep,
  SchoolPuzzle,
  TeachStep,
} from "@/content/school/types";
import { MilestoneCard, OllieCoach } from "./Coach";

/**
 * The step components. One per SchoolStepType except parent_mode, which has
 * its own file because it is the one that coaches two people.
 *
 * Every component here takes the step's content and an `onComplete`, and
 * nothing else. They do not know which session they are in, do not talk to
 * the database, and do not call a model. The runner owns progression; these
 * own one interaction each. That separation is what makes a session a plain
 * list in content/school/sessions.ts instead of a hand-written page.
 */

// The board asks for this much and clamps itself to the viewport (width on a
// phone, 75vh anywhere). 520 lets a tablet use its space instead of showing a
// phone-sized board in the middle of a wide column; a 411px phone still gets
// the same 395px board it always did.
export const BOARD = 520;

interface StepProps<T> {
  step: T;
  ollie: { intro: string; mistake: string; success: string };
  onComplete: () => void;
}

// ─────────────────────────────────────────── teach ───────────────────────────
export function TeachStepView({ step, ollie, onComplete }: StepProps<TeachStep>) {
  const [lineIndex, setLineIndex] = useState(0);
  const last = lineIndex >= step.lines.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <OllieCoach line={ollie.intro} />

      {step.fen ? (
        <div className="flex justify-center">
          <ChessBoard fen={step.fen} readOnly size={BOARD} />
        </div>
      ) : null}

      <div className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5">
        <p className={`${TEXT.subheading}`}>{step.title}</p>
        <p className={`${TEXT.body} mt-3 text-premium-ivory/90`}>{step.lines[lineIndex]}</p>
        <p className={`${TEXT.caption} mt-4`}>
          {lineIndex + 1} of {step.lines.length}
        </p>
      </div>

      <Button
        tone="premium"
        block
        onClick={() => (last ? onComplete() : setLineIndex((i) => i + 1))}
      >
        {last ? "Got it — let's try" : "Next"}
      </Button>
    </div>
  );
}

// ──────────────────────────────────── guided board ───────────────────────────
/**
 * The hint ladder is the core teaching mechanic, and it is deliberately slow.
 *
 * Wrong move one: Ollie's gentle line and the FIRST hint. Wrong move two: the
 * second. Only on the third miss does the ladder name the actual move. A child
 * who gets it right on attempt two learned something; a child who was handed
 * the answer on attempt one learned to wait for the answer.
 */
export function GuidedBoardStepView({ step, ollie, onComplete }: StepProps<GuidedBoardStep>) {
  const [attempts, setAttempts] = useState(0);
  const [illegal, setIllegal] = useState(0);
  const [solved, setSolved] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  // Set the moment the solving move itself delivers checkmate (ChessBoard's
  // onMove reports isCheckmate directly -- nothing here decides this, chess.js
  // does). Any future guided_board whose solution happens to mate gets this
  // automatically; it is not wired to session 18 specifically.
  const [mateAfterFen, setMateAfterFen] = useState<string | null>(null);
  const [matePhase, setMatePhase] = useState<"before" | "after">("before");
  const [mateRevealed, setMateRevealed] = useState(false);
  const [replayToken, setReplayToken] = useState(0);

  // The replay itself: show the position BEFORE the mating move, then a beat
  // later swap to the position after it and reveal the word. "Watch it again"
  // just re-runs this same two-step sequence from the top.
  useEffect(() => {
    if (!mateAfterFen) return;
    setMatePhase("before");
    setMateRevealed(false);
    const toAfter = setTimeout(() => setMatePhase("after"), 700);
    const reveal = setTimeout(() => setMateRevealed(true), 1550);
    return () => {
      clearTimeout(toAfter);
      clearTimeout(reveal);
    };
  }, [mateAfterFen, replayToken]);

  // Miss one shows hint one; miss two shows hint two; only the third miss
  // reaches the rung that names the move. A voluntary hint before any
  // attempt is always the gentlest one.
  const hintIndex = Math.max(0, Math.min(attempts - 1, step.hintLadder.length - 1));
  // The coach line answers "what should I do now?" at every moment: the goal
  // before any tap, the content's own correction after the first miss (it
  // names what the wrong move missed), a rotating nudge after that, a gentle
  // line after an illegal tap, and on success a line that recognises HOW it
  // was solved, not just that it was.
  const coachLine = solved
    ? perseveranceLine(attempts)
    : illegal > 0 && attempts === 0
    ? illegalLine(illegal - 1)
    : attempts === 0
    ? step.goal
    : attempts === 1
    ? step.onWrong
    : missLine(attempts - 1);

  const handleMove = ({ san, isCheckmate }: { san: string; isCheckmate: boolean }) => {
    if (solved) return;
    setIllegal(0);
    if (moveMatches(step.fen, san, step.acceptMoves)) {
      setSolved(true);
      if (isCheckmate) {
        const g = new Chess(step.fen);
        g.move(san);
        setMateAfterFen(g.fen());
      }
      return;
    }
    setAttempts((a) => a + 1);
    setHintShown(true);
    // Reset the position so the child tries again from the same spot, rather
    // than from wherever their wrong move left it.
    setTimeout(() => setBoardKey((k) => k + 1), 650);
  };

  // The mate-delivering move, told to a child who cannot yet read "Qa8#": the
  // King genuinely has none of the three outs Escape from Check taught
  // (session 17) -- this wording is definitionally true of every checkmate, so
  // it is safe to say every time isCheckmate fires, not just this once.
  if (mateAfterFen) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <ChessBoard
            key={`mate-${matePhase}`}
            fen={matePhase === "before" ? step.fen : mateAfterFen}
            readOnly
            size={BOARD}
          />
        </div>
        <div
          className={`rounded-premiumCard border border-premium-gold/40 bg-gradient-to-b from-premium-gold/15 to-transparent p-6 text-center transition-all duration-500 ${
            mateRevealed ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <h2 className="font-classic-display text-3xl tracking-wide text-premium-gold">CHECKMATE</h2>
          <p className={`${TEXT.body} mt-3 text-premium-ivory/90`}>
            The King cannot move -- every square is covered. Cannot block. Cannot capture the attacker.
          </p>
          <p className={`${TEXT.body} mt-1 text-premium-ivory/90`}>You found the ending. That&rsquo;s how games are won.</p>
        </div>
        {mateRevealed ? (
          <>
            <button
              type="button"
              onClick={() => setReplayToken((k) => k + 1)}
              className={`${TEXT.caption} self-center underline underline-offset-2 hover:text-premium-gold`}
            >
              How did I do that? Watch it again
            </button>
            <Button tone="premium" block onClick={onComplete}>
              Continue
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OllieCoach line={coachLine} tone={solved ? "proud" : attempts > 0 ? "warm" : "calm"} />

      <div className="flex justify-center">
        <ChessBoard
          key={boardKey}
          fen={step.fen}
          playableColor="w"
          onMove={handleMove}
          onIllegalAttempt={() => {
            if (!solved) setIllegal((n) => n + 1);
          }}
          size={BOARD}
        />
      </div>

      {!solved && (hintShown || attempts > 0) ? (
        <div className="rounded-2xl border border-premium-gold/25 bg-premium-gold/[0.06] px-4 py-3">
          <p className={`${TEXT.meta} text-premium-gold`}>HINT {hintIndex + 1}</p>
          <p className={`${TEXT.body} mt-1 text-premium-ivory/85`}>{step.hintLadder[hintIndex]}</p>
        </div>
      ) : null}

      {!solved && attempts === 0 ? (
        <button
          type="button"
          onClick={() => setHintShown(true)}
          className={`${TEXT.caption} self-center underline underline-offset-2 hover:text-premium-gold`}
        >
          I&rsquo;d like a hint
        </button>
      ) : null}

      {solved ? (
        <Button tone="premium" block onClick={onComplete}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

// ───────────────────────────────── puzzle drill / exam ───────────────────────
/**
 * Two or three puzzles, a pass bar, and a way back.
 *
 * On a miss the child is NOT locked out. They see the idea again in one
 * sentence (`remedialTeach`), solve one easier position, and continue. The
 * remedial position is not a test — it is the lesson, smaller. This is the
 * whole "mastery gate" in practice: understanding is checked, and a child who
 * did not get it is taught again rather than stopped.
 */
export function DrillStepView({
  step,
  ollie,
  onComplete,
}: StepProps<PuzzleDrillStep | ExamStep>) {
  const { drill } = step;
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<"intro" | "puzzles" | "remedial-teach" | "remedial" | "done">(
    step.type === "exam" ? "intro" : "puzzles"
  );
  const [passed, setPassed] = useState(false);

  const puzzles = drill.puzzles;

  const finishPuzzles = (finalCorrect: number) => {
    const outcome = drillOutcome(finalCorrect, drill.passRequired);
    if (outcome === "passed") {
      setPassed(true);
      setPhase("done");
    } else {
      setPhase("remedial-teach");
    }
  };

  if (phase === "intro" && step.type === "exam") {
    return (
      <div className="flex flex-col gap-5">
        <OllieCoach line={step.intro} />
        <Button tone="premium" block onClick={() => setPhase("puzzles")}>
          Start
        </Button>
      </div>
    );
  }

  if (phase === "remedial-teach") {
    return (
      <div className="flex flex-col gap-5">
        <OllieCoach line={ollie.mistake} tone="warm" />
        <div className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5">
          <p className={`${TEXT.meta} text-premium-gold`}>ONE MORE TIME, SMALLER</p>
          <p className={`${TEXT.body} mt-2 text-premium-ivory/90`}>{drill.remedialTeach}</p>
        </div>
        <Button tone="premium" block onClick={() => setPhase("remedial")}>
          Try an easier one
        </Button>
      </div>
    );
  }

  if (phase === "remedial") {
    return (
      <SinglePuzzle
        puzzle={drill.remedial}
        label="Easier one"
        ollie={ollie}
        onResult={() => {
          // Right or wrong, the child continues. They were taught again; that
          // was the point. Nothing in this course says "you may not go on".
          setPhase("done");
        }}
      />
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-5">
        <OllieCoach
          line={passed ? ollie.success : "You've seen it twice now. That's how it sticks. Let's keep going."}
          tone="proud"
        />
        <div className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5 text-center">
          <p className={`${TEXT.subheading}`}>
            {correct} of {puzzles.length} first time
          </p>
          <p className={`${TEXT.caption} mt-1`}>
            {passed ? "Passed." : "Practised again, and ready to move on."}
          </p>
        </div>
        <Button tone="premium" block onClick={onComplete}>
          Continue
        </Button>
      </div>
    );
  }

  const puzzle = puzzles[index];
  return (
    <SinglePuzzle
      key={puzzle.id}
      puzzle={puzzle}
      label={`Puzzle ${index + 1} of ${puzzles.length}`}
      ollie={ollie}
      solvedSoFar={correct}
      onResult={(wasCorrect) => {
        const nextCorrect = correct + (wasCorrect ? 1 : 0);
        setCorrect(nextCorrect);
        if (index + 1 < puzzles.length) setIndex(index + 1);
        else finishPuzzles(nextCorrect);
      }}
    />
  );
}

/**
 * One puzzle. Two attempts: the first miss shows the hint; the second miss
 * shows the answer, plays it, and counts as wrong. A child never leaves a
 * puzzle without having seen the right move — that is what makes it teaching.
 */
function SinglePuzzle({
  puzzle,
  label,
  ollie,
  solvedSoFar = 0,
  onResult,
}: {
  puzzle: SchoolPuzzle;
  label: string;
  ollie: { mistake: string; success: string };
  solvedSoFar?: number;
  onResult: (correct: boolean) => void;
}) {
  const [attempts, setAttempts] = useState(0);
  const [illegal, setIllegal] = useState(0);
  const [state, setState] = useState<"playing" | "correct" | "revealed">("playing");
  const [boardKey, setBoardKey] = useState(0);

  // When the answer is revealed the child must SEE it, not read a move name
  // they cannot yet parse. The position after the solution is shown on the
  // board, read-only, so "it was Ra8#" has a picture next to it.
  const revealedFen = useMemo(() => {
    const san = canonicalSan(puzzle.fen, puzzle.solutionMoves[0]);
    if (!san) return puzzle.fen;
    try {
      const g = new Chess(puzzle.fen);
      g.move(san);
      return g.fen();
    } catch {
      return puzzle.fen;
    }
  }, [puzzle.fen, puzzle.solutionMoves]);

  const handleMove = ({ san }: { san: string }) => {
    if (state !== "playing") return;
    setIllegal(0);
    if (moveMatches(puzzle.fen, san, puzzle.solutionMoves)) {
      setState("correct");
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    if (next >= 2) {
      setState("revealed");
      return;
    }
    setTimeout(() => setBoardKey((k) => k + 1), 650);
  };

  const solutionSan = canonicalSan(puzzle.fen, puzzle.solutionMoves[0]) ?? puzzle.solutionMoves[0];
  const coach =
    state === "correct"
      ? puzzle.successLine ?? solvedLine(solvedSoFar)
      : state === "revealed"
      ? `${missLine(3)} It was ${solutionSan} — it's on the board now. That's the idea to remember.`
      : illegal > 0 && attempts === 0
      ? illegalLine(illegal - 1)
      : attempts === 0
      ? puzzle.prompt
      : puzzle.hint ?? ollie.mistake;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className={`${TEXT.meta}`}>{label}</p>
        {state === "playing" && attempts > 0 ? (
          <p className={`${TEXT.meta} text-amber-200/80`}>ONE MORE TRY</p>
        ) : null}
      </div>
      <OllieCoach
        line={coach}
        tone={state === "correct" ? "proud" : attempts > 0 || state === "revealed" ? "warm" : "calm"}
      />
      <div className="flex justify-center">
        <ChessBoard
          key={`${boardKey}-${state}`}
          fen={state === "revealed" ? revealedFen : puzzle.fen}
          playableColor="w"
          onMove={handleMove}
          onIllegalAttempt={() => {
            if (state === "playing") setIllegal((n) => n + 1);
          }}
          readOnly={state !== "playing"}
          size={BOARD}
        />
      </div>
      {state !== "playing" ? (
        <Button tone="premium" block onClick={() => onResult(state === "correct")}>
          {state === "correct" ? "Next" : "Okay, next one"}
        </Button>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────── bot match ──────────────────────────────
/**
 * A game against the gentlest engine the board offers.
 *
 * The pass condition is a COUNT OF THE CHILD'S OWN MOVES, not a result. This
 * is the confidence ladder, not a ranking: the point of session 8 is that the
 * child played a game, and the point of session 24 is that they played one
 * without help. Winning is celebrated when it happens and never required.
 *
 * When `hintsAllowed` is false there is no hint button in the DOM at all —
 * not a disabled one. Session 24 promises "no hints", and a greyed-out button
 * is a hint that hints exist.
 */
export function BotMatchStepView({ step, ollie, onComplete }: StepProps<BotMatchStep>) {
  const [moves, setMoves] = useState(0);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [over, setOver] = useState<{ winner: "w" | "b" | null; isCheckmate: boolean } | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  // The board (and the engine it loads) does not mount until the child taps
  // through the prelude -- so the cinematic "get ready" moment costs nothing
  // on a Motorola, it is not competing with Stockfish for the CPU.
  const [ready, setReady] = useState(!step.prelude);
  const reached = moves >= step.movesRequired;

  if (!ready && step.prelude) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="flex gap-2 text-3xl" aria-hidden="true">
          <span>♟️</span>
          <span>♞</span>
          <span>♝</span>
          <span>♜</span>
          <span>♛</span>
          <span>♚</span>
        </div>
        <h2 className="font-classic-display text-2xl text-premium-ivory">{step.prelude.headline}</h2>
        <div className="space-y-2">
          {step.prelude.lines.map((l) => (
            <p key={l} className={`${TEXT.body} text-premium-ivory/80`}>
              {l}
            </p>
          ))}
        </div>
        <Button tone="premium" block size="lg" onClick={() => setReady(true)}>
          {step.prelude.cta}
        </Button>
      </div>
    );
  }

  const line = over
    ? gameEndLine(over.winner === "w" ? "win" : over.winner === "b" ? "loss" : "draw", step.hintsAllowed)
    : reached
    ? gameGoalLine(step.hintsAllowed)
    : moves === 0
    ? ollie.intro
    : gameProgressLine(moves, step.movesRequired);

  return (
    <div className="flex flex-col gap-4">
      <OllieCoach line={line} tone={over?.winner === "w" || reached ? "proud" : "calm"} />

      <div className="flex justify-center">
        <ChessBoard
          fen={step.fen}
          playableColor="w"
          opponent="stockfish"
          difficulty="easy"
          size={BOARD}
          onMove={() => setMoves((m) => m + 1)}
          onPositionChange={({ turn: t }) => setTurn(t)}
          onGameOver={(r) => setOver({ winner: r.winner, isCheckmate: r.isCheckmate })}
        />
      </div>

      {/* Whose turn it is, always visible. A six-year-old waiting for a move
          that is theirs to make is the most common way a game "gets stuck". */}
      {!over ? (
        <p
          className={`rounded-full px-3 py-1 text-center font-classic-body text-sm ${
            turn === "w" ? "bg-premium-ivory text-premium-midnight" : "bg-white/10 text-premium-ivory/60"
          }`}
          aria-live="polite"
        >
          {turn === "w" ? "Your move" : "Opponent is thinking…"}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className={`${TEXT.caption}`}>
          Your moves: {Math.min(moves, step.movesRequired)} / {step.movesRequired}
        </p>
        {step.hintsAllowed && !over ? (
          <button
            type="button"
            onClick={() => setHintOpen((o) => !o)}
            className={`${TEXT.caption} underline underline-offset-2 hover:text-premium-gold`}
          >
            {hintOpen ? "Hide hint" : "Hint"}
          </button>
        ) : null}
      </div>

      {step.hintsAllowed && hintOpen && !over ? (
        <div className="rounded-2xl border border-premium-gold/25 bg-premium-gold/[0.06] px-4 py-3">
          <p className={`${TEXT.body} text-premium-ivory/85`}>{genericGameHint(moves)}</p>
        </div>
      ) : null}

      {reached || over ? (
        <Button tone="premium" block onClick={onComplete}>
          {over ? "Continue" : "That's enough — continue"}
        </Button>
      ) : null}
    </div>
  );
}

/** Deterministic, no model: the three opening rules, then the one habit. */
function genericGameHint(moves: number): string {
  if (moves < 2) return "Start by moving a pawn in the middle two squares forward.";
  if (moves < 5) return "Bring out a Knight or a Bishop before touching your Queen.";
  if (moves < 8) return "Is your King still in the middle? If you can castle, castle.";
  return "Before every move: can anything of theirs be taken for free? Can anything of yours?";
}

// ─────────────────────────────────── pass and play ───────────────────────────
/**
 * Two humans, one device, no engine, no network, no chat.
 *
 * The board is not restricted to one colour, so whoever holds the phone moves
 * for the side to play. There is nothing to win here from the app's point of
 * view — the child gets credit for playing a person, which is the rung of the
 * confidence ladder this step exists for.
 */
export function PassAndPlayStepView({ step, ollie, onComplete }: StepProps<PassAndPlayStep>) {
  // Same prelude gate as bot_match: nothing about the board mounts until the
  // child taps through, so the "get ready" framing (Graduation Duel: "NO
  // HINTS. NO RESCUES. JUST CHESS.") costs nothing extra.
  const [ready, setReady] = useState(!step.prelude);
  const [plies, setPlies] = useState(0);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [inCheck, setInCheck] = useState(false);
  const [over, setOver] = useState<{ winner: "w" | "b" | null; isCheckmate: boolean; isDraw: boolean } | null>(
    null
  );

  if (!ready && step.prelude) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <h2 className="font-classic-display text-2xl text-premium-ivory">{step.prelude.headline}</h2>
        <div className="space-y-2">
          {step.prelude.lines.map((l) => (
            <p key={l} className={`${TEXT.body} text-premium-ivory/80`}>
              {l}
            </p>
          ))}
        </div>
        <Button tone="premium" block size="lg" onClick={() => setReady(true)}>
          {step.prelude.cta}
        </Button>
      </div>
    );
  }

  // House convention, same one Parent Mode uses (child = White, grown-up =
  // Black): on a shared device there is no way to ask "which human are you"
  // without a whole extra step, so the learner running Chess School is always
  // White here. The prelude says so out loud when it matters (Graduation).
  const resultHeadline = over
    ? over.winner
      ? `${over.winner === "w" ? "WHITE" : "BLACK"} WINS${over.isCheckmate ? " BY CHECKMATE" : ""}`
      : "DRAW"
    : null;

  const resultLine = over
    ? step.resultLines
      ? over.winner === "w"
        ? step.resultLines.win
        : over.winner === "b"
        ? step.resultLines.loss
        : step.resultLines.draw
      : over.winner
      ? `${over.winner === "w" ? "White" : "Black"} wins. Shake hands.`
      : "The game ends in a draw — nobody could force a win. Shake hands."
    : null;

  return (
    <div className="flex flex-col gap-4">
      <OllieCoach
        line={plies === 0 ? step.intro : resultLine ?? (plies < 4 ? PASS_AND_PLAY_LINES.start : PASS_AND_PLAY_LINES.playing)}
        tone={over ? "proud" : "calm"}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span
          className={`rounded-full px-3 py-1 font-classic-body text-sm ${
            turn === "w" ? "bg-premium-ivory text-premium-midnight" : "bg-white/10 text-premium-ivory/60"
          }`}
        >
          White to move
        </span>
        <span
          className={`rounded-full px-3 py-1 font-classic-body text-sm ${
            turn === "b" ? "bg-premium-ivory text-premium-midnight" : "bg-white/10 text-premium-ivory/60"
          }`}
        >
          Black to move
        </span>
        {/* A real, live signal from chess.js — not decoration. A child staring
            at a board that suddenly matters more deserves to know why. */}
        {inCheck && !over ? (
          <span
            className="rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 font-classic-body text-sm text-red-200"
            aria-live="polite"
          >
            CHECK!
          </span>
        ) : null}
      </div>

      <div className="flex justify-center">
        <ChessBoard
          size={BOARD}
          onPositionChange={({ history, turn: t, isCheck }) => {
            setPlies(history.length);
            setTurn(t);
            setInCheck(isCheck);
          }}
          onGameOver={(r) => setOver({ winner: r.winner, isCheckmate: r.isCheckmate, isDraw: r.isDraw })}
        />
      </div>

      {/* The proper result screen Part 2 asks for — WHITE WINS / BLACK WINS /
          DRAW — separate from the emotional line above, which never blocks on
          who won: the Continue button below fires the same way regardless. */}
      {resultHeadline ? (
        <div className="rounded-premiumCard border border-premium-gold/30 bg-premium-gold/[0.06] p-4 text-center">
          <p className="font-classic-display text-xl tracking-wide text-premium-gold">{resultHeadline}</p>
        </div>
      ) : (
        <p className={`${TEXT.caption} text-center`}>
          Pass the phone after every move. Nobody else can see this game.
        </p>
      )}

      {plies >= 6 || over ? (
        <Button tone="premium" block onClick={onComplete}>
          {over ? "Continue" : "We're done — continue"}
        </Button>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────── ceremony ────────────────────────────────
export function CeremonyStepView({ step, childName, onComplete }: {
  step: CeremonyStep;
  childName?: string;
  onComplete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  // Epic ceremonies stage themselves: headline, then the lines, then the
  // unlock card, each a beat apart — the "contrast" the product brief asks
  // for, reserved for the five WOW moments and their share-card unlocks.
  // Every other ceremony (a superpower reveal, "your first move") keeps the
  // exact single fade-in it always had — `stage` simply never advances past 0
  // for those, so nothing about them changes.
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setRevealed(true), 350));
    if (step.epic) {
      timers.push(setTimeout(() => setStage(1), 350));
      timers.push(setTimeout(() => setStage(2), 950));
      timers.push(setTimeout(() => setStage(3), 1550));
    } else {
      setStage(3);
    }
    return () => timers.forEach(clearTimeout);
  }, [step.epic]);

  const linesShown = !step.epic || stage >= 2;
  const unlockShown = !step.epic || stage >= 3;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`rounded-premiumCard border p-7 text-center transition-all duration-700 ${
          step.epic
            ? "border-premium-gold/50 bg-gradient-to-b from-premium-gold/20 to-transparent shadow-premiumGlow"
            : "border-premium-gold/35 bg-gradient-to-b from-premium-gold/15 to-transparent"
        } ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
      >
        <p className={`${TEXT.meta} text-premium-gold`}>{step.title}</p>
        <h2
          className={`mt-2 font-classic-display tracking-wide text-premium-ivory transition-all duration-500 ${
            step.epic ? "text-4xl" : "text-3xl"
          }`}
        >
          {step.headline}
        </h2>
        <div
          className={`mt-4 space-y-2 transition-opacity duration-500 ${
            linesShown ? "opacity-100" : "opacity-0"
          }`}
        >
          {step.lines.map((l) => (
            <p key={l} className={`${TEXT.body} text-premium-ivory/85`}>
              {l}
            </p>
          ))}
        </div>
      </div>

      {step.unlock ? (
        <div
          className={`transition-all duration-500 ${
            unlockShown ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <MilestoneCard unlock={step.unlock} childName={childName} staged={step.epic} />
        </div>
      ) : null}

      {!step.epic || unlockShown || !step.unlock ? (
        <Button tone="premium" block onClick={onComplete}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────── recap ────────────────────────────────
export function RecapStepView({ step, onComplete, isLast }: {
  step: RecapStep;
  onComplete: () => void;
  isLast: boolean;
}) {
  // The Graduation Day montage: one line at a time as a full-width title
  // card, tap to advance — the "journey through what you learned" the brief
  // asks for, built from the exact same `learned` strings every other recap
  // shows as an instant checklist. A child always knows what to do next (tap
  // Next), which is the one rule that matters more than the effect.
  const [montageIndex, setMontageIndex] = useState(0);
  if (step.montage && step.learned.length > 0) {
    const last = montageIndex >= step.learned.length - 1;
    return (
      <div className="flex flex-col gap-5">
        <div
          key={montageIndex}
          className="rounded-premiumCard border border-premium-gold/30 bg-gradient-to-b from-premium-gold/10 to-transparent p-8 text-center transition-opacity duration-500"
        >
          {/* "THE PAWN — you learned to grow" renders as a title over a
              description when the content uses that shape; a plain sentence
              (any non-Graduation montage) just shows as-is -- the split is
              cosmetic, not a second content field. */}
          {(() => {
            const line = step.learned[montageIndex];
            const splitAt = line.indexOf(" — ");
            if (splitAt < 0) {
              return <p className={`${TEXT.body} text-premium-ivory/90`}>{line}</p>;
            }
            return (
              <>
                <p className="font-classic-display text-2xl tracking-wide text-premium-gold">
                  {line.slice(0, splitAt)}
                </p>
                <p className={`${TEXT.body} mt-2 text-premium-ivory/90`}>{line.slice(splitAt + 3)}</p>
              </>
            );
          })()}
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {step.learned.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i <= montageIndex ? "bg-premium-gold" : "bg-white/15"}`}
            />
          ))}
        </div>
        <Button
          tone="premium"
          block
          onClick={() => (last ? onComplete() : setMontageIndex((i) => i + 1))}
        >
          {last ? (isLast ? "Finish session" : "Continue") : "Next"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-premiumCard border border-white/10 bg-white/[0.04] p-5">
        <p className={`${TEXT.meta} text-premium-gold`}>WHAT YOU CAN DO NOW</p>
        <ul className="mt-3 space-y-2">
          {step.learned.map((l) => (
            <li key={l} className={`${TEXT.body} flex gap-2 text-premium-ivory/90`}>
              <span aria-hidden="true" className="text-premium-gold">
                ✓
              </span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>
      <OllieCoach line={step.nextTeaser} />
      <Button tone="premium" block onClick={onComplete}>
        {isLast ? "Finish session" : "Continue"}
      </Button>
    </div>
  );
}
