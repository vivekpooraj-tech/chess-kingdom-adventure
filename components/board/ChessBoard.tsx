"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Chess, Square, PieceSymbol, Color } from "chess.js";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

const PIECE_GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export interface ChessBoardProps {
  /** Starting position; defaults to the standard game start. */
  fen?: string;
  /** Restrict which side the child is allowed to move (useful for puzzles). */
  playableColor?: Color;
  /** Called after every legal move the child makes. */
  onMove?: (opts: { fen: string; san: string; isCheckmate: boolean }) => void;
  /** Called when the child attempts an illegal move — used for AI mistake-explanations. */
  onIllegalAttempt?: (from: Square, to: Square) => void;
  /**
   * Placeholder opponent: when true, the moment it becomes the non-playable
   * side's turn, a random legal move is played for them automatically after
   * a short delay. This exists because the board enforces real chess turn
   * order — without *something* replying, a `playableColor` board only ever
   * allows one move before silently refusing further input (that's the "next
   * move not working" bug this prop fixes). Swap this for the real Stockfish
   * Web Worker per docs/02-technical-architecture.md when that's ready.
   */
  autoRespond?: boolean;
  /** Visual size in px (square board). */
  size?: number;
}

/**
 * Click-to-select-then-move interaction (tap piece -> tap destination).
 * Chosen over full drag-and-drop for the v1 slice: it's far more reliable on
 * touch devices for small hands than precise drag targeting, and is easier to
 * make accessible (keyboard/switch-control friendly later). React DnD can be
 * layered on top later as an alternate input mode if desired.
 */
export function ChessBoard({
  fen,
  playableColor,
  onMove,
  onIllegalAttempt,
  autoRespond = false,
  size = 480,
}: ChessBoardProps) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const [renderTick, forceRender] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Placeholder opponent — see the `autoRespond` doc comment above.
  useEffect(() => {
    if (!autoRespond || !playableColor) return;
    if (game.isGameOver()) return;
    if (game.turn() === playableColor) return; // still the child's turn — nothing to do

    const timer = setTimeout(() => {
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) return;
      const pick = moves[Math.floor(Math.random() * moves.length)];
      const result = game.move({ from: pick.from, to: pick.to, promotion: "q" });
      if (result) {
        setLastMove({ from: pick.from as Square, to: pick.to as Square });
        forceRender((n) => n + 1);
      }
    }, 500); // brief pause so the opponent's reply doesn't feel instant/robotic

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, autoRespond, playableColor, game]);

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<Square>();
    const moves = game.moves({ square: selected, verbose: true });
    return new Set(moves.map((m) => m.to as Square));
  }, [selected, game]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      const piece = game.get(square);

      // Selecting a piece
      if (!selected) {
        if (piece && (!playableColor || piece.color === playableColor)) {
          setSelected(square);
        }
        return;
      }

      // Clicking the same square again = deselect
      if (square === selected) {
        setSelected(null);
        return;
      }

      // Attempting a move
      if (legalTargets.has(square)) {
        const move = game.move({ from: selected, to: square, promotion: "q" });
        setSelected(null);
        setLastMove({ from: selected, to: square });
        forceRender((n) => n + 1);
        if (move) {
          onMove?.({ fen: game.fen(), san: move.san, isCheckmate: game.isCheckmate() });
        }
      } else if (piece && (!playableColor || piece.color === playableColor)) {
        // Re-select a different one of your own pieces
        setSelected(square);
      } else {
        onIllegalAttempt?.(selected, square);
        setSelected(null);
      }
    },
    [selected, legalTargets, game, playableColor, onMove, onIllegalAttempt]
  );

  const squareSize = size / 8;

  return (
    <div
      className="rounded-card overflow-hidden shadow-toy select-none"
      style={{ width: size, height: size }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {RANKS.map((rank, rIdx) =>
          FILES.map((file, fIdx) => {
            const square = `${file}${rank}` as Square;
            const piece = game.get(square);
            const isDark = (rIdx + fIdx) % 2 === 1;
            const isSelected = selected === square;
            const isLegalTarget = legalTargets.has(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);

            return (
              <button
                key={square}
                onClick={() => handleSquareClick(square)}
                className={clsx(
                  "relative flex items-center justify-center transition-colors",
                  isDark ? "bg-kingdom-forest/70" : "bg-kingdom-leaf/30",
                  isSelected && "ring-4 ring-inset ring-kingdom-gold",
                  isLastMove && !isSelected && "bg-kingdom-gold/30"
                )}
                style={{ width: squareSize, height: squareSize, fontSize: squareSize * 0.65 }}
                aria-label={`${square}${piece ? ` — ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
              >
                {isLegalTarget && !piece && (
                  <span className="absolute w-1/3 h-1/3 rounded-full bg-kingdom-gold/70" />
                )}
                {isLegalTarget && piece && (
                  <span className="absolute inset-1 rounded-full ring-4 ring-kingdom-coral/70" />
                )}
                <AnimatePresence>
                  {piece && (
                    <motion.span
                      key={`${square}-${piece.type}-${piece.color}`}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="drop-shadow-sm"
                    >
                      {PIECE_GLYPH[piece.color][piece.type]}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}