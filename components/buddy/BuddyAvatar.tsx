"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

interface BuddyAvatarProps {
  emoji: string;
  size?: "sm" | "md" | "lg";
  talking?: boolean;
}

export function BuddyAvatar({ emoji, size = "md", talking = false }: BuddyAvatarProps) {
  const sizeClass = { sm: "w-14 h-14 text-3xl", md: "w-24 h-24 text-5xl", lg: "w-40 h-40 text-7xl" }[
    size
  ];

  return (
    <motion.div
      className={clsx(
        "rounded-full bg-gradient-to-br from-kingdom-sky to-kingdom-royal",
        "flex items-center justify-center shadow-toy select-none",
        sizeClass
      )}
      animate={talking ? { scale: [1, 1.08, 1] } : { y: [0, -8, 0] }}
      transition={
        talking
          ? { duration: 0.5, repeat: Infinity }
          : { duration: 3, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <span>{emoji}</span>
    </motion.div>
  );
}
