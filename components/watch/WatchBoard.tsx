import { Chess, type Square } from "chess.js";
import { getBoardSkin } from "@/content/boardSkins";
import { getPieceSet } from "@/content/pieceSets";
import { PieceImage } from "@/components/board/PieceImage";

const FILES = "abcdefgh";

/**
 * Read-only board for Watch: draws a FEN with Chess Mind's own default board colours and piece art. No handlers, no buttons, no engine,
 * no chess.ts move input — it cannot submit a move. (The interactive ChessBoard is untouched.)
 */
export function WatchBoard({
  fen,
  lastMove,
  label,
}: {
  fen: string;
  lastMove?: { from: Square; to: Square };
  label: string;
}) {
  const skin = getBoardSkin(null);
  const set = getPieceSet(null);
  const rows = new Chess(fen).board();

  return (
    <div className="wt-board" role="img" aria-label={label}>
      {rows.map((row, r) =>
        row.map((cell, c) => {
          const sq = `${FILES[c]}${8 - r}`;
          const light = (r + c) % 2 === 0;
          const hit = lastMove && (lastMove.from === sq || lastMove.to === sq);
          return (
            <div
              key={sq}
              className="wt-sq"
              data-last={hit ? "" : undefined}
              style={{ background: light ? skin.lightSquare : skin.darkSquare }}
            >
              {cell && <PieceImage set={set} piece={cell.type} color={cell.color} />}
            </div>
          );
        }),
      )}
    </div>
  );
}
