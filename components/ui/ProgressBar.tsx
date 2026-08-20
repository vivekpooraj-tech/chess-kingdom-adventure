/**
 * Chess Mind design system — ProgressBar. Extracted from the pattern that
 * was hand-duplicated in HomeHeader and Profile (a labeled thin gradient
 * bar over a translucent track) so every progress indicator in the app
 * looks and behaves identically.
 */
export function ProgressBar({
  percent,
  className = "",
}: {
  /** 0-100, clamped. */
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`h-1.5 w-full rounded-full bg-white/10 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-premium-goldMuted to-premium-gold transition-[width] duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
