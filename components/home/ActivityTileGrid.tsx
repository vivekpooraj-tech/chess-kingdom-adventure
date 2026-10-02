"use client";

import Link from "next/link";
import {
  AcademyIcon,
  PlayIcon,
  PuzzlePieceIcon,
  TrophyIcon,
  WorldIcon,
} from "@/components/nav/icons";
import { useWorld } from "@/lib/world/WorldContext";

const TILES = [
  {
    href: "/play",
    label: "Play",
    atelierLabel: "Challenges",
    classicLabel: "Play",
    classicHref: "/play",
    icon: PlayIcon,
    classicIcon: PlayIcon,
    tileClass:
      "border-teal-400/25 bg-teal-500/[0.1] hover:border-teal-300/40",
    iconClass: "text-teal-200",
    atelierTileClass:
      "border-red-800/40 bg-red-950/40 hover:border-red-700/50",
    atelierIconClass: "text-red-300",
    classicTileClass:
      "border-emerald-800/45 bg-emerald-950/35 hover:border-emerald-700/55",
    classicIconClass: "text-emerald-200",
  },
  {
    href: "/puzzles",
    label: "Puzzles",
    atelierLabel: "Tactics",
    classicLabel: "Training",
    classicHref: "/puzzles",
    icon: PuzzlePieceIcon,
    classicIcon: PuzzlePieceIcon,
    tileClass:
      "border-amber-400/25 bg-amber-500/[0.1] hover:border-amber-300/40",
    iconClass: "text-amber-200",
    atelierTileClass:
      "border-amber-700/40 bg-amber-950/35 hover:border-amber-600/50",
    atelierIconClass: "text-amber-200",
    classicTileClass:
      "border-amber-200/20 bg-[#f7f0e2]/8 hover:border-amber-100/30",
    classicIconClass: "text-amber-100",
  },
  {
    href: "/world",
    label: "World",
    atelierLabel: "Strategy",
    classicLabel: "Games",
    classicHref: "/games",
    icon: WorldIcon,
    classicIcon: TrophyIcon,
    tileClass:
      "border-violet-400/30 bg-violet-500/[0.12] hover:border-violet-300/45",
    iconClass: "text-violet-200",
    atelierTileClass:
      "border-stone-500/35 bg-stone-900/50 hover:border-stone-400/45",
    atelierIconClass: "text-stone-200",
    classicTileClass:
      "border-rose-900/40 bg-rose-950/25 hover:border-rose-800/50",
    classicIconClass: "text-rose-200",
  },
  {
    href: "/learn",
    label: "Learn",
    atelierLabel: "Openings",
    classicLabel: "Analysis",
    classicHref: "/stats",
    icon: AcademyIcon,
    classicIcon: AcademyIcon,
    tileClass:
      "border-rose-400/25 bg-rose-500/[0.08] hover:border-rose-300/40",
    iconClass: "text-rose-200",
    atelierTileClass:
      "border-orange-800/40 bg-orange-950/30 hover:border-orange-700/50",
    atelierIconClass: "text-orange-200",
    classicTileClass:
      "border-stone-400/25 bg-stone-950/40 hover:border-stone-300/35",
    classicIconClass: "text-stone-200",
  },
] as const;

/**
 * Home's four primary activity shortcuts — equal-weight 2×2 grid, distinct
 * from the dominant PrimaryActionCard above it. Enchanted and Atelier hrefs
 * are unchanged. Classic Pro points two tiles at existing /games and /stats.
 */
export function ActivityTileGrid() {
  const world = useWorld();

  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {TILES.map((tile) => {
        const classic = world === "classic";
        const atelier = world === "atelier";
        const Icon = classic ? tile.classicIcon : tile.icon;
        const label = classic ? tile.classicLabel : atelier ? tile.atelierLabel : tile.label;
        const href = classic ? tile.classicHref : tile.href;
        const tileClass = classic
          ? tile.classicTileClass
          : atelier
            ? tile.atelierTileClass
            : tile.tileClass;
        const iconClass = classic
          ? tile.classicIconClass
          : atelier
            ? tile.atelierIconClass
            : tile.iconClass;
        return (
          <Link
            key={tile.href}
            href={href}
            className={`world-tile flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-premiumCard border bg-premium-navy/70 px-3 py-3 transition-[border-color,transform] duration-100 active:scale-[0.98] lg:min-h-[124px] tablet:min-h-[132px] tablet:py-5 ${tileClass}`}
          >
            <Icon className={`h-6 w-6 tablet:h-8 tablet:w-8 ${iconClass}`} />
            <span className="font-classic-body text-base text-premium-ivory/90 tablet:text-lg">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
