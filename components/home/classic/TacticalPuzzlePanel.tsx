import Link from "next/link";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { TEXT } from "@/lib/designSystem";

/**
 * Home's "Tactical Puzzle Zone" (Classic/Pro, Phase 2.1-B.1) — wraps the
 * EXISTING DailyChallengeCard (unchanged, same client component already
 * used on /play) in a dashboard panel instead of inventing a new puzzle
 * data source. No new query: this is presentation only, reusing the real
 * daily-challenge data DailyChallengeCard already fetches for itself.
 */
export function TacticalPuzzlePanel({ childId }: { childId: string }) {
  return (
    <div className="cp-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={TEXT.heading}>Tactical Puzzle Zone</h2>
        <Link
          href="/puzzles"
          className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2"
        >
          Puzzle Tower
        </Link>
      </div>
      <DailyChallengeCard childId={childId} />
      <Link
        href="/puzzles/tactics"
        className="flex min-h-[56px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2 transition-colors hover:border-premium-gold/30"
      >
        <span className="text-xl" aria-hidden="true">⚔️</span>
        <div className="flex-1 min-w-0">
          <p className="font-classic-body text-sm text-premium-ivory">Tactics Trainer</p>
          <p className={TEXT.caption}>Forks, pins, skewers and more</p>
        </div>
      </Link>
    </div>
  );
}
