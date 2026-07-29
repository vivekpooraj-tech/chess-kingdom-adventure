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
  roundTimeMs = 3500,
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

      <div