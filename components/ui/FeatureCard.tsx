import Link from "next/link";
import { ChevronRightIcon } from "@/components/nav/icons";

/**
 * Full-width, single-CTA row card — the shared primitive for a screen's
 * primary destination choices (Play hub, Learn hub, etc). Icon + title +
 * description + arrow, one tap navigates. Distinct from DestinationCard
 * (Home's 2-column grid tile, same idea but a different layout) rather than
 * a shared base — the two are visually different enough that forcing one
 * component to do both via props would need more branching than reuse saves.
 */
export function FeatureCard({
  href,
  title,
  description,
  icon,
  accent = "gold",
  className,
}: {
  href: string;
  title: string;
  description: string;
  icon?: (props: { className?: string }) => JSX.Element;
  accent?: "gold" | "emerald";
  className?: string;
}) {
  const Icon = icon;
  return (
    <Link
      href={href}
      className={`w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center gap-4 border border-white/5 hover:border-premium-gold/30 active:scale-[0.98] transition-all duration-100 min-h-[76px] ${className ?? ""}`}
    >
      {Icon && (
        <div
          className={`w-12 h-12 rounded-premiumBtn flex items-center justify-center flex-none ${
            accent === "emerald" ? "bg-emerald-500/15 text-emerald-300" : "bg-premium-gold/15 text-premium-gold"
          }`}
        >
          <Icon className="w-7 h-7" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-classic-display text-lg text-premium-ivory">{title}</p>
        <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">{description}</p>
      </div>
      <ChevronRightIcon className="w-5 h-5 text-premium-gold flex-none" />
    </Link>
  );
}
