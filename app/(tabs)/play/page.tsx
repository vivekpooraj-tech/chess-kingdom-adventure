import Link from "next/link";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { SecondaryCard } from "@/components/ui/Card";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { ComputerIcon, GlobeIcon, PersonAddIcon, TrophyIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

export default function PlayPage() {
  return (
    <TabPageShell>
      <div>
        <h1 className={TEXT.display}>Play</h1>
        <p className={`${TEXT.body} mt-2`}>Pick your opponent. The board does the rest.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FeatureCard
          href="/free-play"
          title="Play Computer"
          description="A full game against an opponent your size."
          icon={ComputerIcon}
        />

        <FeatureCard
          href="/play/tournaments"
          title="Group Tournament"
          description="Join a Swiss-style tournament — multiple rounds, real standings."
          icon={TrophyIcon}
        />
      </div>

      <SecondaryCard className="w-full flex flex-col gap-3">
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

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Today" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <DailyChallengeCard />
          <Link
            href="/puzzles"
            className="font-body text-sm text-premium-ivory/40 underline underline-offset-2 min-h-[44px] flex items-center lg:justify-center"
          >
            Practice more puzzles
          </Link>
        </div>
      </section>
    </TabPageShell>
  );
}
