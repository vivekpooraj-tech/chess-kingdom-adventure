"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeGame, type CompletedGameRecord, type GameAnalysisResult, type AnalyzedMove } from "@/lib/analysis/gameAnalysis";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { GameSummaryCard } from "./GameSummaryCard";
import { MoveNavigator } from "./MoveNavigator";
import { MistakeCard, type EnrichedMistake } from "./MistakeCard";
import { GoodMoveCard, type EnrichedGoodMove } from "./GoodMoveCard";
import { PerformanceSummary } from "./PerformanceSummary";

type Mode = "replay" | "analysis";

interface ExplainResponse {
  mistakes: Record<number, { explanation: string; whatToNotice: string }>;
  goodMoves: Record<number, { explanation: string }>;
  biggestLesson: string;
  insights: string[];
}

const FALLBACK_TEXT = {
  explanation: "This move gave your opponent a real opportunity here.",
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

/**
 * The full post-game review experience (Chess Mind's post-game analysis
 * feature). Reuses the existing Stockfish engine (lib/chess-engine/
 * stockfishEngine.ts) for detection/classification and the existing
 * Claude integration (same pattern as app/api/ai/coach) for the
 * kid-friendly "why" prose — no new chess engine, no new AI provider.
 */
export function PostGameAnalysis({
  record,
  boardSkinId,
  pieceSetId,
  onPlayAgain,
  onBack,
}: {
  record: CompletedGameRecord;
  boardSkinId?: string;
  pieceSetId?: string;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [analysis, setAnalysis] = useState<GameAnalysisResult | null>(null);
  const [explanations, setExplanations] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>("replay");
  const [currentPly, setCurrentPly] = useState(-1);
  const [currentMistakeIndex, setCurrentMistakeIndex] = useState(0);

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
          // Explanations are a nice-to-have on top of the classification —
          // fall back to generic text per mistake rather than blocking the
          // whole analysis screen on an API hiccup.
          if (!cancelled) {
            const mistakes: ExplainResponse["mistakes"] = {};
            for (const m of result.flaggedMistakes) mistakes[m.ply] = FALLBACK_TEXT;
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
    return analysis.flaggedMistakes.map((m) => ({
      ...m,
      explanation: explanations.mistakes[m.ply]?.explanation ?? FALLBACK_TEXT.explanation,
      whatToNotice: explanations.mistakes[m.ply]?.whatToNotice ?? FALLBACK_TEXT.whatToNotice,
    }));
  }, [analysis, explanations]);

  const enrichedGoodMoves: EnrichedGoodMove[] = useMemo(() => {
    if (!analysis || !explanations) return [];
    return analysis.highlightedGoodMoves.map((m) => ({
      ...m,
      explanation: explanations.goodMoves[m.ply]?.explanation ?? "Nicely played!",
    }));
  }, [analysis, explanations]);

  if (error) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>Couldn't analyze this game right now.</p>
        <Button tone="premium" onClick={onBack}>Back to Chess Mind</Button>
      </main>
    );
  }

  if (!analysis || !explanations) {
    const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.heading}>Analyzing your game...</p>
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

  const currentMistake = enrichedMistakes[currentMistakeIndex] ?? null;

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-4 sm:px-6 py-10">
      <div className="text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>Chess Mind</p>
        <h1 className={TEXT.display}>Game Analysis</h1>
      </div>

      <GameSummaryCard record={record} />

      <div className="flex gap-2" role="tablist" aria-label="Review mode">
        <Button tone="premium" variant={mode === "replay" ? "primary" : "ghost"} onClick={() => setMode("replay")}>
          Replay Game
        </Button>
        <Button tone="premium" variant={mode === "analysis" ? "primary" : "ghost"} onClick={() => setMode("analysis")}>
          Review Mistakes
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
                  className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
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
                  className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
                  aria-label="Next mistake"
                >
                  ▶
                </button>
              </div>
              {currentMistake && (
                <MistakeCard mistake={currentMistake} boardSkinId={boardSkinId} pieceSetId={pieceSetId} />
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

          <PerformanceSummary counts={analysis.counts} biggestLesson={explanations.biggestLesson} insights={explanations.insights} />
        </div>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        <Button tone="premium" onClick={onPlayAgain}>Play Again</Button>
        <Button tone="premium" variant="ghost" onClick={onBack}>Back to Chess Mind</Button>
      </div>
    </main>
  );
}
