"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { CloseIcon } from "@/components/nav/icons";

/**
 * Chess Mind design system — Sheet (UI-2B).
 *
 * A modal side/bottom sheet for contextual flows — Ollie chat, filters,
 * "Add child", quick settings. It COMPOSES the existing overlay pattern
 * (a `fixed inset-0` backdrop rendered inline, like ModalOverlay) and does
 * NOT change ModalOverlay itself.
 *
 *   phone           → bottom sheet, ≤ 85dvh, rounded top, safe-area bottom.
 *   tablet/desktop  → right-edge panel, full height, width ≈ 28rem.
 *
 * Accessibility: role="dialog", aria-modal, an accessible name (title or
 * `ariaLabel`), Escape closes, focus moves in on open and is restored on
 * close, a lightweight Tab loop keeps focus inside, the page body is
 * scroll-locked while open, and the content region scrolls on its own.
 * Respects prefers-reduced-motion (transition durations collapse globally).
 *
 * No drag-to-dismiss, no gesture dependency.
 */
export function Sheet({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Rendered as the sheet header and used as its accessible name. */
  title?: ReactNode;
  /** Accessible name when there is no visible `title`. */
  ariaLabel?: string;
  children: ReactNode;
  /** Pinned below the scroll region (e.g. a primary action). */
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const labelId = useId();
  // Latch the latest onClose so the key handler stays stable without
  // re-running the whole open effect when the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Body scroll-lock + focus management while open.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    // Move focus into the sheet (the panel itself — it's tabindex -1).
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      // Same scrim as ModalOverlay — a literal hex so the /80 opacity
      // modifier composes (it does not on the var-backed semantic aliases).
      className="fixed inset-0 z-50 bg-premium-midnightDeep/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "fixed flex flex-col bg-surface text-text shadow-[var(--shadow-modal)] outline-none",
          // Phone: bottom sheet.
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-lg)] border-t border-border-strong",
          "motion-safe:animate-[sheet-up_var(--motion-emphasis)_cubic-bezier(0.2,0,0,1)]",
          // Tablet / desktop: right-edge panel.
          "tablet:inset-y-0 tablet:right-0 tablet:left-auto tablet:top-0 tablet:h-full tablet:max-h-none tablet:w-[min(28rem,92vw)]",
          "tablet:rounded-none tablet:border-l tablet:border-t-0",
          "tablet:motion-safe:animate-[sheet-in_var(--motion-emphasis)_cubic-bezier(0.2,0,0,1)]",
          className
        )}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3">
          {title ? (
            <h2 id={labelId} className="font-classic-display text-base text-text truncate">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>

        {footer && (
          <div
            className="flex-none border-t border-border px-4 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
