import { Screen } from "@/components/layout/Screen";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import {
  getOpenTournaments,
  getMyTournaments,
  getParticipantCountsForTournaments,
  Tournament,
} from "@/lib/supabase/tournamentQueries";
import { getTimeControl } from "@/content/timeControls";
import { ListItemRow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting for players...",
  starting: "Starting...",
  active: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function TournamentRow({
  tournament,
  playerCount,
  extra,
}: {
  tournament: Tournament;
  playerCount: number;
  extra?: string;
}) {
  const tc = getTimeControl(tournament.time_control);
  return (
    <ListItemRow href={`/play/tournaments/${tournament.id}`}>
      <div className="flex-1 min-w-0">
        <p className="font-classic-display text-sm text-premium-ivory truncate">{tournament.name}</p>
        <p className={`${TEXT.caption} normal-case`}>
          {tc.label} {tournament.category} · {playerCount}/{tournament.max_players} players ·{" "}
          {tournament.rounds_total} rounds
        </p>
        <p className={`${TEXT.caption} normal-case text-premium-gold/80`}>
          {STATUS_LABEL[tournament.status] ?? tournament.status}
          {extra ? ` · ${extra}` : ""}
        </p>
      </div>
      <span className="text-premium-gold text-lg flex-none">→</span>
    </ListItemRow>
  );
}

export default async function TournamentsHubPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;
  if (!child.avatar_id || !child.buddy_id) redirect("/onboarding/avatar");

  const [openTournaments, myTournaments] = await Promise.all([
    getOpenTournaments(supabase),
    getMyTournaments(supabase, child.id),
  ]);

  const allIds = Array.from(new Set([...openTournaments.map((t) => t.id), ...myTournaments.map((t) => t.id)]));
  const counts = await getParticipantCountsForTournaments(supabase, allIds);

  return (
    <>
      <Screen maxWidth="medium">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Group Tournament</h1>
          <p className={`${TEXT.body} mt-2`}>
            Swiss-style — everyone plays every round, ranked by tournament points.
          </p>
        </div>

        <Link href="/play/tournaments/create" className="w-full">
          <Button tone="premium" className="w-full">
            Create Tournament
          </Button>
        </Link>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Open Tournaments</p>
          {openTournaments.length === 0 ? (
            <p className={TEXT.body}>No open tournaments right now — start one!</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {openTournaments.map((t) => (
                <TournamentRow key={t.id} tournament={t} playerCount={counts[t.id] ?? 0} />
              ))}
            </div>
          )}
        </section>

        <section className="w-full flex flex-col gap-2">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>My Tournaments</p>
          {myTournaments.length === 0 ? (
            <p className={TEXT.body}>You haven&apos;t joined a tournament yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {myTournaments.map((t) => (
                <TournamentRow
                  key={t.id}
                  tournament={t}
                  playerCount={counts[t.id] ?? 0}
                  extra={`${t.my_points} pts`}
                />
              ))}
            </div>
          )}
        </section>
      </Screen>
    </>
  );
}
