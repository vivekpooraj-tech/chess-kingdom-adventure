import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — Section (UI-2B).
 *
 * Standardises the "eyebrow label + heading + optional description +
 * optional action, then content" pattern that every screen currently
 * hand-rolls a different way (the UI-1 audit found `SectionHeader`, a raw
 * `TEXT.caption uppercase`, and a bespoke `text-[11px] font-semibold
 * uppercase` all in use). `SectionHeader` stays for now; screens move to
 * `<Section>` one at a time.
 *
 *   label       — Source Sans, 12px/600, uppercase, tracked. The eyebrow.
 *   title       — Fraunces, h2 scale (TEXT.heading).
 *   description — Source Sans body.
 *   action      — right-aligned control (a link, a "See all", a button).
 */
export function Section({
  label,
  title,
  description,
  action,
  children,
  className,
  headingLevel = 2,
}: {
  label?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** 2 by default; use 3 for a sub-section under an existing h2. */
  headingLevel?: 2 | 3;
}) {
  const Heading = (headingLevel === 3 ? "h3" : "h2") as "h2" | "h3";
  const hasHeader = label || title || description || action;

  return (
    <section className={clsx("flex w-full flex-col gap-3", className)}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            {label && (
              <p className="font-classic-body text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                {label}
              </p>
            )}
            {title && (
              <Heading className="font-classic-display text-[clamp(1.125rem,1.05rem+0.4vw,1.5rem)] leading-snug text-text">
                {title}
              </Heading>
            )}
            {description && (
              <p className="font-classic-body text-[clamp(0.9rem,0.86rem+0.18vw,1.0625rem)] leading-relaxed text-text-secondary">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex-none">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
