import Link from "next/link";
import { PrimaryCard, ListItemRow } from "@/components/ui/Card";
import { CHESS_MIND_CATEGORIES } from "@/content/chessMindCategories";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";

/**
 * Learn (Phase 19) — a single combined index over the existing Academy and
 * Chess Mind sections, which used to be two separate primary nav tabs.
 * Neither underlying section moved or lost content; this page just links
 * straight into their real sub-routes instead of routing through the old
 * /academy and /chess-mind index pages (both of which are still fully
 * intact and still reachable directly, and are still the "back" target for
 * their own children — see e.g. app/academy/fundamentals/page.tsx).
 *
 * Deliberately a plain static page — no auth check, no Supabase calls. The
 * "Continue Your Journey" card below links to the Kingdom Journey by anchor
 * rather than re-fetching per-child progress here (that data already lives
 * on Kingdom Map); a second personalized fetch on every visit to this page
 * would be exactly the kind of redundant request the tab-switching
 * performance pass just removed elsewhere.
 */
const LEARN_CHESS = [
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
    href: "/academy/tactics",
  },
  {
    id: "openings",
    title: "Chess Openings",
    emoji: "♞",
    description: "28 named openings, principles, and how to choose one.",
    href: "/academy/openings",
  },
  {
    id: "strategy",
    title: "Strategy",
    emoji: "🧭",
    description: "Development, king safety, and long-term planning.",
    soon: true as const,
  },
  {
    id: "endgames",
    title: "Endgames",
    emoji: "🏰",
    description: "Converting an advantage when the board empties out.",
    soon: true as const,
  },
];

export default function LearnPage() {
  const trainCategories = CHESS_MIND_CATEGORIES;

  return (
    <TabPageShell contentClassName="gap-8">
      <div>
        <h1 className={TEXT.display}>Learn</h1>
        <p className={`${TEXT.body} mt-2`}>
          Structured lessons on the game, and training for how you think about it.
        </p>
      </div>

      <Link href="/kingdom-map#journey" className="w-full block active:scale-[0.98] transition-transform duration-100">
        <PrimaryCard className="flex items-center gap-4">
          <span className="text-3xl flex-none">🗺️</span>
          <div className="flex-1">
            <p className={`${TEXT.meta} text-premium-gold`}>Continue Your Journey</p>
            <p className="font-classic-display text-lg text-premium-ivory mt-1">
              Pick up where you left off in the Kingdom
            </p>
          </div>
        </PrimaryCard>
      </Link>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Learn Chess</p>
          <div className="flex flex-col gap-1.5">
            {LEARN_CHESS.map((item) =>
              "soon" in item ? (
                <ListItemRow key={item.id} className="opacity-50 min-h-[64px]">
                  <span className="text-3xl flex-none">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{item.title}</p>
                    <p className={TEXT.caption}>{item.description}</p>
                  </div>
                  <span className="font-classic-body text-[10px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                    SOON
                  </span>
                </ListItemRow>
              ) : (
                <ListItemRow key={item.id} href={item.href} className="min-h-[64px]">
                  <span className="text-3xl flex-none">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{item.title}</p>
                    <p className={TEXT.caption}>{item.description}</p>
                  </div>
                  <span className="text-premium-gold text-lg flex-none">→</span>
                </ListItemRow>
              )
            )}
          </div>
        </section>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Train Your Chess Mind</p>
          <div className="flex flex-col gap-1.5">
            {trainCategories.map((cat) =>
              !cat.href ? (
                <ListItemRow key={cat.id} className="opacity-50 min-h-[64px]">
                  <span className="text-3xl flex-none">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                    <p className={TEXT.caption}>{cat.description}</p>
                  </div>
                  <span className="font-classic-body text-[10px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                    SOON
                  </span>
                </ListItemRow>
              ) : (
                <ListItemRow key={cat.id} href={cat.href} className="min-h-[64px]">
                  <span className="text-3xl flex-none">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                    <p className={TEXT.caption}>{cat.description}</p>
                  </div>
                  <span className="text-premium-gold text-lg flex-none">→</span>
                </ListItemRow>
              )
            )}
          </div>
        </section>
      </div>
    </TabPageShell>
  );
}
