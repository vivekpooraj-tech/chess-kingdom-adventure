"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Visual register:
   *   "adventure" (default) — original bright/toy Kingdom Map style.
   *   "premium"             — Phase 10B midnight/gold style.
   *   "system"              — UI-2B token-backed button (new primitives only).
   * Existing screens keep the default; new UI-2B code passes tone="system".
   */
  tone?: "adventure" | "premium" | "system";
  /** Stretch to the container width. */
  block?: boolean;
  /** Show a spinner and disable interaction. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// ── UI-2B system (tone omitted) ────────────────────────────────────────
const SYSTEM_SIZE: Record<Size, string> = {
  sm: "min-h-[40px] px-3.5 text-[15px] gap-1.5",
  md: "min-h-[44px] px-5 text-[15px] gap-2",
  lg: "min-h-[52px] px-6 text-[16px] gap-2",
};

const SYSTEM_VARIANT: Record<Variant, string> = {
  // `shadow-premiumGlow` (= 0 0 20px rgba(212,175,55,.35)) is the restrained
  // gold glow the spec asks for and matches the --glow-gold token.
  primary: "bg-primary text-primary-ink shadow-premiumGlow hover:brightness-[1.06] active:brightness-95",
  secondary: "bg-surface-raised text-text border border-border-strong hover:border-primary",
  ghost: "bg-transparent text-text-secondary hover:text-text hover:bg-surface",
  danger: "bg-danger-fill text-danger border border-danger-line hover:brightness-110",
  // `success` is retained only for legacy parity; new code should not need it.
  success: "bg-success-soft text-success border border-success-line hover:brightness-110",
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size,
    tone = "adventure",
    block,
    loading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  // ── UI-2B SYSTEM PATH (explicit opt-in) ──────────────────────────────
  if (tone === "system") {
    const s = size ?? "md";
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={clsx(
          "relative inline-flex select-none items-center justify-center whitespace-nowrap",
          "font-classic-display font-semibold tracking-wide",
          "rounded-[var(--radius-md)]",
          "transition-[transform,filter,background-color,border-color,color] duration-[120ms] ease-out",
          "active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:pointer-events-none disabled:opacity-50",
          SYSTEM_SIZE[s],
          SYSTEM_VARIANT[variant],
          block && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Spinner className={s === "lg" ? "h-5 w-5" : "h-4 w-4"} />}
        {!loading && leftIcon}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  }

  // ── LEGACY PATH — default adventure / premium ──────────────────────
  {
    const legacySize = size ?? "lg";
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={clsx(
          "font-bold transition-transform active:animate-squish",
          "focus:outline-none",
          legacySize === "lg" ? "min-h-[64px] px-8 text-xl" : "min-h-[48px] px-5 text-base",

          tone === "adventure" && [
            "font-display rounded-btn shadow-toy active:shadow-none active:translate-y-2",
            "focus-visible:ring-4 focus-visible:ring-kingdom-sky/50",
            variant === "primary" && "bg-kingdom-gold text-kingdom-night hover:brightness-105",
            variant === "secondary" && "bg-kingdom-royal text-white hover:brightness-105",
            variant === "ghost" && "bg-white/70 text-kingdom-night border-2 border-kingdom-night/10",
            variant === "danger" && "bg-kingdom-coral text-white hover:brightness-105",
            variant === "success" && "bg-kingdom-leaf text-kingdom-night hover:brightness-105",
          ],

          tone === "premium" && [
            "font-classic-display rounded-premiumBtn tracking-wide",
            "focus-visible:ring-2 focus-visible:ring-premium-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-premium-midnight",
            variant === "primary" &&
              "bg-premium-gold text-premium-midnightDeep shadow-premiumGlow hover:brightness-110 active:brightness-95",
            variant === "secondary" &&
              "bg-premium-navyLight text-premium-ivory border border-premium-gold/25 hover:border-premium-gold/50",
            variant === "ghost" &&
              "bg-transparent text-premium-ivory/80 border border-premium-ivory/15 hover:border-premium-ivory/30 hover:text-premium-ivory",
            variant === "danger" &&
              "bg-red-500/15 text-red-300 border border-red-400/30 hover:bg-red-500/25",
            variant === "success" &&
              "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25",
          ],

          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
});

/**
 * Icon-only button — a fixed square hit target with a mandatory accessible
 * name. Unchanged in UI-2B except the gold focus ring is now
 * token-consistent; `tone` still defaults to "premium" for its existing
 * ~10 callers.
 */
export function IconButton({
  label,
  tone = "premium",
  size = 40,
  className,
  children,
  ...props
}: {
  label: string;
  tone?: "adventure" | "premium";
  size?: number;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      aria-label={label}
      style={{ width: size, height: size }}
      className={clsx(
        "inline-flex items-center justify-center flex-none transition-colors",
        "focus:outline-none focus-visible:ring-2",
        tone === "premium" &&
          "rounded-premiumBtn bg-premium-navyLight/60 text-premium-ivory/70 hover:text-premium-ivory hover:bg-premium-navyLight focus-visible:ring-premium-gold/60",
        tone === "adventure" &&
          "rounded-full bg-white/70 text-kingdom-night hover:bg-white focus-visible:ring-kingdom-sky/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
