"use client";

import { motion } from "framer-motion";

const SWING_DURATION = 1.4;

/**
 * An original web-slinging hero entrance for the splash screen — built from
 * a generic superhero emoji + a decorative animated "web strand" arc, not
 * any copyrighted character. The web strand doesn't track the hero's exact
 * position frame-by-frame (that would need much fussier coordinate math to
 * get right without visual testing) — it's a single arc that draws itself
 * in via `pathLength`, timed to roughly match the swing, which reads fine
 * as "cast a web and swung in" without needing pixel-perfect sync.
 */
export function WebSwingHero() {
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox="0 0 192 192"
        fill="none"
      >
        <motion.path
          d="M 180 4 Q 60 20 90 128"
          stroke="#D1D5DB"
          strokeWidth={2.5}
          strokeDasharray="5 4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: SWING_DURATION * 0.7, ease: "easeOut" }}
        />
      </svg>
      <motion.div
        initial={{ x: 160, y: -140, rotate: 30, opacity: 0, scale: 0.6 }}
        animate={{
          x: [160, -10, 0],
          y: [-140, 30, 0],
          rotate: [30, -15, 0],
          opacity: 1,
          scale: [0.6, 1.15, 1],
        }}
        transition={{ duration: SWING_DURATION, times: [0, 0.75, 1], ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl"
      >
        🦸
      </motion.div>
    </div>
  );
}
