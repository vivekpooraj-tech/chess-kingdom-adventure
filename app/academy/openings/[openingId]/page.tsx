"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { getOpening } from "@/content/openings";
import { ChessBoard } from "@/components/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  markOpeningStudied,
  recordOpeningPracticeAttempt,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { useArenaBoardSize } from "@/lib/hooks/useArenaBoardSize";

/** FEN after each ply, 0 = starting position, computed once client-side by
 * replaying the opening's own (already chess.js-verified) move list — the
 * same engine ChessBoard itself uses, not a second implementation. */
function computeStepFens(moves: string[]): string[] {
  const game = new Chess();
  const fens = [game.fen()];
  for (const san of moves) {
    game.move(san);
    fens.push(game.fen());
  }
  return fens;
}

function movePairs(moves: string[]): [string, string | undefined][] {
  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push([moves[i], moves[i + 1]]);
  return pairs;
}

type Mode = "study" | "practice" | "quiz";

export default function OpeningDetailPage() {
  const params = useParams<{ openingId: string }>();
  const router = useRouter();
  const opening = getOpening(params.openingId);

  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("study");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const studiedRef = useRef(false);

  const fens = useMemo(() => (opening ? computeStepFens(opening.moves) : []), [opening]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (!resolution.child) return;
      setChildId(resolution.child.id);
      setBoardSkinId(resolution.child.board_skin_id);
      setPieceSetId(resolution.child.piece_set_id);

      if (opening && !studiedRef.current) {
        studiedRef.current = true;
        markOpeningStudied(supabase, resolution.child.id, opening.id).catch(() => {});
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, params.openingId]);

  // Autoplay stepping through the line.
  useEffect(() => {
    if (!playing || !opening) return;
    if (step >= opening.moves.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep((s) => s + 1), 1000);
    return () => clearTimeout(timer);
  }, [playing, step, opening]);

  if (!opening) {
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <p className="font-classic-body text-premium-ivory/60">This opening isn't in the database yet.</p>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start flex-wrap">
              <h1 className="font-classic-display text-2xl sm:text-3xl text-premium-ivory">
                {opening.name}
              </h1>
              {opening.isGambit && (
                <span className="font-classic-body text-[10px] font-semibold text-red-300 border border-red-400/30 rounded-full px-2 py-0.5">
                  GAMBIT
                </span>
              )}
            </div>
            {opening.alternativeName && (
              <p className="font-classic-body text-sm text-premium-ivory/40 italic mt-0.5">
                also known as the {opening.alternativeName}
              </p>
            )}
            <div className="flex items-center gap-3 justify-center lg:justify-start mt-2">
              <span className="font-classic-body text-xs text-premium-gold">{opening.ecoCode}</span>
              <span className="font-classic-body text-xs text-premium-ivory/40 capitalize">
                {opening.difficulty}
              </span>
            </div>
          </div>

          {/* Board + info: stacked on mobile, side-by-side from lg up */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-full lg:w-auto lg:flex-none flex flex-col items-center gap-4">
              {mode === "study" && (
                <>
                  <ChessBoard
                    key={`study-${opening.id}`}
                    fen={fens[step]}
                    size={360}
                    readOnly
                    boardSkinId={boardSkinId}
                    pieceSetId={pieceSetId}
                  />
                  <p className="font-classic-body text-sm text-premium-ivory/70 min-h-[20px]">
                    {step === 0
                      ? "Starting position"
                      : movePairs(opening.moves.slice(0, step))
                          .map(([w, b], i) => `${i + 1}.${w}${b ? ` ${b}` : ""}`)
                          .join(" ")}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPlaying(false);
                        setStep(0);
                      }}
                      className="font-classic-body text-xs border border-white/15 text-premium-ivory/70 rounded-full px-3 py-1.5"
                    >
                      ⟲ Reset
                    </button>
                    <button
                      onClick={() => {
                        setPlaying(false);
                        setStep((s) => Math.max(0, s - 1));
                      }}
                      disabled={step === 0}
                      className="font-classic-body text-xs border border-white/15 text-premium-ivory/70 rounded-full px-3 py-1.5 disabled:opacity-30"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPlaying((p) => !p)}
                      className="font-classic-body text-xs border border-premium-gold/40 text-premium-gold rounded-full px-4 py-1.5"
                    >
                      {playing ? "⏸ Pause" : "▶ Play"}
                    </button>
                    <button
                      onClick={() => {
                        setPlaying(false);
                        setStep((s) => Math.min(opening.moves.length, s + 1));
                      }}
                      disabled={step === opening.moves.length}
                      className="font-classic-body text-xs border border-white/15 text-premium-ivory/70 rounded-full px-3 py-1.5 disabled:opacity-30"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              {mode === "practice" && childId && (
                <PracticePanel
                  opening={opening}
                  childId={childId}
                  boardSkinId={boardSkinId}
                  pieceSetId={pieceSetId}
                  onExit={() => setMode("study")}
                />
              )}

              {mode === "quiz" && (
                <MemoryQuiz opening={opening} onDone={() => setMode("study")} />
              )}
            </div>

            {/* Explanation + actions */}
            <div className="flex-1 w-full flex flex-col gap-4">
              {mode === "study" && (
                <>
                  <Section title="What is this opening?">
                    <p className="font-classic-body text-sm text-premium-ivory/70 leading-relaxed">
                      {opening.description}
                    </p>
                  </Section>
                  <Section title="Key Ideas">
                    <ul className="flex flex-col gap-1.5">
                      {opening.keyIdeas.map((idea, i) => (
                        <li key={i} className="font-classic-body text-sm text-premium-ivory/70 flex gap-2">
                          <span className="text-premium-gold flex-none">•</span>
                          {idea}
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <Section title="Common Plans">
                    <p className="font-classic-body text-sm text-premium-ivory/70">
                      <span className="text-premium-gold font-semibold">White: </span>
                      {opening.commonPlans.white}
                    </p>
                    <p className="font-classic-body text-sm text-premium-ivory/70 mt-2">
                      <span className="text-red-300 font-semibold">Black: </span>
                      {opening.commonPlans.black}
                    </p>
                  </Section>
                  <Section title="Common Mistakes">
                    <ul className="flex flex-col gap-1.5">
                      {opening.commonMistakes.map((mistake, i) => (
                        <li key={i} className="font-classic-body text-sm text-premium-ivory/70 flex gap-2">
                          <span className="text-premium-gold flex-none">•</span>
                          {mistake}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <div className="flex flex-wrap gap-3 mt-2">
                    <Button tone="premium" onClick={() => setMode("practice")}>Practice this Opening →</Button>
                    <Button tone="premium" variant="ghost" onClick={() => setMode("quiz")}>
                      Test your memory
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/academy/openings"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to Opening Explorer
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4">
      <p className="font-classic-display text-sm text-premium-ivory mb-2">{title}</p>
      {children}
    </div>
  );
}

/**
 * A real game against the existing Stockfish opponent (no second engine),
 * starting from the standard position — the child's actual moves are
 * compared against the opening's line move-by-move. Deviating is never
 * treated as a mistake; the game just continues normally.
 */
function PracticePanel({
  opening,
  childId,
  boardSkinId,
  pieceSetId,
  onExit,
}: {
  opening: ReturnType<typeof getOpening>;
  childId: string;
  boardSkinId?: string;
  pieceSetId?: string;
  onExit: () => void;
}) {
  const [gameKey] = useState(() => Math.random());
  const [history, setHistory] = useState<string[]>([]);
  const [recorded, setRecorded] = useState(false);
  // Practice mode is real gameplay (a full game against Stockfish, tracked
  // via recordOpeningPracticeAttempt) embedded inside the Opening detail
  // page rather than a dedicated route — reserves room for that page's own
  // header/description/back-link chrome, which stays visible around it.
  const arenaBoardSize = useArenaBoardSize(260);
  if (!opening) return null;

  const matchedSoFar = history.every((san, i) => san === opening.moves[i]);
  const stillInBook = matchedSoFar && history.length <= opening.moves.length;
  const completedLine = matchedSoFar && history.length >= opening.moves.length;

  function handleGameOver() {
    if (recorded) return;
    setRecorded(true);
    recordOpeningPracticeAttempt(createClient(), childId, opening!.id, completedLine).catch(() => {});
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <ChessBoard
        key={gameKey}
        playableColor="w"
        opponent="stockfish"
        difficulty="easy"
        size={arenaBoardSize}
        arenaMode
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
        onPositionChange={(pos) => setHistory(pos.history)}
        onGameOver={handleGameOver}
      />
      <p
        className={`font-classic-body text-sm text-center min-h-[20px] ${
          stillInBook ? "text-premium-gold" : "text-premium-ivory/60"
        }`}
      >
        {history.length === 0
          ? `Play the ${opening.name} — starting position.`
          : completedLine
          ? `You completed the full ${opening.name} line! Keep playing.`
          : stillInBook
          ? `Great! You're following the ${opening.name}.`
          : "You've left the main line — that's OK, keep playing!"}
      </p>
      <Button
        tone="premium"
        variant="ghost"
        onClick={() => {
          if (!recorded) {
            setRecorded(true);
            recordOpeningPracticeAttempt(createClient(), childId, opening.id, completedLine).catch(() => {});
          }
          onExit();
        }}
      >
        Finish Practice
      </Button>
    </div>
  );
}

/**
 * The optional Chess Mind connection — same "show, hide, ask" idea as the
 * rest of Chess Mind, applied to this opening's own moves rather than a
 * new engine. Multiple choice, no fabricated scoring beyond right/wrong.
 */
function MemoryQuiz({ opening, onDone }: { opening: ReturnType<typeof getOpening>; onDone: () => void }) {
  const [revealed, setRevealed] = useState(true);
  const [answered, setAnswered] = useState<string | null>(null);
  if (!opening) return null;

  const questionMoveIndex = Math.min(2, opening.moves.length - 1); // "third move" when available
  const correctAnswer = opening.moves[questionMoveIndex];
  const distractors = ["Nf3", "e4", "d4", "Nc3", "Bc4", "c4"].filter((m) => m !== correctAnswer).slice(0, 3);
  const choices = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);

  return (
    <div className="flex flex-col items-center gap-4 rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 w-full max-w-[360px]">
      <p className="font-classic-display text-base text-premium-ivory text-center">Test your memory</p>
      {revealed ? (
        <>
          <p className="font-classic-body text-sm text-premium-ivory/60 text-center">
            {opening.moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m} ` : `${m} `)).join("")}
          </p>
          <Button tone="premium" onClick={() => setRevealed(false)}>Hide & Quiz Me →</Button>
        </>
      ) : (
        <>
          <p className="font-classic-body text-sm text-premium-ivory text-center">
            What was move {questionMoveIndex + 1} ({questionMoveIndex % 2 === 0 ? "White" : "Black"})?
          </p>
          <div className="grid grid-cols-2 gap-2 w-full">
            {choices.map((c) => {
              const isCorrect = answered !== null && c === correctAnswer;
              const isWrong = answered === c && c !== correctAnswer;
              return (
                <button
                  key={c}
                  disabled={answered !== null}
                  onClick={() => setAnswered(c)}
                  className={`font-classic-display rounded-premiumBtn py-2 border ${
                    isCorrect
                      ? "border-premium-gold bg-premium-gold/15 text-premium-gold"
                      : isWrong
                      ? "border-red-400/40 bg-red-400/10 text-red-300"
                      : "border-white/15 text-premium-ivory/80"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {answered && (
            <p className="font-classic-body text-xs text-premium-ivory/60">
              {answered === correctAnswer ? "Exactly right! 🧠" : `It was ${correctAnswer}.`}
            </p>
          )}
        </>
      )}
      <Button tone="premium" variant="ghost" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
