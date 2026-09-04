"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — Avatar (UI-2B).
 *
 * One component for the child avatar, opponent avatar, profile avatar and
 * the Ollie placeholder — replacing the three hand-rolled
 * `linear-gradient(135deg,…)` circles the UI-1 audit found in HomeHeader /
 * More / Parent Dashboard.
 *
 * Content precedence: `src` (with graceful fallback) → `emoji` (the current
 * avatar data still stores an emoji + colourFrom/colourTo) → `initial` →
 * a neutral placeholder. NOT new artwork — it renders whatever the data
 * already provides.
 *
 * Sizes: xs 24 / sm 40 / md 56 / lg 72.
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<AvatarSize, number> = { xs: 24, sm: 40, md: 56, lg: 72 };
const TEXT_CLASS: Record<AvatarSize, string> = {
  xs: "text-[13px]",
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function Avatar({
  src,
  alt,
  emoji,
  initial,
  colorFrom,
  colorTo,
  size = "md",
  ring = false,
  className,
  children,
}: {
  src?: string | null;
  alt?: string;
  emoji?: string | null;
  initial?: string | null;
  /** Gradient background (from the existing AvatarOption data). */
  colorFrom?: string;
  colorTo?: string;
  size?: AvatarSize;
  ring?: boolean;
  className?: string;
  /** Escape hatch for a custom inner node (e.g. a rendered icon). */
  children?: ReactNode;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const px = SIZE_PX[size];
  const showImg = src && !imgFailed;

  const gradient =
    colorFrom && colorTo
      ? `linear-gradient(135deg, ${colorFrom}, ${colorTo})`
      : "var(--surface-raised)";

  return (
    <span
      className={clsx(
        "relative inline-flex flex-none items-center justify-center overflow-hidden rounded-full",
        "leading-none select-none",
        TEXT_CLASS[size],
        ring && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
        className
      )}
      style={{ width: px, height: px, background: showImg ? undefined : gradient }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt ?? ""}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
          draggable={false}
        />
      ) : (
        children ??
        (emoji ? (
          <span aria-hidden={!alt}>{emoji}</span>
        ) : initial ? (
          <span className="font-classic-display text-text" aria-hidden={!alt}>
            {initial.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <span aria-hidden="true" className="h-1/2 w-1/2 rounded-full bg-border-strong" />
        ))
      )}
    </span>
  );
}
