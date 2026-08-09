"use client";

import { MotionConfig } from "framer-motion";
import { ReactNode } from "react";

/**
 * MotionConfig relies on React context, so it needs a Client Component
 * boundary — importing it directly into the (Server Component) root layout
 * broke static page-data collection at build time. This thin wrapper is
 * the fix: one small client island instead of the whole layout tree.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
