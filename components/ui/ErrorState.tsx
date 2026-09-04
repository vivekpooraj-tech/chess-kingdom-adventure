"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Button } from "./Button";

/**
 * Chess Mind design system — ErrorState (UI-2B).
 *
 * A calm failure surface — danger is a STATE colour here, never the whole
 * card. Replaces the ad-hoc red boxes for page-level failures; inline
 * form-field errors stay inline.
 *
 *   variant="page"   — full-surface: title, description, Retry, optional
 *                      "Go home".
 *   variant="inline" — a compact one-line notice for a section/form.
 */
export function ErrorState({
  variant = "page",
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  showHome = true,
  homeHref = "/kingdom-map",
  className,
  children,
}: {
  variant?: "page" | "inline";
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  showHome?: boolean;
  homeHref?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={clsx(
          "flex items-start gap-2 rounded-[var(--radius-sm)] border border-danger-line bg-danger-soft px-3.5 py-2.5",
          className
        )}
      >
        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-danger" />
        <div className="min-w-0 font-classic-body text-sm text-danger">
          {title && <p className="font-semibold">{title}</p>}
          {description && <p className="text-text-secondary">{description}</p>}
          {children}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 inline-flex min-h-[36px] items-center rounded font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={clsx(
        "flex w-full flex-col items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-6 py-12 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d="M12 8v5M12 16.5h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h2 className="font-classic-display text-lg text-text">{title ?? "Something went wrong"}</h2>
      <p className="max-w-sm font-classic-body text-sm leading-relaxed text-text-secondary">
        {description ?? "That didn't load. Give it another try."}
      </p>
      {children}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button tone="system" onClick={onRetry} size="md">
            {retryLabel}
          </Button>
        )}
        {showHome && (
          <Link
            href={homeHref}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-border-strong px-5 font-classic-display text-[15px] font-semibold tracking-wide text-text transition-colors duration-[120ms] hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Go home
          </Link>
        )}
      </div>
    </div>
  );
}
