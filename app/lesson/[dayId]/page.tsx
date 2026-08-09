"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { PieceSymbol } from "chess.js";
import { getLesson, FREE_DAY_LIMIT } from "@/content/lessons";
import { getMinigameConfigForDay } from "@/content/minigame-configs";
import { BUDDIES } from "@/content/buddies";
import { KINGDOM_ZONES, getZoneForDay, KingdomZone } from "@/content/kingdomZones";
import { getAchievement, AchievementDef } from "@/content/achievements";
import { getSkillTagLabel } from "@/lib/lessonLabels";
import { TEXT } from "@/lib/designSystem";
import { Button } from "@/components/ui/Button";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { BuddyAvatar } from "@/components/buddy/BuddyAvatar";
import { BuddyChat } from "@/components/buddy/BuddyChat";
import { ChessBoard } from "@/components/board/ChessBoard";
import { DragToTarget } from "@/components/minigames/engines/DragToTarget";
import { MemoryFlip } from "@/components/minigames/engines/MemoryFlip";
import { TimedReaction } from "@/components/minigames/engines/TimedReaction";
import { ConfettiBurst } from "@/components/rewards/ConfettiBurst";
import { LessonHeader } from "@/components/lesson/LessonHeader";
import { AchievementUnlockReveal } from "@/components/achievements/AchievementUnlockReveal";
import { createClient } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  markLessonComplete,
  recordPuzzleAttempt,
  localDateString,
  getTodayPreviewCount,
  incrementPreviewCount,
  getCompletedDays,
  evaluateAndAwardAchievements,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { getAcademyRecommendation } from "@/lib/chessMind/academyRecommendations";

const DAILY_PREVIEW_LIMIT = 3;

type ViewMode = "loading" | "locked" | "full" | "preview";

interface ZoneProgress {
  zone: KingdomZone;
  completedInZone: number;
  totalInZone: number;
  /** Set only if this lesson was the last day of its zone AND a next zone exists. */
  justUnlockedZone: KingdomZone | null;
}

interface RewardData {
  newAchievement: AchievementDef | null;
  zoneProgress: ZoneProgress | null;
}

