"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeGame, type CompletedGameRecord, type GameAnalysisResult } from "@/lib/analysis/gameAnalysis";
import { pickBiggestMoment } from "@/lib/analysis/skillMapping";
import { getSkill, type SkillId } from "@/lib/analysis/skills";
import { recommendPractice, type PracticeRecommendation } from "@/lib/training/recommendation";
import {
  buildGameReviewInput,
  skillWeaknessCounts,
  RECURRING_SKILL_THRESHOLD,
} from "@/lib/analysis/gameReviewSignals";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getChildProfileById,
  getSolvedPuzzleIds,
  getSkillSignals,
  recordGameReview,
  bumpSkillWeaknesses,
  recordSkillPractice,
  type SkillSignal,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { BUDDIES } from "@/content/buddies";
import type { ExperienceLevel, AgeBand } from "@/lib/learner/experienceLevel";
import type { OllieReviewContext } from "@/lib/ollie/reviewContext";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { GameSummaryCard } from "./GameSummaryCard";
import { MoveNavigator } from "./MoveNavigator";
import { MistakeCard, type EnrichedMistake } from "./MistakeCard";
import { GoodMoveCard, type EnrichedGoodMove } from "./GoodMoveCard";
import { PerformanceSummary } from "./PerformanceSummary";
import { BiggestMomentCard } from "./BiggestMomentCard";
import { SkillPracticeSet } from "./SkillPracticeSet";
import { BuddyChat } from "@/components/buddy/BuddyChat";

type Mode = "replay" | "analysis";
type Screen = "review" | "practice";

interface ExplainResponse {
  mistakes: Record<number, { explanation: string; whatToNotice: string; skill?: string }>;
  goodMoves: Record<number, { explanation: string }>;
  biggestLesson: string;
  insights: string[];
}

const FALLBACK_TEXT = {
  explanation: "Your move gave up a significant advantage here.",
  whatToNotice: "Take a moment to check your opponent's threats before you move.",
};

async function fetchExplanations(analysis: GameAnalysisResult, record: CompletedGameRecord): Promise<ExplainResponse> {
  const res = await fetch("/api/game-analysis/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mistakes: analysis.flaggedMistakes.map((m) => ({
        ply: m.ply,
        moveNumber: Math.floor(m.ply / 2) + 1,
        san: m.san,
        category: m.category,
        bestMoveSan: m.bestMove?.san,
        isCapture: m.bestMove?.isCapture,
        missedMate: m.missedMate,
        missedMaterial: m.missedMaterial,
        skillHint: m.skill?.skill,
        skillConfidence: m.skill?.confidence,
      })),
      goodMoves: analysis.highlightedGoodMoves.map((m) => ({
        ply: m.ply,
        moveNumber: Math.floor(m.ply / 2) + 1,
        san: m.san,
      })),
      context: {
        playerColor: record.playerColor,
        result: record.result.isDraw ? "draw" : record.result.winner === record.playerColor ? "win" : "loss",
        openingName: record.openingName,
        totalMoves: Math.ceil(record.moves.length / 2),
      },
    }),
  });
  if (!res.ok) throw new Error("Explanation request failed");
  return res.json();
}

interface ChildContext {
  childId: string | null;
  experienceLevel: ExperienceLevel | null;
  ageBand: AgeBand | null;
  buddyId: string | null;
  solvedPuzzleIds: Set<string>;
  /** SkillId -> aggregated signal from past reviews/practice. Empty until
   * migration 0033 is applied / the child has history. */
  skillSignals: Record<string, SkillSignal>;
}

/**
 * The full post-game review experience (Chess Mind's Game Review feature).
 * Reuses the existing Stockfish engine (lib/chess-engine/stockfishEngine.ts)
 * for detection/classification and the existing Claude integration (same
 * pattern as app/api/ai/coach) for the kid-friendly "why" prose — no new
 * chess engine, no new AI provider.
 *
 * Phase A/B adds: an accuracy score, the "biggest learning moment" with a
 * skill, and a "practice this skill" loop into existing puzzle/lesson
 * content (lib/training/recommendation.ts + SkillPracticeSet).
 *
 * Layout is a single scroll column with fixed / width-bounded read-only
 * boards — no ChessFocusLayout, because no board here competes with a
 * growing panel for viewport height (the mobile-hardening concern). The
 * one interactive board (SkillPracticeSet) is width-bounded and scrolls
 * with the page.
 */
