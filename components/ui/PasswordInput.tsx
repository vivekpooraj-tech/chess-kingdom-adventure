"use client";

import { InputHTMLAttributes, useState } from "react";
import clsx from "clsx";

/**
 * Premium-tone password field with a show/hide toggle. Shared by the
 * sign-in and reset-password screens (the only places that take a password),
 * so the field styling and the visibility affordance stay identical.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={clsx(
          "w-full rounded-premiumBtn bg-premium-midnightDeep/50 border border-premium-ivory/15",
          "pl-4 pr-11 py-3 font-classic-body text-[15px] text-premium-ivory",
          "placeholder:text-premium-ivory/25",
          "transition-colors focus:outline-none focus:border-premium-gold/60 focus:ring-2 focus:ring-premium-gold/20",
          // Autofill background masking is handled globally in app/globals.css
          // (`.bg-premium-midnight input:-webkit-autofill …`) so it survives focus/hover.
          className
        )}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-premiumBtn text-premium-ivory/45 hover:text-premium-ivory/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/50 transition-colors"
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
            <path d="M9.36 5.18A9.46 9.46 0 0 1 12 4.8c4.64 0 8.57 3.01 9.96 7.2a10.5 10.5 0 0 1-2.35 3.68M6.1 6.1A10.53 10.53 0 0 0 2.04 12c1.39 4.19 5.32 7.2 9.96 7.2a9.5 9.5 0 0 0 4.06-.9" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.04 12C3.43 7.81 7.36 4.8 12 4.8s8.57 3.01 9.96 7.2c-1.39 4.19-5.32 7.2-9.96 7.2S3.43 16.19 2.04 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
