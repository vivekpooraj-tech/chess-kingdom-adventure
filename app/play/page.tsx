import Link from "next/link";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { getDailyPuzzle } from "@/content/puzzles";
import { SecondaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";

/**
 * The Play hub (Phase 10B point 7, restructured Phase 19). Three primary
 * choices instead of a flat list of five equal-weight items — Random Match
 * and Invite a Friend are both still one tap away, just grouped under
 * "Play Online" instead of sitting at the same visual level as "Computer."
 * Puzzle Trainer (general practice, no specific puzzle) is still reachable
 * too, as a small secondary link under the Daily Challenge card rather than
 * its own top-level row. Every destination already gates itself (auth, and
 * the daily free game limit in supabase/migrations/0019_daily_free_game_limits.sql)
 * — no need to duplicate that logic here.
 */
export default function PlayPage() {
  const dailyPuzzle = getDailyPuzzle();

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className={TEXT.display}>Play</h1>
          <p className={`${TEXT.body} mt-2`}>Pick your opponent. The board does the rest.</p>
        </div>

        <Link
          href="/free-play"
          className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between border border-white/5 hover:border-premium-gold/30 transition-colors"
        >
          <div>
            <p className="font-classic-display text-lg text-premium-ivory">Play Computer</p>
            <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">
              A full game against an opponent your size.
            </p>
          </div>
          <span className="text-premium-gold text-lg flex-none">→</span>
        </Link>

        <SecondaryCard className="w-full max-w-md flex flex-col gap-3">
          <p className="font-classic-display text-lg text-premium-ivory">Play Online</p>
          <Link
            href="/matchmaking"
            className="rounded-premiumBtn bg-premium-navy/70 border border-white/5 hover:border-premium-gold/30 transition-colors px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="font-classic-body text-sm text-premium-ivory">Random Match</p>
              <p className={TEXT.caption}>A fair match against another player, worldwide.</p>
            </div>
            <span className="text-premium-gold text-lg flex-none">→</span>
          </Link>
          <div className="rounded-premiumBtn bg-premium-navy/70 border border-white/5 px-4 py-3 flex flex-col gap-3">
            <div>
              <p className="font-classic-body text-sm text-premium-ivory">Invite a Friend</p>
              <p className={TEXT.caption}>Send them a link to a game just for you two.</p>
            </div>
            <InviteFriendButton />
          </div>
        </SecondaryCard>

        <Link
          href="/play/tournaments"
          className="w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex items-center justify-between border border-white/5 hover:border-premium-gold/30 transition-colors"
        >
          <div>
            <p className="font-classic-display text-lg text-premium-ivory">Group Tournament</p>
            <p className="font-classic-body text-sm text-premium-ivory/60 mt-0.5">
              Join a Swiss-style tournament — multiple rounds, real standings.
            </p>
          </div>
          <span className="text-premium-gold text-lg flex-none">→</span>
        </Link>

        <div className="w-full max-w-md flex flex-col gap-2">
          <DailyChallengeCard puzzle={dailyPuzzle} />
          <Link
            href="/puzzles"
            className="self-center font-body text-sm text-premium-ivory/40 underline underline-offset-2"
          >
            Practice more puzzles
          </Link>
        </div>
      </main>
      <PrimaryNav />
    </>
  );
}
