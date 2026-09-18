import Link from "next/link";
import {
  AcademyIcon,
  PlayIcon,
  PuzzlePieceIcon,
  WorldIcon,
} from "@/components/nav/icons";

const TILES = [
  {
    href: "/play",
    label: "Play",
    icon: PlayIcon,
    tileClass:
      "border-sky-400/20 bg-sky-500/[0.07] hover:border-sky-400/35",
    iconClass: "text-sky-300",
  },
  {
    href: "/puzzles",
    label: "Puzzles",
    icon: PuzzlePieceIcon,
    tileClass:
      "border-emerald-400/20 bg-emerald-500/[0.07] hover:border-emerald-400/35",
    iconClass: "text-emerald-300",
  },
  {
    href: "/world",
    label: "World",
    icon: WorldIcon,
    tileClass:
      "border-violet-400/20 bg-violet-500/[0.07] hover:border-violet-400/35",
    iconClass: "text-violet-300",
  },
  {
    href: "/learn",
    label: "Learn",
    icon: AcademyIcon,
    tileClass:
      "border-teal-400/20 bg-teal-500/[0.07] hover:border-teal-400/35",
    iconClass: "text-teal-300",
  },
] as const;

/**
 * Home's four primary activity shortcuts — equal-weight 2×2 grid, distinct
 * from the dominant PrimaryActionCard above it.
 */
export function ActivityTileGrid() {
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {TILES.map(({ href, label, icon: Icon, tileClass, iconClass }) => (
        <Link
          key={href}
          href={href}
          className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-premiumCard border bg-premium-navy/70 px-3 py-3 transition-[border-color,transform] duration-100 active:scale-[0.98] ${tileClass}`}
        >
          <Icon className={`h-6 w-6 ${iconClass}`} />
          <span className="font-classic-body text-sm text-premium-ivory/90">{label}</span>
        </Link>
      ))}
    </div>
  );
}
