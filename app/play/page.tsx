import Link from "next/link";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { TEXT } from "@/lib/designSystem";

/**
 * The Play hub (Phase 10B point 7) — a real landing destination for the
 * nav's "Play" item instead of dumping the child straight onto the Home
 * dashboard. Presentational only, same pattern as app/academy/page.tsx:
 * each destination (Puzzles, Free Play, Matchmaking) already gates itself
 * (auth, and — for Free Play/Matchmaking/Invite a Friend — the daily free
 * game limit in supabase/migrations/0019_daily_free_game_limits.sql) — no
 * need to duplicate that logic here.
 */
const MODES: {
  id: string;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    id: "puzzles",
    title: "Puzzle Trainer",
    description: "Sharpen your tactics, one position at a time.",
    href: "/puzzles",
  },
  {
    id: "computer",
    title: "Computer",
    description: "A full game against an opponent your size.",
    href: "/free-play",
  },
  {
    id: "online",
    title: "Play Someone New",
    description: "A fair match against another player, worldwide.",
    href: "/matchmaking",
  },
];

export default function PlayPage() {
  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className={TEXT.display}>Play</h1>
          <p className={`${TEXT.body} mt-2`}>Pick your opponent. The board does the rest.</p>
        </div>

        <div className="w-full max-w-md flex flex-col gap-3">
          {MODES.map((mode) => (
            <Link
              key={mode.id}
              href={mode.href}
              className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between border border-white/5 hover:border-premium-gold/30 transition-colors"
            >
              <div>
                <p className="font-classic-display text-lg text-premium-ivory">{mode.title}</p>
                <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">
                  {mode.description}
                </p>
              </div>
              <span className="text-premium-gold text-lg flex-none">→</span>
            </Link>
          ))}
        </div>

        <div className="w-full max-w-md rounded-premiumCard bg-premium-navy/60 border border-white/5 p-5 flex flex-col items-center gap-3 text-center">
          <p className={TEXT.body}>Want to play a friend? Send them an invite link.</p>
          <InviteFriendButton />
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
