import Link from "next/link";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { TEXT } from "@/lib/designSystem";

type DiscoverSection =
  | { id: string; title: string; emoji: string; description: string; href: string }
  | { id: string; title: string; emoji: string; description: string; soon: true };

// Only real, existing content gets a link — no fake sections (Phase 10B
// point 19: "Only show content that actually exists").
const SECTIONS: DiscoverSection[] = [
  {
    id: "history",
    title: "History of Chess",
    emoji: "🏛️",
    description: "From ancient India to the game on your board today.",
    href: "/academy/origins",
  },
  {
    id: "pieces",
    title: "Chess Pieces",
    emoji: "♞",
    description: "How each piece moves, and the story behind its name.",
    href: "/piece-library",
  },
  {
    id: "opening-stories",
    title: "Opening Stories",
    emoji: "📖",
    description: "Where the Italian Game, the Sicilian, and the rest got their names.",
    href: "/academy/openings",
  },
  {
    id: "famous-games",
    title: "Famous Games",
    emoji: "🎞️",
    description: "Legendary games from chess history.",
    soon: true,
  },
  {
    id: "stories",
    title: "Chess Stories",
    emoji: "📚",
    description: "Tales from the world of chess.",
    soon: true,
  },
];

export default function DiscoverPage() {
  return (
    <>
      <Screen maxWidth="medium">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Discover</h1>
          <p className={`${TEXT.body} mt-2`}>
            Where chess came from, and the stories behind the pieces.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {SECTIONS.map((section) =>
            "soon" in section ? (
              <div
                key={section.id}
                className="list-row flex items-center gap-4 rounded-premiumCard bg-premium-navy/40 border border-white/5 p-5 opacity-60"
              >
                <span className="text-3xl flex-none">{section.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{section.title}</p>
                  <p className={TEXT.caption}>{section.description}</p>
                </div>
                <span className="font-classic-body text-[10px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                  SOON
                </span>
              </div>
            ) : (
              <Link
                key={section.id}
                href={section.href}
                className="list-row flex items-center gap-4 rounded-premiumCard bg-premium-navy shadow-premiumCard border border-white/5 hover:border-premium-gold/30 transition-colors p-5"
              >
                <span className="text-3xl flex-none">{section.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{section.title}</p>
                  <p className={TEXT.caption}>{section.description}</p>
                </div>
                <span className="text-premium-gold text-lg flex-none">→</span>
              </Link>
            )
          )}
        </div>

        <Link
          href="/kingdom-map"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to Home
        </Link>
      </Screen>
      <PrimaryNav />
    </>
  );
}
