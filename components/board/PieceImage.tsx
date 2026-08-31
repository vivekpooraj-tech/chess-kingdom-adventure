import type { PieceSymbol, Color } from "chess.js";
import { PieceSetOption } from "@/lib/types";
import { PIECE_FILE_NAME } from "@/content/pieceSets";

/**
 * The one place a chess-piece asset becomes pixels.
 *
 * Every piece is sized by HEIGHT (`pieceSet.opticalScale[type]`, a fraction
 * of the square) inside a full-width slot, and `object-fit: contain` centres
 * it. So a whole set shares one optical coordinate system — the king is the
 * tallest, the pawn the shortest, and a stubby rook can't out-scale a narrow
 * king the way it did when each piece was fitted to its own bounding box.
 *
 * Purely visual: the caller's interactive square/button is never resized by
 * this, so hit targets, drag targets and legal-move dots are untouched.
 */
export function PieceImage({
  set,
  piece,
  color,
  className,
  fill = false,
}: {
  set: PieceSetOption;
  piece: PieceSymbol;
  color: Color;
  className?: string;
  /**
   * Showcase mode — one piece shown on its own (the Piece Library, the
   * set picker), where each should fill its slot rather than sit at its
   * on-board relative scale. The board and the customize preview leave
   * this off so the whole-set hierarchy reads.
   */
  fill?: boolean;
}) {
  const folder = set.folder ? `${set.folder}/` : "";
  const shade = color === "w" ? "light" : "dark";
  const heightPct = fill ? 94 : (set.opticalScale[piece] ?? 0.9) * 100;

  return (
    <img
      src={`/pieces/${folder}${shade}/${PIECE_FILE_NAME[piece]}.svg`}
      alt={`${shade} ${piece}`}
      // Real intrinsic dimensions as HTML attributes give the browser an
      // unambiguous aspect ratio to scale from (see PieceSetOption docs).
      width={set.intrinsicSize.width}
      height={set.intrinsicSize.height}
      style={{ width: "100%", height: `${heightPct}%`, objectFit: "contain" }}
      className={className}
      draggable={false}
    />
  );
}
