import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — EmptyState (UI-2B).
 *
 * Replaces the bare inline sentences the UI-1 audit found ("No Chess Mind
 * challenges solved yet.", "No lessons completed yet — …"). A slot for an
 * icon / Ollie / illustration, a heading, a description, and an optional
 * CTA. No new artwork — pass whatever visual the screen already has (an
 * SVG icon, an existing BuddyAvatar) via `media`.
 *
 *   tone="neutral"     — "Nothing here yet."
 *   tone="encouraging" — a warmer nudge; the caller may pass an Ollie
 *                        visual as `media`.
 *   tone="error"       — a soft "couldn't load" (ErrorState is the fuller
 *                        version for page-level failures).
 */
export type EmptyStateTone = "neutral" | "encouraging" | "error";

export function EmptyState({
  title,
  description,
  media,
  action,
  tone = "neutral",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Icon, avatar or illustration. */
  media?: ReactNode;
  /** A <Button> or a link — real interactive semantics. */
  action?: ReactNode;
  tone?: EmptyStateTone;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex w-full flex-col items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-6 py-10 text-center",
        className
      )}
    >
      {media && (
        <div
          className={clsx(
            "flex h-12 w-12 items-center justify-center rounded-full",
            tone === "error"
              ? "bg-danger-soft text-danger"
              : tone === "encouraging"
                ? "bg-primary-soft text-primary"
                : "bg-surface-raised text-text-muted"
          )}
        >
          {media}
        </div>
      )}
      <h3 className="font-classic-display text-base text-text">{title}</h3>
      {description && (
        <p className="max-w-sm font-classic-body text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
