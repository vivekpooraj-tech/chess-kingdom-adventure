"use client";

import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "lg",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "font-display font-bold rounded-btn transition-transform active:animate-squish",
        "shadow-toy active:shadow-none active:translate-y-2",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-kingdom-sky/50",
        size === "lg" ? "min-h-[64px] px-8 text-xl" : "min-h-[48px] px-5 text-base",
        variant === "primary" &&
          "bg-kingdom-gold text-kingdom-night hover:brightness-105",
        variant === "secondary" &&
          "bg-kingdom-royal text-white hover:brightness-105",
        variant === "ghost" &&
          "bg-white/70 text-kingdom-night border-2 border-kingdom-night/10",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
