import clsx from "clsx";

/**
 * The one way move/answer feedback reads across the app — a tinted banner,
 * not a bare coloured line, so "right" and "wrong" register at a glance and
 * match the alert language used elsewhere (auth errors, paywalls).
 *   correct   → emerald   wrong → red   neutral → quiet (progress nudges)
 */
export function MoveFeedback({
  tone,
  children,
  className,
}: {
  tone: "correct" | "incorrect" | "neutral";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={clsx(
        "rounded-premiumBtn border px-3.5 py-2.5 font-classic-body text-sm leading-snug",
        tone === "correct" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
        tone === "incorrect" && "border-red-400/30 bg-red-500/10 text-red-200",
        tone === "neutral" && "border-white/10 bg-white/[0.04] text-premium-ivory/70",
        className
      )}
    >
      {children}
    </p>
  );
}
