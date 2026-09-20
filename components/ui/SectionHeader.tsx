import Link from "next/link";
import { TEXT } from "@/lib/designSystem";

/**
 * Chess Mind design system — SectionHeader. Replaces the hand-repeated
 * `<p className={TEXT.caption} uppercase tracking-wide>` (+ optional
 * trailing link) pattern scattered across Play/Learn/Profile/Home with one
 * shared component, so section titles read consistently everywhere.
 */
export function SectionHeader({
  title,
  actionLabel,
  actionHref,
  className = "",
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  /** Extra classes on the title <p> — additive, no existing call site sets
   *  this, so leaving it out is byte-identical to before. */
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <p className={`${TEXT.caption} uppercase tracking-wide ${className}`}>{title}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="font-classic-body text-xs text-premium-gold underline underline-offset-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
