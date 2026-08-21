import clsx from "clsx";

/**
 * Shared page shell for primary tabs. On phones content stays readable;
 * on tablet/desktop it expands to use the full width beside the sidebar nav
 * (chess.com-style dashboard layout, not a centered phone column).
 */
export function TabPageShell({
  children,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <main
      className={clsx(
        "layout-shell-main min-h-screen bg-premium-midnight px-4 sm:px-6 tablet:px-8 pt-6 tablet:pt-8 pb-24 tablet:pb-8",
        className
      )}
    >
      <div className={clsx("mx-auto w-full max-w-7xl flex flex-col gap-6 tablet:gap-8", contentClassName)}>
        {children}
      </div>
    </main>
  );
}
