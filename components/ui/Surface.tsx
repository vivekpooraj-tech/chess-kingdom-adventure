import { forwardRef, type ElementType, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Chess Mind design system — Surface (UI-2B).
 *
 * The one card/panel primitive. Replaces the conceptual role split across
 * PrimaryCard / SecondaryCard / CompactCard and the ~9 hand-written card
 * treatments the UI-1 audit found. Those components are NOT removed yet —
 * screens migrate to `<Surface>` one at a time.
 *
 *   elevation="flat"    default card — semantic surface + a 1px border,
 *                       no large shadow. Most surfaces are flat.
 *   elevation="raised"  the ONE focal surface on a screen — surface-raised,
 *                       a gold hairline, and the card shadow.
 *   elevation="sunken"  an inset well — list rows, a board frame, a
 *                       read-only region.
 *   elevation="warm"    the single "paper" surface (Daily Challenge, a
 *                       parent report) — warm ivory ground, dark ink.
 *
 * `interactive` adds a pointer cursor, a restrained hover treatment on
 * pointer devices (via the Tailwind `hover:` variant, which only applies
 * on real hover-capable pointers), a gold focus ring, and one consistent
 * press (scale, --motion-fast). It never blocks input and it respects
 * prefers-reduced-motion (the global rule in globals.css collapses the
 * transition). Pass `as="button"` / `as={Link}` for a real clickable
 * element — `interactive` alone does not add semantics.
 */
export type SurfaceElevation = "flat" | "raised" | "sunken" | "warm";

type SurfaceOwnProps = {
  elevation?: SurfaceElevation;
  interactive?: boolean;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

const ELEVATION: Record<SurfaceElevation, string> = {
  flat: "bg-surface border border-border",
  raised: "bg-surface-raised border border-border-strong shadow-[var(--shadow-card)]",
  sunken: "bg-surface-sunken border border-border",
  warm: "bg-surface-warm border border-black/10 text-[color:var(--bg)]",
};

export const Surface = forwardRef<
  HTMLElement,
  SurfaceOwnProps & Omit<React.HTMLAttributes<HTMLElement>, "color">
>(function Surface({ elevation = "flat", interactive = false, as, className, children, ...rest }, ref) {
  const Comp = (as ?? "div") as ElementType;
  return (
    <Comp
      ref={ref}
      className={clsx(
        "rounded-[var(--radius-md)]",
        ELEVATION[elevation],
        interactive && [
          "cursor-pointer select-none",
          "transition-[transform,border-color,background-color] duration-[120ms] ease-out",
          "hover:border-border-strong",
          "active:scale-[0.985]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        ],
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
});
