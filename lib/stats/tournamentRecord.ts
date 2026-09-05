/**
 * A player's tournament record.
 *
 * Pure: no I/O.
 *
 * Finish positions are computed here rather than stored, because nothing in the
 * schema records them — tournament_participants holds points only. Deriving
 * them means ranking every participant of each completed tournament, which is
 * possible because participants are readable by any authenticated user
 * (0023_group_tournaments.sql), unlike `children`, whose parent-owns-child RLS
 * is why a global cross-family leaderboard is not available.
 *
 * Ranking uses standard competition ranking: tied players share the higher
 * position and the next position skips (1, 2, 2, 4). Two players tied on points
 * genuinely did finish level, and quietly breaking the tie by row order would
 * invent a result — the sort order of two equal rows is arbitrary, so the
 * "winner" would change between page loads.
 */

export interface Participation {
  tournamentId: string;
  tournamentName: string;
  status: string;
  /** This player's points. */
  points: number;
  /** Every participant's points in that tournament, including this player. */
  allPoints: number[];
  endedAt: string | null;
}

export interface TournamentFinish {
  tournamentId: string;
  tournamentName: string;
  /** 1-based finishing position, competition-ranked. */
  position: number;
  playerCount: number;
  points: number;
  /** True when the player shares this position with someone else. */
  shared: boolean;
  endedAt: string | null;
}

export interface TournamentRecord {
  entered: number;
  /** Completed tournaments only — an in-progress event has no finish. */
  finished: number;
  wins: number;
  /** Top three, including wins. */
  podiums: number;
  best: TournamentFinish | null;
  recent: TournamentFinish[];
}

/**
 * Competition rank of `points` within `allPoints`: one plus the number of
 * participants who scored strictly more.
 */
export function positionOf(points: number, allPoints: number[]): number {
  return allPoints.filter((p) => p > points).length + 1;
}

export function isShared(points: number, allPoints: number[]): boolean {
  return allPoints.filter((p) => p === points).length > 1;
}

export function buildTournamentRecord(participations: Participation[]): TournamentRecord {
  const completed = participations.filter(
    (p) => p.status === "completed" && p.allPoints.length > 0
  );

  const finishes: TournamentFinish[] = completed.map((p) => ({
    tournamentId: p.tournamentId,
    tournamentName: p.tournamentName,
    position: positionOf(p.points, p.allPoints),
    playerCount: p.allPoints.length,
    points: p.points,
    shared: isShared(p.points, p.allPoints),
    endedAt: p.endedAt,
  }));

  // A "win" in a two-player event is not much of a win, and counting it
  // alongside a real field would flatter the record. Podiums need a field big
  // enough for a podium to mean something.
  const wins = finishes.filter((f) => f.position === 1 && f.playerCount >= 3).length;
  const podiums = finishes.filter((f) => f.position <= 3 && f.playerCount >= 4).length;

  const best =
    finishes.length === 0
      ? null
      : finishes.reduce((a, b) => {
          if (b.position !== a.position) return b.position < a.position ? b : a;
          // Same position: the one against more players is the better result.
          return b.playerCount > a.playerCount ? b : a;
        });

  const recent = [...finishes]
    .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))
    .slice(0, 5);

  return {
    entered: participations.length,
    finished: finishes.length,
    wins,
    podiums,
    best,
    recent,
  };
}

/** "2nd of 12" / "joint 3rd of 8" */
export function describeFinish(f: TournamentFinish): string {
  const suffix =
    f.position % 100 >= 11 && f.position % 100 <= 13
      ? "th"
      : f.position % 10 === 1
        ? "st"
        : f.position % 10 === 2
          ? "nd"
          : f.position % 10 === 3
            ? "rd"
            : "th";
  return `${f.shared ? "joint " : ""}${f.position}${suffix} of ${f.playerCount}`;
}
