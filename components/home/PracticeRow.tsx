import Link from "next/link";
import { PuzzlePieceIcon, PlayIcon, WorldIcon } from "@/components/nav/icons";

const ITEMS = [
  { href: "/puzzles", label: "Puzzles", icon: PuzzlePieceIcon },
  { href: "/play", label: "Play", icon: PlayIcon },
  { href: "/world", label: "World", icon: WorldIcon },
] as const;

/**
 * Compact one-tap-away row under the primary action (Phase 3). These three
 * are the fastest repeat actions a child takes — kept small and equal-weight
 * on purpose, distinct from DestinationCard's larger discovery cards, so the
 * page has exactly one dominant CTA (the PrimaryActionCard above) and these
 * read as quick shortcuts rather than competing headlines.
 */
export function PracticeRow() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center justify-center gap-1.5 rounded-premiumCard bg-premium-navy/70 border border-white/5 py-3.5 min-h-[76px] hover:border-premium-gold/25 active:scale-[0.98] transition-[border-color,transform] duration-100"
        >
          <Icon className="w-5 h-5 text-premium-gold" />
          <span className="font-classic-body text-xs text-premium-ivory/85">{label}</span>
        </Link>
      ))}
    </div>
  );
}
