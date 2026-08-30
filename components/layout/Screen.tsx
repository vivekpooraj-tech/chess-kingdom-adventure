import clsx from "clsx";

/**
 * The one adaptive page shell for Chess Mind (Phase 2 responsive refactor).
 *
 * Replaces the two older patterns:
 *   - TabPageShell (max-w-7xl + is-tablet-gated padding)
 *   - the raw `<main className="… flex flex-col items-center … max-w-md">`
 *     centred column that stayed 448px wide even on a 1920px desktop.
 *
 * Responsibilities, all CSS-driven (no is-phone / is-tablet gating):
 *   - min viewport height + premium background
 *   - one fluid horizontal gutter (.screen-x → clamp(1rem, 4vw, 2.5rem))
 *   - status-bar-safe top padding (.pt-safe)
 *   - bottom padding that always clears the fixed PrimaryNav + device inset
 *     (.pb-nav-safe) — so pages never hand-roll pb-24
 *   - a centred content column whose max width matches the page's intent
 *   - a container context (.cq) so nested .auto-grid measures this column
 *
 * `maxWidth` is about CONTENT INTENT, not device:
 *   compact — a single reading/detail column (lesson text, a form)      ~42rem
 *   medium  — settings / profile: grouped cards, still one comfortable    ~56rem
 *             column on desktop
 *   wide    — a dashboard or a collection that should spread into an      ~72rem
 *             adaptive grid on larger screens
 *   full    — the widest dashboards (Home)                               ~80rem
 */
export type ScreenMaxWidth = "compact" | "medium" | "wide" | "full";

const MAX_WIDTH: Record<ScreenMaxWidth, string> = {
  compact: "max-w-2xl", // 42rem
  medium: "max-w-4xl", // 56rem
  wide: "max-w-6xl", // 72rem
  full: "max-w-7xl", // 80rem
};

export function Screen({
  children,
  maxWidth = "wide",
  className,
  contentClassName,
  align = "stretch",
}: {
  children: React.ReactNode;
  maxWidth?: ScreenMaxWidth;
  /** Extra classes on the <main> element. */
  className?: string;
  /** Extra classes on the centred content column (e.g. a different gap). */
  contentClassName?: string;
  /** `center` keeps a compact column visually centred on wide screens
   * (splash-style pages); the default `stretch` lets content fill the column. */
  align?: "stretch" | "center";
}) {
  return (
    <main
      className={clsx(
        "screen-x pt-safe pb-nav-safe min-h-screen bg-premium-midnight",
        align === "center" && "flex flex-col items-center justify-center",
        className
      )}
    >
      <div
        className={clsx("cq screen-stack mx-auto w-full", MAX_WIDTH[maxWidth], contentClassName)}
      >
        {children}
      </div>
    </main>
  );
}
