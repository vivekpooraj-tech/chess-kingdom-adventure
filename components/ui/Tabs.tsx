"use client";

import { useId, useRef, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — Tabs (UI-2B).
 *
 * A restrained underline tab strip for page-level section switching (Learn:
 * Journey / Learn Chess / Train the Mind; Profile: Overview / Achievements
 * / …; Game Review: Board / Mistakes).
 *
 * Controlled. `Tabs` renders only the strip; render the active panel
 * yourself and wrap it in `<TabPanel tabsId value activeValue>` so the
 * ARIA relationships line up.
 *
 * Keyboard: ←/→ (or ↑/↓) move between tabs with a roving tabindex, Home/End
 * jump to the ends, Enter/Space aren't needed (selection follows focus).
 * The active indicator animates with --motion-standard and collapses under
 * prefers-reduced-motion.
 */
export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  items,
  value,
  onChange,
  id,
  ariaLabel,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Shared id base so panels can reference the tabs (defaults to a generated id). */
  id?: string;
  ariaLabel: string;
  className?: string;
}) {
  const generated = useId();
  const baseId = id ?? generated;
  const listRef = useRef<HTMLDivElement | null>(null);

  function focusTab(index: number) {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])');
    if (!buttons || buttons.length === 0) return;
    const clamped = (index + buttons.length) % buttons.length;
    buttons[clamped].focus();
    buttons[clamped].click();
  }

  function onKeyDown(e: React.KeyboardEvent, currentIndex: number) {
    const enabled = items.filter((t) => !t.disabled);
    const pos = enabled.findIndex((t) => t.value === items[currentIndex].value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = enabled[(pos + 1) % enabled.length];
      focusTab(items.findIndex((t) => t.value === next.value));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = enabled[(pos - 1 + enabled.length) % enabled.length];
      focusTab(items.findIndex((t) => t.value === prev.value));
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(items.findIndex((t) => t.value === enabled[0].value));
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(items.findIndex((t) => t.value === enabled[enabled.length - 1].value));
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "flex w-full items-stretch gap-1 overflow-x-auto border-b border-border",
        "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {items.map((tab, i) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${baseId}-tab-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={clsx(
              "relative min-h-[44px] flex-none whitespace-nowrap px-4 font-classic-body text-sm transition-colors duration-[120ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-t-[var(--radius-sm)]",
              tab.disabled && "cursor-not-allowed opacity-40",
              selected ? "font-semibold text-text" : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab.label}
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-[opacity,transform] duration-[220ms] ease-out",
                selected ? "bg-primary opacity-100" : "bg-primary opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Wrap the active panel content so the ARIA relationships resolve. */
export function TabPanel({
  tabsId,
  value,
  activeValue,
  children,
  className,
}: {
  /** Same value passed as `id` to <Tabs> (or the generated one — safest to pass an explicit id). */
  tabsId: string;
  value: string;
  activeValue: string;
  children: ReactNode;
  className?: string;
}) {
  if (value !== activeValue) return null;
  return (
    <div
      role="tabpanel"
      id={`${tabsId}-panel-${value}`}
      aria-labelledby={`${tabsId}-tab-${value}`}
      tabIndex={0}
      className={clsx("focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
