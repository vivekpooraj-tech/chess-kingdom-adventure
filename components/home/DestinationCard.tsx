import Link from "next/link";
import { ChevronRightIcon } from "@/components/nav/icons";

/**
 * One of Home's four main-destination cards (Play / Academy / Chess Mind /
 * Discover — Phase 10B). Deliberately a single strong CTA per card, not a
 * list of sub-links (that was the old AreaCard's job) — "visually
 * distinctive section cards," not a menu.
 */
export function DestinationCard({
  href,
  title,
  description,
  icon,
  accent = "gold",
}: {
  href: string;
  title: string;
  description: string;
  icon: (props: { className?: string }) => JSX.Element;
  accent?: "gold" | "emerald";
}) {
  const Icon = icon;
  return (
    <Link
      href={href}
      className="group rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-3 border border-white/5 hover:border-premium-gold/30 transition-colors"
    >
      <div
        className={`w-10 h-10 rounded-premiumBtn flex items-center justify-center ${
          accent === "emerald" ? "bg-emerald-500/15 text-emerald-300" : "bg-premium-gold/15 text-premium-gold"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="font-classic-display text-base text-premium-ivory">{title}</p>
        <p className="font-classic-body text-xs text-premium-ivory/60 mt-0.5 leading-snug">
          {description}
        </p>
      </div>
      <span className="font-classic-body text-xs text-premium-gold flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
        Explore <ChevronRightIcon className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}