export function PostGameAnalysis({
  record,
  boardSkinId,
  pieceSetId,
  childId: childIdProp,
  source = "free_play",
  onPlayAgain,
  onBack,
}: {
  record: CompletedGameRecord;
  boardSkinId?: string;
  pieceSetId?: string;
  /** The active child id, when the calling screen already resolved it
   * (Free Play / Online both do) — skips a redundant resolveActiveChild. */
  childId?: string | null;
  /** Which surface the reviewed game came from — persisted with the review. */
  source?: "free_play" | "online";
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [analysis, setAnalysis] = useState<GameAnalysisResult | null>(null);
  const [explanations, setExplanations] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>("replay");
  const [screen, setScreen] = useState<Screen>("review");
  const [askOllieOpen, setAskOllieOpen] = useState(false);
  const [practiceSkill, setPracticeSkill] = useState<SkillId | null>(null);
  const [currentPly, setCurrentPly] = useState(-1);
  const [currentMistakeIndex, setCurrentMistakeIndex] = useState(0);
  const [childCtx, setChildCtx] = useState<ChildContext>({
    childId: null,
    experienceLevel: null,
    ageBand: null,
    buddyId: null,
    solvedPuzzleIds: new Set(),
    skillSignals: {},
  });
  const persistedRef = useRef(false);

  // Best-effort — everything here degrades gracefully: the recommendation
  // falls back to "new"/no-solved-data, skill signals to empty, and none
  // of it ever blocks the review.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user) return;
        // Prefer the id the calling screen already resolved (one query),
        // fall back to a full active-child resolution otherwise.
        const child = childIdProp
          ? await getChildProfileById(supabase, childIdProp)
          : (await resolveActiveChild(supabase, user.id, getActiveChildIdClient())).child;
        if (!child || cancelled) return;
        const [solved, signals] = await Promise.all([
          getSolvedPuzzleIds(supabase, child.id).catch(() => [] as string[]),
          getSkillSignals(supabase, child.id).catch(() => ({} as Record<string, SkillSignal>)),
        ]);
        if (cancelled) return;
        setChildCtx({
          childId: child.id,
          experienceLevel: child.experience_level,
          ageBand: child.age_band,
          buddyId: child.buddy_id,
          solvedPuzzleIds: new Set(solved),
          skillSignals: signals,
        });
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childIdProp]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const result = await analyzeGame(record, (done, total) => {
          if (!cancelled) setProgress({ done, total });
        });
        if (cancelled) return;
        setAnalysis(result);
        try {
          const explained = await fetchExplanations(result, record);
          if (!cancelled) setExplanations(explained);
        } catch {
          if (!cancelled) {
            const mistakes: ExplainResponse["mistakes"] = {};
            for (const m of result.flaggedMistakes) {
              mistakes[m.ply] = { ...FALLBACK_TEXT, skill: m.skill?.skill };
            }
            const goodMoves: ExplainResponse["goodMoves"] = {};
            for (const m of result.highlightedGoodMoves) goodMoves[m.ply] = { explanation: "Nicely played!" };
            setExplanations({
              mistakes,
              goodMoves,
              biggestLesson: "Keep checking your opponent's threats before every move.",
              insights: [],
            });
          }
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enrichedMistakes: EnrichedMistake[] = useMemo(() => {
    if (!analysis || !explanations) return [];
    return analysis.flaggedMistakes.map((m) => {
      const fromApi = explanations.mistakes[m.ply];
      const skillId = (fromApi?.skill as SkillId | undefined) ?? m.skill?.skill ?? "advantage_loss";
      return {
        ...m,
        explanation: fromApi?.explanation ?? FALLBACK_TEXT.explanation,
        whatToNotice: fromApi?.whatToNotice ?? FALLBACK_TEXT.whatToNotice,
        skillId,
      };
    });
  }, [analysis, explanations]);

  const enrichedGoodMoves: EnrichedGoodMove[] = useMemo(() => {
    if (!analysis || !explanations) return [];
    return analysis.highlightedGoodMoves.map((m) => ({
      ...m,
      explanation: explanations.goodMoves[m.ply]?.explanation ?? "Nicely played!",
    }));
  }, [analysis, explanations]);

  const biggestMoment: EnrichedMistake | null = useMemo(() => {
    if (!analysis || enrichedMistakes.length === 0) return null;
    const pick = pickBiggestMoment(analysis.flaggedMistakes);
    if (!pick) return null;
    return enrichedMistakes.find((m) => m.ply === pick.ply) ?? enrichedMistakes[0];
  }, [analysis, enrichedMistakes]);

  const recommendation: PracticeRecommendation | null = useMemo(() => {
    if (!practiceSkill) return null;
    return recommendPractice({
      skill: practiceSkill,
      experienceLevel: childCtx.experienceLevel,
      ageBand: childCtx.ageBand,
      solvedPuzzleIds: childCtx.solvedPuzzleIds,
    });
  }, [practiceSkill, childCtx]);

  /** Has this skill been the flagged cause of a mistake in enough of the
   * child's PAST reviews to call it a pattern? Uses only real history
   * (this game's contribution isn't persisted until the effect below
   * runs). */
  const biggestMomentRecurring = useMemo(() => {
    if (!biggestMoment) return false;
    const sig = childCtx.skillSignals[biggestMoment.skillId];
    return !!sig && sig.weakCount >= RECURRING_SKILL_THRESHOLD;
  }, [biggestMoment, childCtx.skillSignals]);

  // Persist the completed review + skill weakness signals — exactly once,
  // once analysis + explanations + child id are all available. Fully
  // best-effort: buildGameReviewInput is pure, and every write swallows
  // its own errors (missing table before 0033 is applied, offline, RLS).
  useEffect(() => {
    if (persistedRef.current) return;
    if (!analysis || !explanations || !childCtx.childId) return;
    persistedRef.current = true;
    const supabase = createClient();
    const apiSkillByPly: Record<number, string | undefined> = {};
    for (const [ply, m] of Object.entries(explanations.mistakes)) apiSkillByPly[Number(ply)] = m.skill;
    const pick = pickBiggestMoment(analysis.flaggedMistakes);
    const bmSkill =
      (pick && (apiSkillByPly[pick.ply] as SkillId | undefined)) ?? pick?.skill?.skill ?? null;
    const input = buildGameReviewInput(analysis, record, source, bmSkill, pick?.ply ?? null);
    void recordGameReview(supabase, childCtx.childId, input);
    void bumpSkillWeaknesses(supabase, childCtx.childId, skillWeaknessCounts(analysis, apiSkillByPly));
  }, [analysis, explanations, childCtx.childId, record, source]);

  function startPractice(skill: SkillId) {
    setPracticeSkill(skill);
    setScreen("practice");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePracticeComplete(skill: SkillId, attempts: number, correct: number) {
    if (!childCtx.childId || attempts <= 0) return;
    void recordSkillPractice(createClient(), childCtx.childId, skill, attempts, correct);
  }

  const reviewOllieContext: OllieReviewContext | null = useMemo(() => {
    if (!biggestMoment) return null;
    return {
      playerColor: record.playerColor,
      result: record.result.isDraw
        ? "draw"
        : record.result.winner === record.playerColor
          ? "win"
          : record.result.winner
            ? "loss"
            : undefined,
      accuracy: analysis?.accuracy.movesConsidered ? analysis.accuracy.score : undefined,
      mistakeCount: analysis ? analysis.flaggedMistakes.length : undefined,
      blunderCount: analysis?.counts.blunder,
      moveNumber: Math.floor(biggestMoment.ply / 2) + 1,
      playedSan: biggestMoment.san,
      bestSan: biggestMoment.bestMove?.san,
      category: biggestMoment.category === "blunder" || biggestMoment.category === "mistake" || biggestMoment.category === "inaccuracy" ? biggestMoment.category : undefined,
      missedMate: biggestMoment.missedMate,
      missedMaterial: biggestMoment.missedMaterial,
      skillName: getSkill(biggestMoment.skillId).name,
      whatToNotice: biggestMoment.whatToNotice,
      fenBefore: biggestMoment.fenBefore,
      recurringSkill: biggestMomentRecurring,
      practiceSkillName: getSkill(biggestMoment.skillId).name,
    };
  }, [biggestMoment, analysis, record, biggestMomentRecurring]);

  const buddy = useMemo(
    () => BUDDIES.find((b) => b.id === childCtx.buddyId) ?? BUDDIES[0],
    [childCtx.buddyId]
  );

  if (error) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>Couldn&apos;t analyze this game right now.</p>
        <Button tone="premium" onClick={onBack}>
          Back to Chess Mind
        </Button>
      </main>
    );
  }

  if (!analysis || !explanations) {
    const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.heading}>Preparing your Chess Mind Review…</p>
        <div className="w-full max-w-xs h-2 rounded-full bg-premium-navy overflow-hidden">
          <div className="h-full bg-premium-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        {progress && (
          <p className={TEXT.caption}>
            Move {progress.done} of {progress.total}
          </p>
        )}
      </main>
    );
  }

  const accuracyScore = analysis.accuracy.score;

  // --- Practice screen ---
  if (screen === "practice" && recommendation) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-4 sm:px-6 py-10">
        <div className="text-center">
          <p className={`${TEXT.meta} text-premium-gold`}>Chess Mind</p>
          <h1 className={TEXT.display}>Your Next Step</h1>
        </div>
        <SkillPracticeSet
          recommendation={recommendation}
          childId={childCtx.childId}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
          onComplete={handlePracticeComplete}
          onPlayAgain={onPlayAgain}
          onBackToReview={() => {
            setScreen("review");
            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </main>
    );
  }

  const currentMistake = enrichedMistakes[currentMistakeIndex] ?? null;

  // --- Review screen ---
  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-4 sm:px-6 py-10">
      <div className="text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>Chess Mind</p>
        <h1 className={TEXT.display}>Your Chess Mind Review</h1>
      </div>

      <GameSummaryCard record={record} accuracy={accuracyScore} />

      <BiggestMomentCard
        mistake={biggestMoment}
        record={record}
        accuracy={accuracyScore}
        goodMoveCount={enrichedGoodMoves.length}
        recurring={biggestMomentRecurring}
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
        onPractice={startPractice}
      />

      {reviewOllieContext && (
        <div className="w-full max-w-md flex flex-col gap-3">
          {!askOllieOpen ? (
            <Button tone="premium" variant="secondary" onClick={() => setAskOllieOpen(true)}>
              {buddy.emoji} Ask {buddy.name} about this
            </Button>
          ) : (
            <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4">
              <BuddyChat
                buddyEmoji={buddy.emoji}
                buddyName={buddy.name}
                greeting={`Let's look at that game together. Ask me anything about your biggest mistake${
                  biggestMoment ? ` on move ${Math.floor(biggestMoment.ply / 2) + 1}` : ""
                }.`}
                childId={childCtx.childId}
                reviewContext={reviewOllieContext}
                experienceLevel={childCtx.experienceLevel ?? undefined}
                ageBand={childCtx.ageBand ?? undefined}
                suggestions={[
                  "Why was this a mistake?",
                  "How can I avoid this next time?",
                  "What should I practice?",
                ]}
                onDone={() => setAskOllieOpen(false)}
                doneLabel="Close chat"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Review mode">
        <Button tone="premium" variant={mode === "replay" ? "primary" : "ghost"} onClick={() => setMode("replay")}>
          Replay Game
        </Button>
        <Button tone="premium" variant={mode === "analysis" ? "primary" : "ghost"} onClick={() => setMode("analysis")}>
          All Mistakes
        </Button>
      </div>

      {mode === "replay" && (
        <MoveNavigator
          record={record}
          analyzedMoves={analysis.moves}
          currentPly={currentPly}
          onPlyChange={setCurrentPly}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
        />
      )}

      {mode === "analysis" && (
        <div className="flex flex-col items-center gap-6 w-full">
          {enrichedMistakes.length === 0 ? (
            <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full max-w-md text-center">
              <p className={TEXT.body}>No major mistakes found in this game — great job!</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentMistakeIndex((i) => Math.max(0, i - 1))}
                  disabled={currentMistakeIndex === 0}
                  className="w-11 h-11 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
                  aria-label="Previous mistake"
                >
                  ◀
                </button>
                <p className={TEXT.caption}>
                  Mistake {currentMistakeIndex + 1} of {enrichedMistakes.length}
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentMistakeIndex((i) => Math.min(enrichedMistakes.length - 1, i + 1))}
                  disabled={currentMistakeIndex === enrichedMistakes.length - 1}
                  className="w-11 h-11 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
                  aria-label="Next mistake"
                >
                  ▶
                </button>
              </div>
              {currentMistake && (
                <MistakeCard mistake={currentMistake} record={record} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
              )}
            </>
          )}

          {enrichedGoodMoves.length > 0 && (
            <div className="flex flex-col items-center gap-3 w-full">
              {enrichedGoodMoves.map((m) => (
                <GoodMoveCard key={m.ply} move={m} />
              ))}
            </div>
          )}

          <PerformanceSummary
            counts={analysis.counts}
            accuracy={accuracyScore}
            biggestLesson={explanations.biggestLesson}
            insights={explanations.insights}
          />
        </div>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        {biggestMoment && (
          <Button tone="premium" onClick={() => startPractice(biggestMoment.skillId)}>
            Practice {getSkill(biggestMoment.skillId).name} →
          </Button>
        )}
        <Button tone="premium" variant={biggestMoment ? "ghost" : "primary"} onClick={onPlayAgain}>
          Play Again
        </Button>
        <Button tone="premium" variant="ghost" onClick={onBack}>
          Back to Chess Mind
        </Button>
      </div>
    </main>
  );
}
