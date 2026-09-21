import Link from "next/link";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { InviteFriendPanel } from "@/components/play/InviteFriendPanel";
import { TacticsTrainerRow } from "@/components/play/TacticsTrainerRow";
import { ComputerIcon, GlobeIcon, TrophyIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * Adult ("Master Training Atelier") Play composition — "Choose Your
 * Training". Same 7 actions/routes as every other mode, grouped and worded
 * for deliberate practice: Primary (Play Computer, Random Match), Tactical
 * Diagnosis (Daily Challenge, Tactics Trainer), Explore (Chess Mind World),
 * Events & Network (Group Tournament, Invite a Friend). "Calibration" is
 * copy only — no new training metrics, accuracy, ratings, or sessions.
 */
export function AdultPlaySections() {
  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className="font-classic-display text-3xl text-premium-ivory">Choose Your Training</h1>
        <p className={`${TEXT.body} mt-2`}>Structured match practice and daily tactical calibration.</p>
      </div>

      <div className="auto-grid mx-auto w-full max-w-3xl" style={{ "--grid-min": "16rem" } as React.CSSProperties}>
        <FeatureCard
          href="/free-play"
          title="Play Computer"
          description="Practice by playing against the computer."
          icon={ComputerIcon}
          className="play-primary-card"
        />
        <FeatureCard
          href="/matchmaking"
          title="Random Match"
          description="Play a game against another player."
          icon={GlobeIcon}
          className="play-primary-card"
        />
      </div>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Tactical Diagnosis" className="play-section-eyebrow" />
        <div className="auto-grid items-start" style={{ "--grid-min": "20rem" } as React.CSSProperties}>
          <DailyChallengeCard />
          <TacticsTrainerRow description="Practice tactical positions." />
          <Link
            href="/puzzles"
            className="font-body text-sm text-premium-ivory/65 underline underline-offset-2 min-h-[44px] flex items-center"
          >
            Practice more puzzles
          </Link>
        </div>
      </section>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Explore" className="play-section-eyebrow" />
        <div className="auto-grid mx-auto w-full max-w-3xl" style={{ "--grid-min": "16rem" } as React.CSSProperties}>
          <FeatureCard
            href="/world"
            title="Chess Mind World"
            description="Explore chess through the World."
            icon={GlobeIcon}
          />
        </div>
      </section>

      <section className="w-full flex flex-col gap-2">
        <SectionHeader title="Events & Network" className="play-section-eyebrow" />
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
    </div>
  );
}
