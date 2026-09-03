import type { PieceSymbol, Color } from "chess.js";
import clsx from "clsx";
import { PieceSetOption } from "@/lib/types";
import { PIECE_FILE_NAME } from "@/content/pieceSets";

/**
 * The one place a chess-piece asset becomes pixels.
 *
 * Fills its nearest `position: relative` parent (a board square, a picker
 * tile, etc.) via `absolute inset-0`, then caps the SVG with
 * `max-height: opticalScale × 100%` of that box. Width follows each file's
 * natural aspect ratio. This avoids the flex-child percentage-height trap
 * that was leaving pieces at their tiny intrinsic SVG size.
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
      <img
        src={`/pieces/${folder}${shade}/${PIECE_FILE_NAME[piece]}.svg`}
        alt={`${shade} ${piece}`}
        className="block object-contain"
        style={{
          maxHeight: `${sizePct}%`,
          maxWidth: fill ? "94%" : "92%",
          width: "auto",
          height: "auto",
        }}
        draggable={false}
      />
    </div>
  );
}
