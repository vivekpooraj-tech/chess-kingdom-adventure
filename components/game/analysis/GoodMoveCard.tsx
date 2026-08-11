import { TEXT } from "@/lib/designSystem";
import { formatMoveNumber } from "@/lib/analysis/format";
import type { AnalyzedMove } from "@/lib/analysis/gameAnalysis";

export interface EnrichedGoodMove extends AnalyzedMove {
  explanation: string;
}

/** Positive reinforcement (section 10) — kept visually lighter than a
 * MistakeCard (no before/after boards needed; the point is "notice you did
 * this well," not a deep breakdown). */
export function GoodMoveCard({ move }: { move: EnrichedGoodMove }) {
  return (
    <div className="rounded-premiumBtn bg-emerald-500/10 border border-emerald-400/25 p-4 flex flex-col gap-1 w-full max-w-md">
      <p className="font-classic-display text-sm text-emerald-300">
        🟢 GOOD MOVE — {formatMoveNumber(move.ply, move.mover)} {move.san}
      </p>
      <p className={TEXT.body}>{move.explanation}</p>
    </div>
  );
}
