import Link from "next/link";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { ListItemRow } from "@/components/ui/Card";
import { BRAND } from "@/lib/brand";
import { TEXT } from "@/lib/designSystem";

type AcademyCategory =
  | { id: string; title: string; emoji: string; description: string; href: string }
  | { id: string; title: string; emoji: string; description: string; soon: true };

const CATEGORIES: AcademyCategory[] = [
  {
    id: "journey",
    title: "Chess Journey",
    emoji: "🗺️",
    description: "The 30-day story path through every Kingdom zone.",
    href: "/kingdom-map#journey",
  },
  {
    id: "fundamentals",
    title: "Chess Fundamentals",
    emoji: "📐",
    description: "The board, the pieces, and the rules — from scratch.",
    href: "/academy/fundamentals",
  },
  {
    id: "origins",
    title: "Chess Origins",
    emoji: "🏛️",
    description: "How a 1,500-year-old game reached your board today.",
    href: "/academy/origins",
  },
  {
    id: "tactics",
    title: "Tactics",
    emoji: "⚔️",
    description: "Forks, pins, skewers, and the patterns that win material.",
    soon: true,
  },
  {
    id: "strategy",
    title: "Strategy",
    emoji: "🧭",
    description: "Development, king safety, and long-term planning.",
    soon: true,
  },
  {
    id: "endgames",
    title: "Endgames",
    emoji: "🏰",
    description: "Converting an advantage when the board empties out.",
    soon: true,
  },
  {
    id: "openings",
    title: "Chess Openings",
    emoji: "♞",
    description: "28 named openings, principles, and how to choose one.",
    href: "/academy/openings",
  },
];

export default function AcademyPage() {
  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <p className={`${TEXT.meta} text-premium-gold`}>{BRAND.academyName}</p>
          <h1 className={`${TEXT.display} mt-1`}>{BRAND.academyTagline}</h1>
          <p className={`${TEXT.body} mt-2`}>
            History, tactics, strategy, endgames, and openings — everything beyond the daily
            lesson.
          </p>
        </div>

        {/* A flat list of rows, not a stack of 7 individually-shadowed
            cards — ListItemRow (design system, components/ui/Card.tsx)
            keeps the same content but reads as one coherent list. */}
        <div className="w-full max-w-md flex flex-col gap-1.5">
          {CATEGORIES.map((cat) =>
            "soon" in cat ? (
              <ListItemRow key={cat.id} className="opacity-50">
                <span className="text-2xl flex-none">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                  <p className={TEXT.caption}>{cat.description}</p>
                </div>
                <span className="font-classic-body text-[10px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                  SOON
                </span>
              </ListItemRow>
            ) : (
              <ListItemRow key={cat.id} href={cat.href}>
                <span className="text-2xl flex-none">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                  <p className={TEXT.caption}>{cat.description}</p>
                </div>
                <span className="text-premium-gold text-lg flex-none">→</span>
              </ListItemRow>
            )
          )}
        </div>

        <Link
          href="/kingdom-map"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to Home
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}
