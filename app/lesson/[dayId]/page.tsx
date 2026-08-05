"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import type { PieceSymbol } from "chess.js";
import { getLesson, FREE_DAY_LIMIT } from "@/content/lessons";
import { getMinigameConfigForDay } from "@/content/minigame-configs";
import { BUDDIES } from "@/content/buddies";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BuddyAvatar } from "@/components/buddy/BuddyAvatar";
import { BuddyChat } from "@/components/buddy/BuddyChat";
import { ChessBoard } from "@/components/board/ChessBoard";
import { DragToTarget } from "@/components/minigames/engines/DragToTarget";
import { MemoryFlip } from "@/components/minigames/engines/MemoryFlip";
import { TimedReaction } from "@/components/minigames/engines/TimedReaction";
import { ConfettiBurst } from "@/components/rewards/ConfettiBurst";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  markLessonComplete,
  recordPuzzleAttempt,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";

export default function LessonPage() {
  const params = useParams<{ dayId: string }>();
  const router = useRouter();
  const lesson = getLesson(Number(params.dayId));

  const [stepIndex, setStepIndex] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [buddy, setBuddy] = useState(BUDDIES[0]);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);

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
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setChildId(child.id);
      setBoardSkinId(child.board_skin_id);
      setPieceSetId(child.piece_set_id);
      const matchedBuddy = BUDDIES.find((b) => b.id === child.buddy_id);
      if (matchedBuddy) setBuddy(matchedBuddy);

      // Defense in depth: the Kingdom Map already hides/redirects premium
      // days for free accounts, but someone could still type a lesson URL
      // directly (e.g. /lesson/4) — check again here before showing content.
      const dayNumber = Number(params.dayId);
      if (dayNumber > FREE_DAY_LIMIT) {
        const { data: parent } = await supabase
          .from("parents")
          .select("premium_status")
          .eq("auth_user_id", user.id)
          .single();
        if (parent?.premium_status !== "premium") {
          router.push("/kingdom-map");
          return;
        }
      }
    }
    load();
  }, [router]);

  if (!lesson) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-display text-xl">This part of the Kingdom is still being built!</p>
      </main>
    );
  }

  if (!childId) {
    // Still loading the child profile / premium check from the effect above.
    return <main className="min-h-screen" />;
  }

  const step = lesson.steps[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, lesson.steps.length - 1));

  async function finishLesson() {
    if (childId && lesson) {
      const supabase = createClient();
      await markLessonComplete(supabase, childId, lesson.dayNumber);
    }
    router.push("/kingdom-map");
  }

  return (
    <ScreenTimeGate childId={childId}>
      <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-10">
        {/* Progress dots */}
        <div className="flex gap-2">
          {lesson.steps.map((s, i) => (
            <div
              key={s.id}
              className={`w-3 h-3 rounded-full ${
                i <= stepIndex ? "bg-kingdom-gold" : "bg-kingdom-night/15"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            // Board-containing steps get a wider column — max-w-lg (the
            // default, good for reading text) was silently capping the
            // board's own `size` prop well below what was actually asked
            // for, since ChessBoard's width maxes out at 100% of this
            // parent.
            className={clsx(
              "w-full flex flex-col items-center gap-6",
              step.type === "puzzle" || step.type === "mini_match" ? "max-w-4xl" : "max-w-lg"
            )}
          >
            {step.type === "story" && (
              <StoryStep title={lesson.title} storyBeat={lesson.storyBeat} buddy={buddy} onNext={next} />
            )}

            {step.type === "minigame" && (
              <MinigameStep dayNumber={lesson.dayNumber} onComplete={next} />
            )}

            {step.type === "puzzle" && (
              <PuzzleStep
                fen={lesson.puzzle.fen}
                prompt={lesson.puzzle.prompt}
                acceptedPieceTypes={lesson.puzzle.acceptedPieceTypes}
                dayNumber={lesson.dayNumber}
                childId={childId}
                boardSkinId={boardSkinId}
                pieceSetId={pieceSetId}
                onNext={next}
              />
            )}

            {step.type === "ai_chat" && (
              <BuddyChat
                buddyEmoji={buddy.emoji}
                buddyName={buddy.name}
                greeting={buddy.greeting || "Great job so far! Got any questions for me?"}
                onDone={next}
              />
            )}

            {step.type === "mini_match" && (
              <MiniMatchStep
                fen={lesson.miniMatch.fen}
                prompt={lesson.miniMatch.prompt}
                movesRequired={lesson.miniMatch.movesRequired}
                boardSkinId={boardSkinId}
                pieceSetId={pieceSetId}
                onNext={next}
              />
            )}

            {step.type === "reward" && (
              <RewardStep title={step.title} onFinish={finishLesson} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </ScreenTimeGate>
  );
}

function StoryStep({
  title,
  storyBeat,
  buddy,
  onNext,
}: {
  title: string;
  storyBeat: string;
  buddy: (typeof BUDDIES)[number];
  onNext: () => void;
}) {
  return (
    <Card className="flex flex-col items-center gap-5 text-center">
      <BuddyAvatar emoji={buddy.emoji} size="lg" />
      <h2 className="font-display text-2xl text-kingdom-night">{title}</h2>
      <p className="font-body text-lg text-kingdom-night/80">{storyBeat}</p>
      <Button onClick={onNext}>Let's go! →</Button>
    </Card>
  );
}

/**
 * Looks up the day's minigame config (content/minigame-configs.ts) and
 * renders whichever engine that day uses — DragToTarget, MemoryFlip, or
 * TimedReaction — with that day's specific content.
 */
function MinigameStep({ dayNumber, onComplete }: { dayNumber: number; onComplete: () => void }) {
  const config = getMinigameConfigForDay(dayNumber);

  if (!config) {
    return (
      <Card className="flex flex-col items-center gap-4">
        <p className="font-display text-lg">This mini-game isn't ready yet!</p>
        <Button onClick={onComplete}>Skip for now →</Button>
      </Card>
    );
  }

  if (config.engine === "drag_to_target") {
    return (
      <DragToTarget
        prompt={config.content.prompt}
        pieceGlyph={config.content.pieceGlyph}
        rows={config.content.rows}
        cols={config.content.cols}
        start={config.content.start}
        grid={config.content.grid}
        onComplete={(success) => success && onComplete()}
      />
    );
  }

  if (config.engine === "memory_flip") {
    return (
      <MemoryFlip
        prompt={config.content.prompt}
        pairs={config.content.pairs}
        onComplete={() => onComplete()}
      />
    );
  }

  // timed_reaction
  return (
    <TimedReaction
      prompt={config.content.prompt}
      pieceGlyph={config.content.pieceGlyph}
      rows={config.content.rows}
      cols={config.content.cols}
      rounds={config.content.rounds}
      roundTimeMs={config.content.roundTimeMs}
      onComplete={() => onComplete()}
    />
  );
}

function PuzzleStep({
  fen,
  prompt,
  acceptedPieceTypes,
  dayNumber,
  childId,
  boardSkinId,
  pieceSetId,
  onNext,
}: {
  fen: string;
  prompt: string;
  acceptedPieceTypes: PieceSymbol[] | "any";
  dayNumber: number;
  childId: string;
  boardSkinId?: string;
  pieceSetId?: string;
  onNext: () => void;
}) {
  const [moved, setMoved] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [checkmated, setCheckmated] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [boardKey, setBoardKey] = useState(0);

  async function handleMove(piece: PieceSymbol) {
    const isCorrect = acceptedPieceTypes === "any" || acceptedPieceTypes.includes(piece);

    const supabase = createClient();
    await recordPuzzleAttempt(supabase, childId, dayNumber, isCorrect, attemptNumber).catch(
      () => {
        // Non-critical — don't block the child's puzzle flow if the stats
        // write fails (e.g. offline). They still see feedback either way,
        // and can still continue regardless.
      }
    );

    setMoved(true);
    setWasCorrect(isCorrect);
  }

  function tryAgain() {
    // Optional, child-initiated retry — never forced. Remounting is the
    // simplest way back to the original position since ChessBoard has no
    // "undo" API once a move has been made.
    setBoardKey((k) => k + 1);
    setAttemptNumber((n) => n + 1);
    setMoved(false);
    setCheckmated(false);
  }

  return (
    <Card className="flex flex-col items-center gap-5">
      <h2 className="font-display text-xl text-kingdom-night text-center">{prompt}</h2>
      <ChessBoard
        key={boardKey}
        fen={fen}
        playableColor="w"
        opponent="stockfish"
        size={760}
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
        onMove={(opts) => handleMove(opts.piece)}
        onGameOver={(result) => {
          if (result.isCheckmate && result.winner === "w") {
            setCheckmated(true);
          }
        }}
      />
      {checkmated && (
        <p className="font-display text-lg text-kingdom-gold">Checkmate! Incredible! 👑</p>
      )}
      {!checkmated && moved && wasCorrect && (
        <p className="font-display text-lg text-kingdom-forest">Wonderful! Well done!</p>
      )}
      {!checkmated && moved && !wasCorrect && (
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-lg text-kingdom-coral">
            Nice move! Next time, try moving the piece from today's lesson.
          </p>
          <Button variant="ghost" size="md" onClick={tryAgain}>
            Try Again
          </Button>
        </div>
      )}
      <Button disabled={!moved} onClick={onNext}>
        Continue →
      </Button>
    </Card>
  );
}

function MiniMatchStep({
  fen,
  prompt,
  movesRequired,
  boardSkinId,
  pieceSetId,
  onNext,
}: {
  fen: string;
  prompt: string;
  movesRequired: number;
  boardSkinId?: string;
  pieceSetId?: string;
  onNext: () => void;
}) {
  const [moveCount, setMoveCount] = useState(0);
  const [checkmated, setCheckmated] = useState(false);

  return (
    <Card className="flex flex-col items-center gap-5">
      <h2 className="font-display text-xl text-kingdom-night text-center">{prompt}</h2>
      <ChessBoard
        fen={fen}
        playableColor="w"
        opponent="stockfish"
        size={760}
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
        onMove={() => setMoveCount((c) => c + 1)}
        onGameOver={(result) => {
          if (result.isCheckmate && result.winner === "w") {
            setCheckmated(true);
          }
        }}
      />
      {checkmated ? (
        <p className="font-display text-lg text-kingdom-gold">Checkmate! Incredible! 👑</p>
      ) : (
        <p className="font-body text-kingdom-night/60">
          {Math.min(moveCount, movesRequired)}/{movesRequired} moves
        </p>
      )}
      <Button disabled={!checkmated && moveCount < movesRequired} onClick={onNext}>
        Finish the Duel →
      </Button>
    </Card>
  );
}

function RewardStep({ title, onFinish }: { title: string; onFinish: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-5 text-center relative overflow-hidden">
      <ConfettiBurst />
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="text-7xl"
      >
        💎
      </motion.div>
      <h2 className="font-display text-2xl text-kingdom-night capitalize">{title}</h2>
      <p className="font-body text-kingdom-night/70">
        Great work! +50 coins, +1 Castle Brick
      </p>
      <Button onClick={onFinish}>Back to the Kingdom Map →</Button>
    </Card>
  );
}
