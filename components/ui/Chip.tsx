"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { CheckIcon, CloseIcon } from "@/components/nav/icons";

/**
 * Chess Mind design system — Chip (UI-2B).
 *
 * One small pill for statuses, tags and filters — replaces the ~6 inline
 * pill treatments the UI-1 audit found ("SOON", "Mate in 1", opening tags,
 * "+N today", the bordered "Solve →" pill). Existing pills stay until their
 * screen is migrated.
 *
 *   tone: neutral | gold | success | danger | info   (colour is a hint,
 *         never the only signal — selected state also shows a check)
 *   size: sm | md
 *   selectable / selected  → renders as a toggle button (`aria-pressed`)
 *   onRemove               → adds a small × affordance
 */
export type ChipTone = "neutral" | "gold" | "success" | "danger" | "info";

const TONE: Record<ChipTone, string> = {
  neutral: "bg-surface text-text-secondary border-border",
  gold: "bg-primary-soft text-primary border-border-strong",
  success: "bg-success-soft text-success border-success-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  info: "bg-info-soft text-info border-info-line",
};

const SIZE = {
  sm: "min-h-[24px] px-2 text-[11px] gap-1",
  md: "min-h-[28px] px-2.5 text-xs gap-1.5",
} as const;

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  size?: "sm" | "md";
  /** Leading icon (an SVG from the icon set — never an emoji). */
  icon?: ReactNode;
  /** Makes the chip a toggle button. */
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Adds a remove affordance. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

export function Chip({
  children,
  tone = "neutral",
  size = "md",
  icon,
  selectable = false,
  selected = false,
  onClick,
  onRemove,
  removeLabel = "Remove",
  className,
}: ChipProps) {
  const base = clsx(
    "inline-flex select-none items-center rounded-[var(--radius-pill)] border font-classic-body font-medium",
    SIZE[size],
    selected ? "bg-primary text-primary-ink border-primary" : TONE[tone],
    selectable && [
      "cursor-pointer transition-[background-color,border-color,color] duration-[120ms]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      !selected && "hover:border-border-strong",
    ],
    className
  );

  const iconSize = size === "sm" ? "h-3 w-3 flex-none" : "h-3.5 w-3.5 flex-none";
  const content = (
    <>
      {selected ? <CheckIcon className={iconSize} /> : icon}
      <span className="truncate">{children}</span>
      {onRemove && (
        // span[role=button] rather than a nested <button> so it stays valid
        // markup even inside a `selectable` chip's <button>.
        <span
          role="button"
          tabIndex={0}
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className="ml-0.5 -mr-1 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <CloseIcon className="h-3 w-3" />
        </span>
      )}
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={base}
      >
        {content}
      </button>
    );
  }

  return <span className={base}>{content}</span>;
}
