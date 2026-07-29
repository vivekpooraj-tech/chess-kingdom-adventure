"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export interface TimedReactionConfig {
  /** The prompt shown at the top, e.g. "Tap the glowing square before time runs out!" */
  prompt: string;
  pieceGlyph: string;
  rows: number;
  cols: number;
  /** How many successful rounds are needed to complete the game. */
  rounds?: number;
  /** How long the child has to react, in ms. */
  roundTimeMs?: number;
  onComplete: (success: boolean) => void;
}

/**
 * Config-driven mechanic engine powering "Pawn Village Sprint", "Knight Jump
 * Time Attack", "Diagonal Catch", "Corridor Sprint", "Queen's Power Sweep",
 * "Race to Castle" etc. from the mini-game catalog
 * (content/minigame-catalog.ts) — same pattern as DragToTarget: one
 * component, many content variations.
 *
 * Each round highlights one random target cell; the child has `roundTimeMs`
 * to tap it. A correct tap in time advances to the next round. A wrong tap
 * or a timeout just retries the same round (no penalty/lives system for
 * this age range — the goal is confidence-building, not failure states).
 */
export function TimedReaction({
  prompt,
  pieceGlyph,
  rows,
  cols,
  rounds = 3,
  roundTimeMs = 2200,
  onComplete,
}: TimedReactionConfig) {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => randomCell(rows, cols));
  const [feedback, setFeedback] = useState<"idle" | "correct" | "miss">("idle");
  const [progress, setProgress] = useState(1); // 1 -> 0 over roundTimeMs
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const frameRef = useRef<number>();
  const startRef = useRef<number>(0);

  function randomCell(r: number, c: number) {
    return { row: Math.floor(Math.random() * r), col: Math.floor(Math.random() * c) };
  }

  function startRound() {
    setFeedback("idle");
    setTarget(randomCell(rows, cols));
    setProgress(1);
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const remaining = Math.max(0, 1 - elapsed / roundTimeMs);
      setProgress(remaining);
      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    timeoutRef.current = setTimeout(() => {
      setFeedback("miss");
      setTimeout(startRound, 500);
    }, roundTimeMs);
  }

  useEffect(() => {
    startRound();
    return () => {
      clearTimeout(timeoutRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function handleTap(row: number, col: number) {
    if (feedback !== "idle") return;
    clearTimeout(timeoutRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (row === target.row && col === target.col) {
      setFeedback("correct");
      if (round + 1 >= rounds) {
        setTimeout(() => onComplete(true), 500);
      } else {
        setTimeout(() => setRound((r) => r + 1), 500);
      }
    } else {
      setFeedback("miss");
      setTimeout(startRound, 500);
    }
  }

  const cellSize = 64;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="font-display text-2xl text-kingdom-night text-center">{prompt}</p>

      <div className="w-48 h-2 rounded-full bg-kingdom-night/10 overflow-hidden">
        <motion.div
          className="h-full bg-kingdom-gold"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.05, ease: "linear" }}
        />
      </div>

      <div
        className="grid gap-1 bg-kingdom-sky/20 p-2 rounded-card"
        style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
      >
        {Array.from({ length: rows }).flatMap((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const isTarget = target.row === row && target.col === col;
            return (
              <button
                key={`${row}-${col}`}
                onClick={() => handleTap(row, col)}
                className={clsx(
                  "rounded-md flex items-center justify-center text-3xl transition-colors relative",
                  "bg-white/70 hover:bg-white"
                )}
                style={{ width: cellSize, height: cellSize }}
              >
                <AnimatePresence>
                  {isTarget && feedback === "idle" && (
                    <motion.span
                      key="target"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="absolute inset-0 flex items-center justify-center rounded-md ring-4 ring-kingdom-gold"
                    >
                      {pieceGlyph}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })
        )}
      </div>

      <p className="font-body text-kingdom-night/60">
        Round {Math.min(round + 1, rounds)}/{rounds}
      </p>

      {feedback === "correct" && (
        <p className="font-display text-lg text-kingdom-forest">Lightning fast! ⚡</p>
      )}
      {feedback === "miss" && (
        <p className="font-display text-lg text-kingdom-coral">So close — try again!</p>
      )}
    </div>
  );
}