/**
 * Chess Mind design system — ProgressRing (UI-2B).
 *
 * A lightweight SVG ring for "Day 3 / 30", module completion, streak
 * progress. No dependency, no endless animation: the arc grows once on
 * mount (motion-standard) via a CSS transition on `stroke-dashoffset`,
 * which the global `prefers-reduced-motion` rule collapses to instant.
 *
 * Sizes: sm 32 / md 56 / lg 96.
 */
export type ProgressRingSize = "sm" | "md" | "lg";

const DIM: Record<ProgressRingSize, { box: number; stroke: number; value: string; label: string }> = {
  sm: { box: 32, stroke: 3, value: "text-[10px]", label: "text-[8px]" },
  md: { box: 56, stroke: 4, value: "text-sm", label: "text-[9px]" },
  lg: { box: 96, stroke: 6, value: "text-xl", label: "text-[10px]" },
};

export function ProgressRing({
  value,
  size = "md",
  showValue = false,
  label,
  ariaLabel,
  className,
}: {
  /** 0–100, clamped. */
  value: number;
  size?: ProgressRingSize;
  /** Render "N%" in the centre. */
  showValue?: boolean;
  /** A short centre label under the value (e.g. "Day"). */
  label?: string;
  /** Overrides the derived aria-label. */
  ariaLabel?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const { box, stroke, value: valueClass, label: labelClass } = DIM[size];
  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div
      className={`relative inline-flex flex-none items-center justify-center ${className ?? ""}`}
      style={{ width: box, height: box }}
      role="img"
      aria-label={ariaLabel ?? `${pct}% complete`}
    >
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset var(--motion-standard) cubic-bezier(0.2,0,0,1)" }}
        />
      </svg>
      {(showValue || label) && (
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          {showValue && (
            <span className={`font-classic-display font-semibold text-text ${valueClass}`}>
              {pct}
              <span className="text-text-muted">%</span>
            </span>
          )}
          {label && (
            <span className={`font-classic-body uppercase tracking-wide text-text-muted ${labelClass}`}>
              {label}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
