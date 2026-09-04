import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — PageHeader (UI-2A foundation, refined UI-2B).
 *
 * The standard top of a page: a Fraunces title, optional Source Sans
 * subtitle, an optional right-aligned action, an optional breadcrumb, and
 * an optional tabs slot (a <Tabs> strip) that sits flush under the title
 * block. Reusable primitive only — no page is migrated to it yet.
 *
 * Responsive: on desktop/tablet the action sits to the right of the title;
 * on phone the row wraps so the action drops below.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
  tabs,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned control (a button, a segmented switch, a link). */
  action?: ReactNode;
  /** Rendered above the title — e.g. "Academy / Openings". */
  breadcrumb?: ReactNode;
  /** A <Tabs> strip rendered flush under the header. */
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("flex w-full flex-col gap-3", className)}>
      {breadcrumb && (
        <div className="font-classic-body text-xs text-text-muted">{breadcrumb}</div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-classic-display text-[clamp(1.375rem,1.2rem+0.9vw,1.875rem)] leading-tight tracking-tight text-text">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 font-classic-body text-[clamp(0.9rem,0.86rem+0.18vw,1.0625rem)] leading-relaxed text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex-none">{action}</div>}
      </div>
      {tabs}
    </header>
  );
}
