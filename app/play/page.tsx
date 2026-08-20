import Link from "next/link";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { SecondaryCard } from "@/components/ui/Card";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ComputerIcon, GlobeIcon, PersonAddIcon, TrophyIcon } from "@/components/nav/icons";
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
  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className={TEXT.display}>Play</h1>
          <p className={`${TEXT.body} mt-2`}>Pick your opponent. The board does the rest.</p>
        </div>

        <FeatureCard
          href="/free-play"
          title="Play Computer"
          description="A full game against an opponent your size."
          icon={ComputerIcon}
        />

        <SecondaryCard className="w-full max-w-md flex flex-col gap-3">
          <p className="font-classic-display text-lg text-premium-ivory">Play Online</p>
          <Link
            href="/matchmaking"
            className="rounded-premiumBtn bg-premium-navy/70 border border-white/5 hover:border-premium-gold/30 active:scale-[0.98] transition-all duration-100 px-4 py-3 min-h-[64px] flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-premiumBtn bg-premium-gold/15 text-premium-gold flex items-center justify-center flex-none">
              <GlobeIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-classic-body text-sm text-premium-ivory">Random Match</p>
              <p className={TEXT.caption}>A fair match against another player, worldwide.</p>
            </div>
            <span className="text-premium-gold text-lg flex-none">→</span>
          </Link>
          <div className="rounded-premiumBtn bg-premium-navy/70 border border-white/5 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-premiumBtn bg-premium-gold/15 text-premium-gold flex items-center justify-center flex-none">
                <PersonAddIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-classic-body text-sm text-premium-ivory">Invite a Friend</p>
                <p className={TEXT.caption}>Send them a link to a game just for you two.</p>
              </div>
            </div>
            <InviteFriendButton />
          </div>
        </SecondaryCard>

        <FeatureCard
          href="/play/tournaments"
          title="Group Tournament"
          description="Join a Swiss-style tournament — multiple rounds, real standings."
          icon={TrophyIcon}
        />

        <div className="w-full max-w-md flex flex-col gap-2">
          <SectionHeader title="Today" />
          <DailyChallengeCard />
          <Link
            href="/puzzles"
            className="self-center font-body text-sm text-premium-ivory/40 underline underline-offset-2 min-h-[44px] flex items-center"
          >
            Practice more puzzles
          </Link>
        </div>
      </main>
      <PrimaryNav />
    </>
  );
}
