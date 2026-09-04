"use client";

import { useRef, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — Segmented control (UI-2B).
 *
 * A compact 2–4 option single-select — the Parent Dashboard child switcher,
 * a time-control picker, a small category filter. NOT the same thing as
 * page-level Tabs (which switch whole sections and get full tab ARIA).
 *
 * Rendered as a `radiogroup`; keyboard arrows move the selection. A sunken
 * track with a gold active segment; the active state also carries a check
 * for screen readers via `aria-checked`, so it isn't colour-only.
 *
 * Phone: the track scrolls horizontally if the options don't fit.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function move(delta: number) {
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + delta + options.length) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => {
      ref.current
        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
        [options.findIndex((o) => o.value === next.value)]?.focus();
    });
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        "inline-flex max-w-full items-stretch gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface-sunken p-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              }
            }}
            className={clsx(
              "flex-none whitespace-nowrap rounded-[var(--radius-sm)] font-classic-body font-medium transition-colors duration-[120ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
              size === "sm" ? "min-h-[36px] px-3 text-xs" : "min-h-[44px] px-4 text-sm",
              selected
                ? "bg-primary text-primary-ink"
                : "text-text-muted hover:text-text hover:bg-surface"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
