"use client";

import { ChessBoard } from "@/components/board/ChessBoard";
import { PieceImage } from "@/components/board/PieceImage";
import { CheckIcon } from "@/components/nav/icons";
import { getBoardSkin } from "@/content/boardSkins";
import { getPieceSet } from "@/content/pieceSets";
import type { BoardSkinOption, PieceSetOption } from "@/lib/types";
import type { PieceSymbol } from "chess.js";

/**
 * Customize library cards. Every preview is drawn by the same code that draws a real game:
 *   - board cards render the actual <ChessBoard> (the registered skin, wearing the piece set currently
 *     chosen), so a card is exactly what the board looks like in play;
 *   - piece cards render the actual <PieceImage> for the registered set on squares coloured by the
 *     board currently chosen, so contrast and proportions are the real ones.
 * There is no separate preview implementation and no stand-in artwork.
 *
 * Structure: a card is a container with ONE full-card <button> on top (the accessible, 44px+ control)
 * and the preview underneath, marked inert. ChessBoard's squares are buttons themselves, so the card
 * cannot be a button without invalid nesting, and its 64 squares must not become tab stops.
 */

/** A recognisable position (Italian Game, after 1.e4 e5 2.Nf3 Nc6 3.Bc4) so every piece type is on the board. */
export const PREVIEW_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";

/** Pieces shown on a piece card: the tall and the short, so each set's proportions read. */
const PLATE_PIECES: PieceSymbol[] = ["k", "q", "n", "p"];

// `inert` is a real HTML attribute (React 18 passes it through) that the DOM typings here do not list.
const INERT = { inert: "" } as Record<string, string>;

/** Badge straddling the card's top edge (it never covers the preview). Absolutely positioned and always
 * rendered, so selecting never shifts layout. */
function SelectedBadge({ selected }: { selected: boolean }) {
  return (
    <span
      className={`absolute -top-5 right-1 z-[1] inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-premium-midnight/95 px-2 py-0.5 font-classic-body text-[11px] font-semibold text-emerald-300 shadow transition-opacity ${
        selected ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <CheckIcon className="h-3 w-3" />
      Selected
    </span>
  );
}

function cardFrame(selected: boolean) {
  return {
    borderColor: selected ? "#D4AF37" : "rgba(255,255,255,0.10)",
    borderWidth: selected ? 2 : 1,
  } as const;
}

const CARD_CLASS =
  "relative flex min-w-0 flex-col gap-2 rounded-premiumCard border bg-premium-navy/60 p-2.5 transition-colors";
const BUTTON_CLASS =
  "absolute inset-0 z-10 min-h-[44px] w-full rounded-premiumCard focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/70";

export function BoardStyleCard({
  skin,
  pieceSetId,
  selected,
  onSelect,
}: {
  skin: BoardSkinOption;
  pieceSetId: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={CARD_CLASS} style={cardFrame(selected)} data-board-card={skin.id} data-selected={selected}>
      <div className="relative">
        <div className="pointer-events-none" aria-hidden="true" {...INERT}>
          <ChessBoard focusMode readOnly size={200} fen={PREVIEW_FEN} boardSkinId={skin.id} pieceSetId={pieceSetId} />
        </div>
        <SelectedBadge selected={selected} />
      </div>
      <div className="min-w-0">
        <p className="font-classic-display text-sm leading-tight text-premium-ivory">{skin.name}</p>
        {skin.description && (
          <p className="mt-0.5 font-classic-body text-xs leading-snug text-premium-ivory/60">{skin.description}</p>
        )}
      </div>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => onSelect(skin.id)}
        aria-pressed={selected}
        aria-label={`${skin.name} board${selected ? ", selected" : ""}`}
      />
    </div>
  );
}

export function PieceStyleCard({
  set,
  boardSkinId,
  selected,
  onSelect,
}: {
  set: PieceSetOption;
  boardSkinId: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const board = getBoardSkin(boardSkinId);
  const rows = [
    { color: "w" as const, offset: 0 },
    { color: "b" as const, offset: 1 },
  ];
  return (
    <div className={CARD_CLASS} style={cardFrame(selected)} data-piece-card={set.id} data-selected={selected}>
      <div className="relative">
        <div
          className="pointer-events-none grid grid-cols-4 overflow-hidden rounded-md"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)" }}
          aria-hidden="true"
          {...INERT}
        >
          {rows.map(({ color, offset }) =>
            PLATE_PIECES.map((piece, i) => (
              <div
                key={`${color}${piece}`}
                className="relative aspect-square"
                style={{ backgroundColor: (i + offset) % 2 === 1 ? board.darkSquare : board.lightSquare }}
              >
                <PieceImage set={getPieceSet(set.id)} piece={piece} color={color} />
              </div>
            ))
          )}
        </div>
        <SelectedBadge selected={selected} />
      </div>
      <div className="min-w-0">
        <p className="font-classic-display text-sm leading-tight text-premium-ivory">{set.name}</p>
        {set.description && (
          <p className="mt-0.5 font-classic-body text-xs leading-snug text-premium-ivory/60">{set.description}</p>
        )}
      </div>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => onSelect(set.id)}
        aria-pressed={selected}
        aria-label={`${set.name} pieces${selected ? ", selected" : ""}`}
      />
    </div>
  );
}
