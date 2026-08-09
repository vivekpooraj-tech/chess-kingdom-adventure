import type { PieceSymbol } from "chess.js";

// Compact outline/filled Unicode glyphs rather than the child's chosen SVG
// piece set — at tray size (captured pieces are shown ~16px) the detailed
// art doesn't read cleanly, and every chess app uses plain glyphs here.
const WHITE_GLYPH: Record<PieceSymbol, string> = {
  p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔",
};
const BLACK_GLYPH: Record<PieceSymbol, string> = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

function sortByValue(pieces: PieceSymbol[]): PieceSymbol[] {
  return [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

function materialTotal(pieces: PieceSymbol[]): number {
  return pieces.reduce((sum, p) => sum + VALUE[p], 0);
}

/** One row: the pieces a side has captured (rendered in the OPPONENT's
 * glyph color, since that's whose pieces they are), plus material lead. */
export function CapturedPieces({
  capturedByWhite,
  capturedByBlack,
}: {
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
}) {
  const lead = materialTotal(capturedByWhite) - materialTotal(capturedByBlack);

  return (
    <div className="flex flex-col gap-1.5 font-classic-body text-sm">
      <div className="flex items-center gap-1 min-h-[20px]">
        {sortByValue(capturedByWhite).map((p, i) => (
          <span key={i} className="text-premium-ivory/70 leading-none">
            {BLACK_GLYPH[p]}
          </span>
        ))}
        {lead > 0 && <span className="text-premium-gold text-xs ml-1">+{lead}</span>}
      </div>
      <div className="flex items-center gap-1 min-h-[20px]">
        {sortByValue(capturedByBlack).map((p, i) => (
          <span key={i} className="text-premium-ivory/40 leading-none">
            {WHITE_GLYPH[p]}
          </span>
        ))}
        {lead < 0 && <span className="text-premium-gold text-xs ml-1">+{-lead}</span>}
      </div>
    </div>
  );
}
