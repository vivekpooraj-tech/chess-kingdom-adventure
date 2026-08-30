import { Screen, type ScreenMaxWidth } from "@/components/layout/Screen";

/**
 * Shared shell for the primary tab pages (Home / Puzzles / Play / Learn /
 * More). Now a thin pass-through over <Screen> — kept as a named component
 * so the tab pages read intentionally and so a future tab-only concern has
 * one place to live.
 */
export function TabPageShell({
  children,
  className,
  contentClassName,
  maxWidth = "full",
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: ScreenMaxWidth;
}) {
  return (
    <Screen maxWidth={maxWidth} className={className} contentClassName={contentClassName}>
      {children}
    </Screen>
  );
}