export default function LessonPage() {
  const params = useParams<{ dayId: string }>();
  const router = useRouter();
  const lesson = getLesson(Number(params.dayId));

  const [stepIndex, setStepIndex] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [buddy, setBuddy] = useState(BUDDIES[0]);
  const [mode, setMode] = useState<ViewMode>("loading");
  const [previewDone, setPreviewDone] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [rewardData, setRewardData] = useState<RewardData | null>(null);
  const rewardEvaluatedRef = useRef(false);

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
      const matchedBuddy = BUDDIES.find((b) => b.id === child.buddy_id);
      if (matchedBuddy) setBuddy(matchedBuddy);

      const dayNumber = Number(params.dayId);
      if (dayNumber <= FREE_DAY_LIMIT) {
        setMode("full");
        return;
      }

      const { data: parent } = await supabase
        .from("parents")
        .select("premium_status")
        .eq("auth_user_id", user.id)
        .single();

      if (parent?.premium_status === "premium") {
        setIsPremium(true);
        setMode("full");
        return;
      }

      // Free account on a locked day: up to DAILY_PREVIEW_LIMIT puzzle
      // previews per day, from ANY locked day — a "try before you buy"
      // sample of the paid content, not tied to one specific day.
      const today = localDateString();
      const usedToday = await getTodayPreviewCount(supabase, child.id, today);
      if (usedToday >= DAILY_PREVIEW_LIMIT) {
        setMode("locked");
      } else {
        await incrementPreviewCount(supabase, child.id, today);
        setMode("preview");
      }
    }
    load();
  }, [router, params.dayId]);

  const step = lesson?.steps[stepIndex];

  // The moment the Reward step is reached, the lesson is genuinely
  // complete — this is where markLessonComplete fires (not on "Continue",
  // which now just navigates away), so the achievement/zone data shown on
  // the Reward screen reflects reality rather than a guess made before the
  // completion was even recorded.
  useEffect(() => {
    if (!lesson || !childId || step?.type !== "reward" || rewardEvaluatedRef.current) return;
    rewardEvaluatedRef.current = true;

    async function evaluate() {
      const supabase = createClient();
      await markLessonComplete(supabase, childId!, lesson!.dayNumber);
      const completedDays = await getCompletedDays(supabase, childId!);
      const newlyEarned = await evaluateAndAwardAchievements(
        supabase,
        childId!,
        completedDays,
        isPremium
      ).catch(() => [] as string[]);
      const newAchievement = newlyEarned.length > 0 ? getAchievement(newlyEarned[0]) ?? null : null;

      const zone = getZoneForDay(lesson!.dayNumber);
      const zoneLessonDays = Array.from(
        { length: zone.dayEnd - zone.dayStart + 1 },
        (_, i) => zone.dayStart + i
      );
      const completedInZone = zoneLessonDays.filter((d) => completedDays.includes(d)).length;
      const isLastDayOfZone = lesson!.dayNumber === zone.dayEnd;
      const nextZone = KINGDOM_ZONES.find((z) => z.dayStart === zone.dayEnd + 1) ?? null;

      setRewardData({
        newAchievement,
        zoneProgress: {
          zone,
          completedInZone,
          totalInZone: zoneLessonDays.length,
          justUnlockedZone: isLastDayOfZone ? nextZone : null,
        },
      });
    }
    evaluate();
  }, [lesson, childId, step, isPremium]);

  if (!lesson) {
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <p className={TEXT.body}>This part of the Kingdom is still being built.</p>
      </main>
    );
  }

  if (!childId || mode === "loading") {
    // Still loading the child profile / premium+preview check from the effect above.
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  const next = () => setStepIndex((i) => Math.min(i + 1, lesson.steps.length - 1));

  function goToKingdomMap() {
    router.push("/kingdom-map");
  }

  if (mode === "locked") {
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <SecondaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center border border-premium-gold/15">
          <span className="text-5xl">🔒</span>
          <h1 className={TEXT.heading}>Today's free previews are used up</h1>
          <p className={TEXT.body}>
            You've tried {DAILY_PREVIEW_LIMIT} puzzle previews today — come back tomorrow for
            more, or unlock every day right now.
          </p>
          <UpgradeButton tone="premium" />
          <Link
            href="/kingdom-map"
            className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
          >
            Back to Home
          </Link>
        </SecondaryCard>
      </main>
    );
  }

  if (mode === "preview") {
    return (
      <ScreenTimeGate childId={childId}>
        <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6 py-10">
          <span className={`${TEXT.meta} text-premium-gold`}>
            Free Preview — Day {lesson.dayNumber}
          </span>
          {!previewDone ? (
            <PuzzleStep
              fen={lesson.puzzle.fen}
              prompt={lesson.puzzle.prompt}
              acceptedPieceTypes={lesson.puzzle.acceptedPieceTypes}
              crystal={lesson.crystal}
              dayNumber={lesson.dayNumber}
              childId={childId}
              onNext={() => setPreviewDone(true)}
            />
          ) : (
            <SecondaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center border border-premium-gold/15">
              <span className="text-5xl">✨</span>
              <h2 className={TEXT.heading}>Enjoyed that? There's a whole adventure waiting.</h2>
              <p className={TEXT.body}>
                Unlock Day {lesson.dayNumber}'s full story, mini-games, and more — plus every
                other day, forever.
              </p>
              <UpgradeButton tone="premium" />
              <Link
                href="/kingdom-map"
                className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
              >
                Back to Home
              </Link>
            </SecondaryCard>
          )}
        </main>
      </ScreenTimeGate>
    );
  }

  // mode === "full"
  const zone = getZoneForDay(lesson.dayNumber);

  return (
    <ScreenTimeGate childId={childId}>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 py-8">
        <LessonHeader
          zoneName={zone.name}
          zoneEmoji={zone.emoji}
          dayNumber={lesson.dayNumber}
          title={lesson.title}
          stepIndex={stepIndex}
          totalSteps={lesson.steps.length}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={step!.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg flex flex-col items-center gap-6"
          >
            {step!.type === "story" && (
              <StoryStep
                title={lesson.title}
                storyBeat={lesson.storyBeat}
                objective={lesson.puzzle.prompt}
                skillTags={lesson.skillTags}
                buddy={buddy}
                onNext={next}
              />
            )}

            {step!.type === "piece_intro" && (
              <PieceIntroStep
                title={step!.title}
                crystal={lesson.crystal}
                fen={lesson.puzzle.fen}
                onNext={next}
              />
            )}

            {step!.type === "minigame" && (
              <MinigameStep dayNumber={lesson.dayNumber} onComplete={next} />
            )}

            {step!.type === "puzzle" && (
              <PuzzleStep
                fen={lesson.puzzle.fen}
                prompt={lesson.puzzle.prompt}
                acceptedPieceTypes={lesson.puzzle.acceptedPieceTypes}
                crystal={lesson.crystal}
                dayNumber={lesson.dayNumber}
                childId={childId}
                onNext={next}
              />
            )}

            {step!.type === "ai_chat" && (
              <BuddyChat
                buddyEmoji={buddy.emoji}
                buddyName={buddy.name}
                greeting={buddy.greeting || "Great job so far! Got any questions for me?"}
                onDone={next}
              />
            )}

            {step!.type === "mini_match" && (
              <MiniMatchStep
                fen={lesson.miniMatch.fen}
                prompt={lesson.miniMatch.prompt}
                movesRequired={lesson.miniMatch.movesRequired}
                crystal={lesson.crystal}
                onNext={next}
              />
            )}

            {step!.type === "reward" && (
              <RewardStep
                lessonTitle={lesson.title}
                skillTags={lesson.skillTags}
                rewardData={rewardData}
                recommendation={getAcademyRecommendation(lesson.crystal, lesson.skillTags)}
                onFinish={goToKingdomMap}
              />
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
  objective,
  skillTags,
  buddy,
  onNext,
}: {
  title: string;
  storyBeat: string;
  objective: string;
  skillTags: string[];
  buddy: (typeof BUDDIES)[number];
  onNext: () => void;
}) {
  return (
    <PrimaryCard className="flex flex-col items-center gap-5 text-center">
      <BuddyAvatar emoji={buddy.emoji} size="lg" />
      <h2 className={TEXT.heading}>{title}</h2>
      <p className="font-classic-body text-base text-premium-ivory/80 leading-relaxed">
        {storyBeat}
      </p>

      <div className="w-full rounded-premiumBtn bg-premium-midnightDeep border border-premium-gold/15 p-4 text-left">
        <p className={`${TEXT.meta} text-premium-gold mb-1`}>Today's Goal</p>
        <p className="font-classic-body text-sm text-premium-ivory/90">{objective}</p>
        {skillTags.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {skillTags.map((tag) => (
              <li key={tag} className="font-classic-body text-xs text-premium-ivory/60 flex gap-2">
                <span className="text-premium-gold flex-none">•</span>
                {getSkillTagLabel(tag)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button tone="premium" onClick={onNext}>
        Continue →
      </Button>
    </PrimaryCard>
  );
}

/**
 * The "SEE" stage (Phase 11 point 1/5) — maps the lesson data's
 * `piece_intro` step (previously unhandled by any render branch, so it
 * silently rendered nothing) onto the loop's "see the concept demonstrated
 * on the board" moment. Uses only data the lesson already has — the step's
 * own title and the puzzle's real starting position — no invented facts.
 */
function PieceIntroStep({
  title,
  crystal,
  fen,
  onNext,
}: {
  title: string;
  crystal: string;
  fen: string;
  onNext: () => void;
}) {
  return (
    <SecondaryCard className="flex flex-col items-center gap-5 text-center">
      <p className={`${TEXT.meta} text-premium-gold`}>See it on the board</p>
      <h2 className={TEXT.heading}>{title}</h2>
      <ChessBoard fen={fen} size={320} readOnly />
      <p className={TEXT.body}>
        Here's where the {crystal} starts. Let's see how it moves.
      </p>
      <Button tone="premium" onClick={onNext}>
        Continue →
      </Button>
    </SecondaryCard>
  );
}

/**
 * Looks up the day's minigame config (content/minigame-configs.ts) and
 * renders whichever engine that day uses — DragToTarget, MemoryFlip, or
 * TimedReaction — with that day's specific content. The engines themselves
 * keep their existing playful styling on purpose (Phase 11 point 25 —
 * "premium UI + chess adventure," and these mini-games are the adventure
 * side of that balance); only the surrounding shell was redesigned.
 */
function MinigameStep({ dayNumber, onComplete }: { dayNumber: number; onComplete: () => void }) {
  const config = getMinigameConfigForDay(dayNumber);

  if (!config) {
    return (
      <SecondaryCard className="flex flex-col items-center gap-4">
        <p className={TEXT.body}>This mini-game isn't ready yet.</p>
        <Button tone="premium" onClick={onComplete}>Skip for now →</Button>
      </SecondaryCard>
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
  crystal,
  dayNumber,
  childId,
  onNext,
}: {
  fen: string;
  prompt: string;
  acceptedPieceTypes: PieceSymbol[] | "any";
  crystal: string;
  dayNumber: number;
  childId: string;
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
    <SecondaryCard className="flex flex-col items-center gap-5 w-full">
      <p className="font-classic-body text-base text-premium-ivory text-center">{prompt}</p>
      <ChessBoard
        key={boardKey}
        fen={fen}
        playableColor="w"
        opponent="stockfish"
        size={360}
        onMove={(opts) => handleMove(opts.piece)}
        onGameOver={(result) => {
          if (result.isCheckmate && result.winner === "w") {
            setCheckmated(true);
          }
        }}
      />
      {checkmated && (
        <p className="font-classic-display text-lg text-premium-gold text-center">
          Checkmate — incredible.
        </p>
      )}
      {!checkmated && moved && wasCorrect && (
        <p className="font-classic-display text-lg text-emerald-400 text-center">
          Excellent. That's how the {crystal} does it.
        </p>
      )}
      {!checkmated && moved && !wasCorrect && (
        <div className="flex flex-col items-center gap-2">
          <p className="font-classic-body text-sm text-red-300 text-center">
            Not quite — look for a move with the {crystal} from today's lesson.
          </p>
          <Button tone="premium" variant="ghost" size="md" onClick={tryAgain}>
            Try Again
          </Button>
        </div>
      )}
      <Button tone="premium" disabled={!moved} onClick={onNext}>
        Continue →
      </Button>
    </SecondaryCard>
  );
}

function MiniMatchStep({
  fen,
  prompt,
  movesRequired,
  crystal,
  onNext,
}: {
  fen: string;
  prompt: string;
  movesRequired: number;
  crystal: string;
  onNext: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [checkmated, setCheckmated] = useState(false);

  if (!started) {
    return (
      <SecondaryCard className="flex flex-col items-center gap-4 text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>Put It Into Practice</p>
        <h2 className={TEXT.heading}>Now use what you learned.</h2>
        <p className={TEXT.body}>{prompt}</p>
        <Button tone="premium" onClick={() => setStarted(true)}>
          Start Mini Match →
        </Button>
      </SecondaryCard>
    );
  }

  const complete = checkmated || moveCount >= movesRequired;

  return (
    <SecondaryCard className="flex flex-col items-center gap-5 w-full">
      <p className="font-classic-body text-sm text-premium-ivory/70 text-center">{prompt}</p>
      <ChessBoard
        fen={fen}
        playableColor="w"
        opponent="stockfish"
        size={360}
        onMove={() => setMoveCount((c) => c + 1)}
        onGameOver={(result) => {
          if (result.isCheckmate && result.winner === "w") {
            setCheckmated(true);
          }
        }}
      />
      {checkmated ? (
        <p className="font-classic-display text-lg text-premium-gold">Checkmate — incredible.</p>
      ) : complete ? (
        <p className="font-classic-display text-base text-emerald-400">
          Nice work. You put the {crystal} into practice.
        </p>
      ) : (
        <p className={TEXT.caption}>
          {Math.min(moveCount, movesRequired)}/{movesRequired} moves
        </p>
      )}
      <Button tone="premium" disabled={!complete} onClick={onNext}>
        Finish the Duel →
      </Button>
    </SecondaryCard>
  );
}

function RewardStep({
  lessonTitle,
  skillTags,
  rewardData,
  recommendation,
  onFinish,
}: {
  lessonTitle: string;
  skillTags: string[];
  rewardData: RewardData | null;
  recommendation: ReturnType<typeof getAcademyRecommendation>;
  onFinish: () => void;
}) {
  // rewardData is null only for the brief moment the completion/achievement
  // evaluation is in flight (see the useEffect above) — a light loading
  // state rather than showing wrong/incomplete progress.
  if (!rewardData) {
    return (
      <SecondaryCard className="flex flex-col items-center gap-4 text-center">
        <p className={TEXT.body}>Wrapping up the lesson…</p>
      </SecondaryCard>
    );
  }

  const { newAchievement, zoneProgress } = rewardData;

  return (
    <PrimaryCard className="flex flex-col items-center gap-5 text-center relative overflow-hidden w-full">
      <ConfettiBurst />
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="text-6xl"
      >
        💎
      </motion.div>
      <div>
        <p className={`${TEXT.meta} text-premium-gold`}>Lesson Complete</p>
        <h2 className={`${TEXT.heading} mt-1`}>The {lessonTitle} lesson is complete.</h2>
      </div>

      {skillTags.length > 0 && (
        <div className="w-full rounded-premiumBtn bg-premium-midnightDeep border border-white/10 p-4 text-left">
          <p className={`${TEXT.meta} text-premium-gold mb-2`}>You Learned</p>
          <ul className="flex flex-col gap-1.5">
            {skillTags.map((tag) => (
              <li key={tag} className="font-classic-body text-sm text-premium-ivory/85 flex gap-2">
                <span className="text-emerald-400 flex-none">✓</span>
                {getSkillTagLabel(tag)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {newAchievement && <AchievementUnlockReveal achievement={newAchievement} />}

      {zoneProgress && (
        <div className="w-full rounded-premiumBtn bg-premium-midnightDeep border border-white/10 p-4 text-left">
          <p className={`${TEXT.meta} text-premium-gold mb-2`}>Kingdom Progress</p>
          <p className="font-classic-display text-sm text-premium-ivory mb-1.5">
            {zoneProgress.zone.emoji} {zoneProgress.zone.name}
          </p>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-premium-goldMuted to-premium-gold"
              style={{
                width: `${Math.round((zoneProgress.completedInZone / zoneProgress.totalInZone) * 100)}%`,
              }}
            />
          </div>
          <p className={`${TEXT.caption} mt-1`}>
            {zoneProgress.completedInZone}/{zoneProgress.totalInZone} days complete
          </p>

          {zoneProgress.justUnlockedZone && (
            <div className="mt-3 pt-3 border-t border-white/10 text-center">
              <p className={`${TEXT.meta} text-premium-gold`}>New Area Unlocked</p>
              <p className="font-classic-display text-base text-premium-ivory mt-0.5">
                {zoneProgress.justUnlockedZone.emoji} {zoneProgress.justUnlockedZone.name}
              </p>
            </div>
          )}
        </div>
      )}

      {recommendation && (
        <Link
          href={recommendation.href}
          className="w-full rounded-premiumBtn border border-premium-gold/30 bg-premium-gold/10 px-4 py-3 text-left hover:bg-premium-gold/15 transition-colors"
        >
          <p className={`${TEXT.meta} text-premium-gold`}>Want to train this skill?</p>
          <p className="font-classic-body text-sm text-premium-ivory/80 mt-0.5">
            {recommendation.reason}
          </p>
          <p className="font-classic-display text-sm text-premium-ivory mt-1">
            Try {recommendation.label} →
          </p>
        </Link>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button tone="premium" className="flex-1" onClick={onFinish}>
          Continue Journey →
        </Button>
        <Link href="/academy" className="flex-1">
          <Button tone="premium" variant="ghost" className="w-full">
            Back to Academy
          </Button>
        </Link>
      </div>
    </PrimaryCard>
  );
}
