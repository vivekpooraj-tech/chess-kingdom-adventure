"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

// Premium palette confetti — gold/ivory/emerald rather than the bright
// rainbow used elsewhere, so a celebration moment still reads as "premium."
const COLORS = ["#D4AF37", "#F7F3E8", "#34D399", "#B8944A", "#6EE7B7"];

interface ConfettiBurstProps {
  pieceCount?: number;
}

/**
 * Lightweight CSS/Framer confetti burst — capped at ~2s per the design system
 * so reward moments delight without stalling the lesson loop. Swap for a
 * Lottie sequence in the polish pass if budget allows.
 */
export function ConfettiBurst({ pieceCount = 40 }: ConfettiBurstProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: pieceCount }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.3,
        rotate: Math.random() * 360,
        size: 6 + Math.random() * 8,
      })),
    [pieceCount]
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ top: "-5%", opacity: 1, rotate: 0 }}
          animate={{ top: "105%", opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.6, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
