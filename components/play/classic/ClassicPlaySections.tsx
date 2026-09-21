import Link from "next/link";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { InviteFriendPanel } from "@/components/play/InviteFriendPanel";
import { TacticsTrainerRow } from "@/components/play/TacticsTrainerRow";
import { ComputerIcon, GlobeIcon, TrophyIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * Classic/Pro ("Play & Competition") Play composition — the mode closest to
 * the pre-2.2-C baseline. Same 7 actions/routes as every other mode,
 * grouped and worded for a competitive dashboard: Primary (Random Match,
 * Play Computer), Competitive Arena (Group Tournament, Invite a Friend),
 * Pre-Match Warmup & Boards (Tactics Trainer, Daily Challenge, Chess Mind
 * World). No leaderboards/ratings/matchmaking stats/opponent avatars.
 */
export function ClassicPlaySections() {
  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className={TEXT.display}>Play</h1>
        <p className={`${TEXT.body} mt-2`}>Matchmaking, playing, and your tournaments.</p>
      </div>

      <div className="auto-grid mx-auto w-full max-w-3xl" style={{ "--grid-min": "16rem" } as React.CSSProperties}>
        <FeatureCard
          href="/matchmaking"
          title="Random Match"
          description="Find an opponent and play."
          icon={GlobeIcon}
          className="play-primary-card"
        />
        <FeatureCard
          href="/free-play"
          title="Play Computer"
          description="Play against the computer."
          icon={ComputerIcon}
          className="play-primary-card"
        />
      </div>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Competitive Arena" className="play-section-eyebrow" />
        <div className="flex flex-col gap-3">
          <FeatureCard
            href="/play/tournaments"
            title="Group Tournament"
            description="Join a group tournament."
            icon={TrophyIcon}
          />
          <InviteFriendPanel title="Invite a Friend" description="Invite a friend to play." />
        </div>
      </section>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Pre-Match Warmup & Boards" className="play-section-eyebrow" />
        <div className="auto-grid items-start" style={{ "--grid-min": "20rem" } as React.CSSProperties}>
          <TacticsTrainerRow description="Practice tactical positions." />
          <DailyChallengeCard />
          <Link
            href="/world"
            className="font-body text-sm text-premium-ivory/65 underline underline-offset-2 min-h-[44px] flex items-center"
          >
            Explore Chess Mind World
          </Link>
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
