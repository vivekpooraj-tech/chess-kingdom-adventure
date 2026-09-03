import type { PieceSymbol, Color } from "chess.js";
import clsx from "clsx";
import { PieceSetOption } from "@/lib/types";
import { PIECE_FILE_NAME } from "@/content/pieceSets";

/**
 * The one place a chess-piece asset becomes pixels.
 *
 * Fills its nearest `position: relative` parent via `absolute inset-0`,
 * then places the SVG inside a square slot sized to
 * `opticalScale × 100%` of that parent. `object-fit: contain` scales the
 * artwork to fill the slot while preserving aspect ratio — this works for
 * both large-intrinsic sets (NeoStaunton) and small-intrinsic sets
 * (Wikimedia Classic at 45×45).
 *
 * Purely visual: pointer-events-none so the square button underneath keeps
 * full hit targets, drag targets, and legal-move dots.
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
  const sizePct = fill ? 94 : (set.opticalScale[piece] ?? 0.9) * 100;

  return (
    <div
      className={clsx(
        "absolute inset-0 flex items-center justify-center pointer-events-none",
        className
      )}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: `${sizePct}%`, height: `${sizePct}%` }}
      >
        <img
          src={`/pieces/${folder}${shade}/${PIECE_FILE_NAME[piece]}.svg`}
          alt={`${shade} ${piece}`}
          className="block h-full w-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
