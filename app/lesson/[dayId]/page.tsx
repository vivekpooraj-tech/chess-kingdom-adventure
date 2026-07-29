"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getLesson } from "@/content/lessons";
import { BUDDIES } from "@/content/buddies";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BuddyAvatar } from "@/components/buddy/BuddyAvatar";
import { BuddyChat } from "@/components/buddy/BuddyChat";
import { ChessBoard } from "@/components/board/ChessBoard";
import { DragToTarget } from "@/components/minigames/engines/DragToTarget";
import { ConfettiBurst } from "@/components/rewards/ConfettiBurst";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateChild, markLessonComplete } from "@/lib/supabase/queries";

export default function LessonPage() {
  const params = useParams<{ dayId: string }>();
  const router = useRouter();
  const lesson = getLesson(Number(params.dayId));

  const [stepIndex, setStepIndex] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [buddy, setBuddy] = useState(BUDDIES[0]);

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
      const child = await getOrCreateChild(supabase, user.id);
      setChildId(child.id);
      const matchedBuddy = BUDDIES.find((b) => b.id === child.buddy_id);
      if (matchedBuddy) setBuddy(matchedBuddy);
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
          className="w-full max-w-lg flex flex-col items-center gap-6"
        >
          {step.type === "story" && (
            <StoryStep title={lesson.title} storyBeat={lesson.storyBeat} buddy={buddy} onNext={next} />
          )}

          {step.type === "minigame" && (
            <PawnRaceMiniGame onComplete={next} />
          )}

          {step.type === "puzzle" && <PuzzleStep onNext={next} />}

          {step.type === "ai_chat" && (
            <BuddyChat
              buddyEmoji={buddy.emoji}
              buddyName={buddy.name}
              greeting={buddy.greeting || "Great job so far! Got any questions for me?"}
              onDone={next}
            />
          )}

          {step.type === "mini_match" && <MiniMatchStep onNext={next} />}

          {step.type === "reward" && (
            <RewardStep crystal={lesson.crystal} onFinish={finishLesson} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
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

function PawnRaceMiniGame({ onComplete }: { onComplete: () => void }) {
  // A DragToTarget config teaching "pawns move straight forward" — this is
  // the "Pawn Race" mini-game variant, built on the shared engine.
  return (
    <DragToTarget
      prompt="Tap the square where the Pawn Guard should march next!"
      pieceGlyph="♙"
      rows={1}
      cols={4}
      start={{ row: 0, col: 0 }}
      grid={[
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: true },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
      ]}
      onComplete={(success) => success && onComplete()}
    />
  );
}

function PuzzleStep({ onNext }: { onNext: () => void }) {
  const [solved, setSolved] = useState(false);

  return (
    <Card className="flex flex-col items-center gap-5">
      <h2 className="font-display text-xl text-kingdom-night text-center">
        Guard the Path — move any Pawn Guard forward!
      </h2>
      <ChessBoard
        fen="4k3/8/8/8/8/8/PPPPPPPP/4K3 w - - 0 1"
        playableColor="w"
        autoRespond
        size={360}
        onMove={() => setSolved(true)}
      />
      {solved && (
        <p className="font-display text-lg text-kingdom-forest">Wonderful! The path is guarded!</p>
      )}
      <Button disabled={!solved} onClick={onNext}>
        Continue →
      </Button>
    </Card>
  );
}

function MiniMatchStep({ onNext }: { onNext: () => void }) {
  const [moveCount, setMoveCount] = useState(0);
  const matchLength = 3; // short "duel" for Day 1 — full bot opponent wired in Phase 1

  return (
    <Card className="flex flex-col items-center gap-5">
      <h2 className="font-display text-xl text-kingdom-night text-center">First Pawn Duel!</h2>
      <p className="font-body text-kingdom-night/70 text-center">
        Make {matchLength} good pawn moves to win this mini match.
      </p>
      <ChessBoard
        fen="4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1"
        playableColor="w"
        autoRespond
        size={360}
        onMove={() => setMoveCount((c) => c + 1)}
      />
      <p className="font-body text-kingdom-night/60">
        {Math.min(moveCount, matchLength)}/{matchLength} moves
      </p>
      <Button disabled={moveCount < matchLength} onClick={onNext}>
        Finish the Duel →
      </Button>
    </Card>
  );
}

function RewardStep({ crystal, onFinish }: { crystal: string; onFinish: () => void }) {
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
      <h2 className="font-display text-2xl text-kingdom-night capitalize">
        {crystal} Crystal Recovered!
      </h2>
      <p className="font-body text-kingdom-night/70">
        You woke up the Pawn Village! +50 coins, +1 Castle Brick
      </p>
      <Button onClick={onFinish}>Back to the Kingdom Map →</Button>
    </Card>
  );
}
