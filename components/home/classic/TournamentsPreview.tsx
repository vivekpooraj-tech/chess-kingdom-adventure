import Link from "next/link";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { TrophyIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

type Participation = {
  tournamentId: string;
  tournamentName: string;
  status: string;
  points: number;
  allPoints: number[];
  endedAt: string | null;
};

/**
 * Home's tournament section (Classic/Pro, Phase 2.1-B / 2.1-B.1) — reuses
 * getTournamentParticipations() (already used by app/stats/page.tsx) rather
 * than a new query. If the child has actually played in a tournament, show
 * their real standing; otherwise show the same "Group Tournament" promo
 * already on /play, so this never has to invent results for a child who
 * hasn't joined one yet.
 */
export function TournamentsPreview({ participations }: { participations: Participation[] }) {
  if (participations.length === 0) {
    return (
      <FeatureCard
        href="/play/tournaments"
        title="Group Tournament"
        description="Join a Swiss-style tournament — multiple rounds, real standings."
        icon={TrophyIcon}
        className="cp-panel"
      />
    );
  }

  const recent = [...participations]
    .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))
    .slice(0, 2);

  return (
    <div className="cp-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="cp-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            Competitive Record
          </p>
          <h2 className={TEXT.heading}>Tournaments</h2>
        </div>
        <Link
          href="/play/tournaments"
          className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2"
        >
          Join another
        </Link>
      </div>
      <ol className="flex flex-col gap-2">
        {recent.map((p) => {
          const rank =
            p.allPoints.length > 0
              ? [...p.allPoints].sort((a, b) => b - a).indexOf(p.points) + 1
              : null;
          return (
            <li
              key={p.tournamentId}
              className="flex min-h-[56px] items-center justify-between gap-3 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-classic-body text-sm text-premium-ivory">{p.tournamentName}</span>
                <span className={TEXT.caption}>
                  {p.status === "completed" ? "Finished" : "In progress"}
                </span>
              </span>
              <span className="flex-none text-right">
                <span className="block font-classic-body text-sm font-semibold text-premium-gold">
                  {p.points} pts
                </span>
                {rank && (
                  <span className={TEXT.caption}>
                    #{rank} of {p.allPoints.length}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
