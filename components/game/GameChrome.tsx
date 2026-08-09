import type { PieceSymbol } from "chess.js";
import { CapturedPieces } from "./CapturedPieces";
import { MoveList } from "./MoveList";

/**
 * Premium side panel around a ChessBoard — captured pieces, move list, and
 * an optional status/hint line. Purely presentational; the caller owns game
 * state (via ChessBoard's onPositionChange) and decides what hint text (if
 * any) is honest to show.
 */
export function GameChrome({
  capturedByWhite,
  capturedByBlack,
  history,
  statusText,
  hint,
}: {
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
  history: string[];
  statusText?: string;
  hint?: string | null;
}) {
  return (
    <div className="w-full max-w-[480px] rounded-premiumCard bg-premium-navy p-4 flex flex-col gap-3 shadow-premiumCard">
      <div className="flex items-start justify-between gap-3">
        <CapturedPieces capturedByWhite={capturedByWhite} capturedByBlack={capturedByBlack} />
        {statusText && (
          <span className="font-classic-body text-xs font-semibold text-premium-gold bg-premium-gold/10 border border-premium-gold/25 rounded-full px-3 py-1 whitespace-nowrap">
            {statusText}
          </span>
        )}
      </div>

      <MoveList history={history} />

      {hint && (
        <p className="font-classic-body text-xs text-premium-ivory/60 bg-white/5 rounded-premiumBtn px-3 py-2">
          {hint}
        </p>
      )}
    </div>
  );
}
