import clsx from "clsx";

/**
 * Shared full-screen modal backdrop + panel (Phase 2 responsive refactor).
 *
 * Fixes the previous `items-center` overlays that clipped a tall panel on a
 * short / landscape screen with no way to scroll to the buttons:
 *   - the backdrop itself scrolls (`overflow-y-auto`), so nothing is ever
 *     unreachable
 *   - `my-auto` centres the panel when it fits and lets it start at the top
 *     and scroll when it doesn't
 *   - vertical padding respects the device safe-area insets
 *   - `overscroll-contain` stops the scroll chaining to the page behind
 */
export function ModalOverlay({
  children,
  ariaLabel,
  className,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  /** Extra classes on the panel. */
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-premium-midnightDeep/80 px-4 backdrop-blur-sm [padding-block:max(1.5rem,env(safe-area-inset-top))_max(1.5rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={clsx(
          "my-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-premiumCard border border-premium-gold/20 bg-premium-navy p-6 text-center shadow-premiumGlow",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
