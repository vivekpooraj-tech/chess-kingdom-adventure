"use client";

import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
  /**
   * Visual register — "adventure" (default) is the existing bright/toy
   * Kingdom Map style for not-yet-migrated screens; "premium" is the
   * Phase 10B midnight/gold system. One component, two tones, rather than
   * a second Button — see the child/adult "personality spectrum" note in
   * the Phase 10B brief. Pass "premium" as each screen is redesigned.
   */
  tone?: "adventure" | "premium";
}

export function Button({
  variant = "primary",
  size = "lg",
  tone = "adventure",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "font-bold transition-transform active:animate-squish",
        "focus:outline-none",
        size === "lg" ? "min-h-[64px] px-8 text-xl" : "min-h-[48px] px-5 text-base",

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
          variant === "danger" && "bg-red-500/15 text-red-300 border border-red-400/30 hover:bg-red-500/25",
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

/**
 * Icon-only button — a fixed square hit target with a mandatory accessible
 * name (no way to render one without `label`, so it can't ship silently
 * unlabeled the way a bare icon-only <button> could).
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
