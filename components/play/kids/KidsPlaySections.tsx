import Link from "next/link";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { InviteFriendPanel } from "@/components/play/InviteFriendPanel";
import { TacticsTrainerRow } from "@/components/play/TacticsTrainerRow";
import { ComputerIcon, GlobeIcon, TrophyIcon } from "@/components/nav/icons";

/**
 * Kids ("Enchanted Kingdom") Play composition — "Choose Your Adventure".
 * Same 7 actions/routes as every other mode, grouped and worded for a
 * young player: Primary (Play Computer, Random Match), Exploration
 * (Chess Mind World), Play Together (Invite a Friend, Group Tournament),
 * Today's Quests (Daily Challenge, Tactics Trainer). No XP/levels/rewards/
 * fictional opponents/locked content — copy only.
 */
export function KidsPlaySections() {
  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className="font-classic-display text-3xl text-premium-ivory">Choose Your Adventure</h1>
      </div>

      <div className="auto-grid mx-auto w-full max-w-3xl" style={{ "--grid-min": "16rem" } as React.CSSProperties}>
        <FeatureCard
          href="/free-play"
          title="Play Computer"
          description="Play a chess game against the computer."
          icon={ComputerIcon}
          className="play-primary-card"
        />
        <FeatureCard
          href="/matchmaking"
          title="Random Match"
          description="Find another player and play a chess game."
          icon={GlobeIcon}
          className="play-primary-card"
        />
      </div>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Exploration" className="play-section-eyebrow" />
        <div className="auto-grid mx-auto w-full max-w-3xl" style={{ "--grid-min": "16rem" } as React.CSSProperties}>
          <FeatureCard href="/world" title="Chess Mind World" description="Explore the chess world." icon={GlobeIcon} />
        </div>
      </section>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Play Together" className="play-section-eyebrow" />
        <div className="flex flex-col gap-3">
          <InviteFriendPanel title="Invite a Friend" description="Invite a friend to play together." />
          <FeatureCard
            href="/play/tournaments"
            title="Group Tournament"
            description="Join a group tournament."
            icon={TrophyIcon}
          />
        </div>
      </section>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Today's Quests" className="play-section-eyebrow" />
        <div className="auto-grid items-start" style={{ "--grid-min": "20rem" } as React.CSSProperties}>
          <DailyChallengeCard />
          <TacticsTrainerRow description="Practice your chess tactics." />
          <Link
            href="/puzzles"
            className="font-body text-sm text-premium-ivory/65 underline underline-offset-2 min-h-[44px] flex items-center"
          >
            Practice more puzzles
          </Link>
        </div>
      </section>
    </div>
  );
}
