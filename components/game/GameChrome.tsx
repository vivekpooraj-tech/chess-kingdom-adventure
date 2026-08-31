import type { PieceSymbol } from "chess.js";
import { CapturedPieces } from "./CapturedPieces";
import { MoveList } from "./MoveList";

/**
 * Premium side panel around a ChessBoard — a purposeful companion panel,
 * not a stack of loose widgets: captured material and live status up top,
 * the move list taking the remaining height, an honest hint line pinned
 * below. Purely presentational; the caller owns game state and decides
 * what hint text (if any) is honest to show.
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
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 rounded-premiumCard bg-premium-navy p-3 shadow-premiumCard sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <CapturedPieces capturedByWhite={capturedByWhite} capturedByBlack={capturedByBlack} />
        {statusText && (
          <span className="flex-none whitespace-nowrap rounded-full border border-premium-gold/25 bg-premium-gold/10 px-3 py-1 font-classic-body text-xs font-semibold text-premium-gold">
            {statusText}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <p className="font-classic-body text-[10px] uppercase tracking-wide text-premium-ivory/40">
          Moves
        </p>
        <MoveList history={history} />
      </div>

      {hint && (
        <p className="rounded-premiumBtn border border-white/10 bg-white/[0.04] px-3 py-2 font-classic-body text-xs leading-snug text-premium-ivory/70">
          {hint}
        </p>
      )}
    </div>
  );
}
