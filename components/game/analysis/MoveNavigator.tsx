"use client";

import { ChessBoard } from "@/components/board/ChessBoard";
import { CATEGORY_INFO } from "@/lib/analysis/moveClassification";
import { formatMoveNumber } from "@/lib/analysis/format";
import type { CompletedGameRecord, AnalyzedMove } from "@/lib/analysis/gameAnalysis";

/** Shared board + controls + clickable move list — used by both Replay and
 * Review Mistakes modes so "go to any move and see the position" behaves
 * identically everywhere (section 4 of the brief). */
export function MoveNavigator({
  record,
  analyzedMoves,
  currentPly,
  onPlyChange,
  boardSkinId,
  pieceSetId,
  boardSize = 320,
}: {
  record: CompletedGameRecord;
  /** When provided, each move in the list gets its category emoji. */
  analyzedMoves?: AnalyzedMove[];
  /** -1 = starting position, 0..moves.length-1 = after that move. */
  currentPly: number;
  onPlyChange: (ply: number) => void;
  boardSkinId?: string;
  pieceSetId?: string;
  boardSize?: number;
}) {
  const currentFen = currentPly === -1 ? record.startFen : record.moves[currentPly].fen;
  const lastPly = record.moves.length - 1;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <ChessBoard
        readOnly
        fen={currentFen}
        playableColor={record.playerColor}
        size={boardSize}
        boardSkinId={boardSkinId}
        pieceSetId={pieceSetId}
      />

      <div className="flex items-center gap-2" role="group" aria-label="Move navigation">
        <button
          type="button"
          onClick={() => onPlyChange(-1)}
          disabled={currentPly === -1}
          aria-label="First move"
          className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={() => onPlyChange(Math.max(-1, currentPly - 1))}
          disabled={currentPly === -1}
          aria-label="Previous move"
          className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
        >
          ◀
        </button>
        <span className="font-classic-body text-xs text-premium-ivory/50 w-16 text-center">
          {currentPly === -1 ? "Start" : `Move ${currentPly + 1}/${record.moves.length}`}
        </span>
        <button
          type="button"
          onClick={() => onPlyChange(Math.min(lastPly, currentPly + 1))}
          disabled={currentPly === lastPly}
          aria-label="Next move"
          className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => onPlyChange(lastPly)}
          disabled={currentPly === lastPly}
          aria-label="Last move"
          className="w-9 h-9 flex items-center justify-center rounded-premiumBtn bg-premium-navyLight text-premium-ivory disabled:opacity-30"
        >
          ⏭
        </button>
      </div>

      <div className="w-full max-w-md max-h-40 overflow-y-auto rounded-premiumCard bg-premium-navy/60 border border-white/5 p-2">
        <div className="flex flex-wrap gap-1">
          {record.moves.map((m, i) => {
            const category = analyzedMoves?.[i]?.category;
            const isCurrent = i === currentPly;
            return (
              <button
                key={m.ply}
                type="button"
                onClick={() => onPlyChange(i)}
                className={`font-classic-body text-xs rounded px-1.5 py-1 transition-colors ${
                  isCurrent ? "bg-premium-gold/20 text-premium-gold" : "text-premium-ivory/70 hover:bg-white/5"
                }`}
              >
                {m.mover === "w" && <span className="text-premium-ivory/40">{formatMoveNumber(m.ply, m.mover)} </span>}
                {category && <span aria-hidden="true">{CATEGORY_INFO[category].emoji} </span>}
                {m.san}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
