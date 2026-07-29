"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

export interface DragToTargetConfig {
  /** The prompt shown at the top, e.g. "Move the Pawn straight ahead!" */
  prompt: string;
  /** Emoji/glyph for the draggable piece. */
  pieceGlyph: string;
  /** Grid of target cells; `correct: true` marks the winning cell(s). */
  grid: { row: number; col: number; correct: boolean }[];
  rows: number;
  cols: number;
  /** Starting cell for the piece. */
  start: { row: number; col: number };
  onComplete: (success: boolean) => void;
}

/**
 * One config-driven mechanic engine powering many "mini-games" (Pawn Race,
 * Knight Jump, Bishop Laser, etc. all reuse this with different grid/glyph
 * config) — see Technical Architecture doc for why this beats hand-building
 * each variant as a separate codebase.
 */
export function DragToTarget({
  prompt,
  pieceGlyph,
  grid,
  rows,
  cols,
  start,
  onComplete,
}: DragToTargetConfig) {
  const [piecePos, setPiecePos] = useState(start);
  const [result, setResult] = useState<"idle" | "correct" | "incorrect">("idle");

  const cellSize = 72;

  function handleCellTap(row: number, col: number) {
    if (result !== "idle") return;
    const target = grid.find((c) => c.row === row && c.col === col);
    setPiecePos({ row, col });
    if (target?.correct) {
      setResult("correct");
      setTimeout(() => onComplete(true), 600);
    } else {
      setResult("incorrect");
      setTimeout(() => {
        setResult("idle");
        setPiecePos(start);
      }, 500);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-display text-2xl text-kingdom-night text-center">{prompt}</p>
      <div
        className="grid gap-1 bg-kingdom-sky/20 p-2 rounded-card"
        style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
      >
        {Array.from({ length: rows }).flatMap((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const isTarget = grid.some((c) => c.row === row && c.col === col && c.correct);
            const hasPiece = piecePos.row === row && piecePos.col === col;
            return (
              <button
                key={`${row}-${col}`}
                onClick={() => handleCellTap(row, col)}
                className={clsx(
                  "rounded-md flex items-center justify-center text-3xl transition-colors",
                  "bg-white/70 hover:bg-white",
                  isTarget && result === "idle" && "ring-2 ring-kingdom-gold/60"
                )}
                style={{ width: cellSize, height: cellSize }}
              >
                {hasPiece && (
                  <motion.span
                    animate={
                      result === "correct"
                        ? { scale: [1, 1.3, 1] }
                        : result === "incorrect"
                        ? { x: [0, -6, 6, -6, 0] }
                        : {}
                    }
                    transition={{ duration: 0.4 }}
                  >
                    {pieceGlyph}
                  </motion.span>
                )}
              </button>
            );
          })
        )}
      </div>
      {result === "correct" && (
        <p className="font-display text-xl text-kingdom-forest">Yes! Perfect move! 🎉</p>
      )}
      {result === "incorrect" && (
        <p className="font-display text-xl text-kingdom-coral">Not quite — try again!</p>
      )}
    </div>
  );
}
