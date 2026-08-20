import { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

/** The existing Adventure-mode card (bright, toy shadow) — kept exactly as
 * it was for screens not yet migrated to Phase 10B's premium system. */
export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-card bg-white/90 shadow-toy p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Premium card hierarchy (Phase 10B) — four deliberately different visual
 * weights so a screen doesn't read as one undifferentiated stack of
 * identical rounded boxes ("avoid excessive bubble UI" per the design
 * brief). Pick by what the content actually is, not by habit:
 *   PrimaryCard   — the one hero thing on the screen (max 1 per screen)
 *   SecondaryCard — a supporting feature/section, still a real card
 *   CompactCard   — a stat, a lesson tile, an achievement — small and dense
 *   ListItemRow   — a row in a list (opening, lesson, progress entry)
 */

export function PrimaryCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-premiumCard bg-gradient-to-br from-premium-navyLight via-premium-navy to-premium-midnight",
        "border border-premium-gold/25 shadow-premiumGlow p-6 sm:p-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SecondaryCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-premiumCard bg-premium-navy shadow-premiumCard p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CompactCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-premiumBtn bg-premium-navy/70 border border-white/5 p-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ListItemRowProps extends HTMLAttributes<HTMLDivElement> {
  href?: string;
  /** Renders as a <button> instead of a <Link> — for a row whose click
   * should NOT navigate (e.g. a locked/premium item that opens a paywall
   * instead of the page it represents). Ignored if `href` is also set. */
  onClick?: () => void;
  children: ReactNode;
}

/** Renders as a <Link> when `href` is given (the common case — a list item
 * that navigates somewhere), a <button> when only `onClick` is given,
 * otherwise a plain row. */
export function ListItemRow({ href, onClick, className, children, ...props }: ListItemRowProps) {
  const rowClass = clsx(
    "flex items-center gap-3 rounded-premiumBtn bg-premium-navy/60 hover:bg-premium-navy active:bg-premium-navy active:scale-[0.98] px-4 py-3 transition-[background-color,transform] duration-100",
    className
  );
  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clsx(rowClass, "w-full text-left")}>
        {children}
      </button>
    );
  }
  return (
    <div className={rowClass} {...props}>
      {children}
    </div>
  );
}
