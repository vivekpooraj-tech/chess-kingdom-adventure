import Link from "next/link";
import { ChevronRightIcon, ShieldIcon } from "./icons";
import { ageAudience, type AgeBand } from "@/lib/learner/experienceLevel";

/**
 * The ONE "For Parents" entry. It is the learner-friendly door to the existing Parent Gate flow
 * (/parent-gate, which then verifies the adult before /parent-dashboard) — this component only
 * makes that door easy to see; it does not touch the gate itself.
 *
 * It is a real destination, not footer metadata: a bordered row with an icon, a 16px label,
 * a supporting line and an arrow, a 52px touch target, and body-weight contrast. Every Home
 * (Enchanted Kingdom, Master Training Atelier, Classic Pro), Learn and Profile render this one
 * component, so the entry cannot drift between screens or worlds.
 *
 * `variant="classic"` swaps in the Classic Pro stylesheet classes (app/worlds.css) because that
 * world is styled with its own tokens rather than the premium palette.
 */
export const PARENT_GATE_HREF = "/parent-gate?next=/parent-dashboard";

export function ForParentsLink({
  variant = "premium",
  className = "",
  ageBand,
}: {
  variant?: "premium" | "classic";
  className?: string;
  /** The active child's children.age_band. An 18+ player decides for themselves, so the
   * parent entry is not shown; under-18 and unknown/missing both keep it (never assume adult). */
  ageBand?: AgeBand | null;
}) {
  if (ageAudience(ageBand) === "adult") return null;
  if (variant === "classic") {
    return (
      <Link href={PARENT_GATE_HREF} className={`ch-parents ${className}`}>
        <ShieldIcon className="ch-parents__icon" />
        <span className="ch-parents__copy">
          <span className="ch-parents__title">For Parents</span>
          <span className="ch-parents__sub">Parent controls &amp; settings</span>
        </span>
        <ChevronRightIcon className="ch-parents__arrow" />
      </Link>
    );
  }

  return (
    <Link
      href={PARENT_GATE_HREF}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-premiumCard border border-premium-gold/35 bg-premium-midnight/70 px-4 py-2.5 text-premium-ivory transition-[border-color,transform] duration-100 hover:border-premium-gold/60 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 ${className}`}
    >
      <ShieldIcon className="h-6 w-6 flex-none text-premium-gold" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-classic-display text-base font-semibold leading-tight text-premium-ivory">
          For Parents
        </span>
        <span className="font-classic-body text-[13px] leading-tight text-premium-ivory/80">
          Parent controls &amp; settings
        </span>
      </span>
      <ChevronRightIcon className="h-5 w-5 flex-none text-premium-gold" />
    </Link>
  );
}
