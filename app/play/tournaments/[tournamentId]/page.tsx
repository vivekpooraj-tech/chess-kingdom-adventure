"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import {
  getTournament,
  getTournamentStandings,
  getTournamentPairingsForRound,
  getMyTournamentParticipant,
  getTournamentParticipantCount,
  joinTournament,
  startTournament,
  Tournament,
  TournamentStandingRow,
  TournamentPairing,
} from "@/lib/supabase/tournamentQueries";
import { getTimeControl } from "@/content/timeControls";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting for players...",
  starting: "Starting...",
  active: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TournamentDetailPage() {
  const params = useParams<{ tournamentId: string }>();
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  const [childId, setChildId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null | "loading">("loading");
  const [participantCount, setParticipantCount] = useState(0);
  const [myParticipant, setMyParticipant] = useState<{ id: string; points: number; seed: number } | null>(null);
  const [standings, setStandings] = useState<TournamentStandingRow[]>([]);
  const [roundPairings, setRoundPairings] = useState<TournamentPairing[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: resolve the signed-in child once.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = supabaseRef.current;
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      if (!cancelled) setChildId(resolution.child!.id);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Step 2: once we know who's asking, load tournament state and subscribe
  // to live updates — new joins while waiting, round/status changes once
  // active, pairing rows appearing each new round. refreshRef lets
  // handleJoin/handleStart trigger an immediate local refresh right after
  // their own RPC call succeeds, instead of waiting on the realtime
  // round-trip — the same fix as the Profile-tab responsiveness pass:
  // don't make the UI's first sign of life depend purely on a websocket
  // event when the client already knows its own action just succeeded.
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    const supabase = supabaseRef.current;

    async function refresh() {
      const t = await getTournament(supabase, params.tournamentId);
      if (cancelled) return;
      setTournament(t);
      if (!t) return;

      const [count, mine] = await Promise.all([
        getTournamentParticipantCount(supabase, params.tournamentId),
        getMyTournamentParticipant(supabase, params.tournamentId, childId!),
      ]);
      if (cancelled) return;
      setParticipantCount(count);
      setMyParticipant(mine);

      if (t.current_round > 0) {
        const [standingsRows, pairings] = await Promise.all([
          getTournamentStandings(supabase, params.tournamentId),
          getTournamentPairingsForRound(supabase, params.tournamentId, t.current_round),
        ]);
        if (cancelled) return;
        setStandings(standingsRows);
        setRoundPairings(pairings);
      } else {
        setStandings([]);
        setRoundPairings([]);
      }
    }
    refreshRef.current = () => {
      refresh();
    };
    refresh();

    const channel = supabase
      .channel(`tournament_${params.tournamentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${params.tournamentId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${params.tournamentId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_pairings", filter: `tournament_id=eq.${params.tournamentId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "online_games", filter: `tournament_id=eq.${params.tournamentId}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [childId, params.tournamentId]);

  if (tournament === "loading" || !childId) {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  if (!tournament) {
    return (
      <>
        <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
          <SecondaryCard className="max-w-sm w-full text-center flex flex-col gap-4 items-center">
            <span className="text-5xl">🔍</span>
            <p className={TEXT.body}>This tournament doesn&apos;t exist, or was removed.</p>
            <Link href="/play/tournaments">
              <Button tone="premium">Back to Tournaments →</Button>
            </Link>
          </SecondaryCard>
        </main>
        <PrimaryNav />
      </>
    );
  }

  const tc = getTimeControl(tournament.time_control);
  const isCreator = tournament.creator_child_id === childId;
  const isParticipant = !!myParticipant;
  const isFull = participantCount >= tournament.max_players;
  const canJoin = tournament.status === "waiting" && !isParticipant && !isFull;
  const canStart = tournament.status === "waiting" && isCreator && participantCount >= 2;

  const nameById = new Map(standings.map((s) => [s.participant_id, s.display_name]));
  const myPairing = myParticipant
    ? roundPairings.find(
        (p) => p.white_participant_id === myParticipant!.id || p.black_participant_id === myParticipant!.id
      )
    : undefined;
  const gamesInRound = roundPairings.filter((p) => !p.is_bye);
  const myRank = standings.find((s) => s.participant_id === myParticipant?.id)?.rank;

  async function handleJoin() {
    if (!childId || !tournament || tournament === "loading") return;
    const tournamentId = tournament.id;
    setBusy(true);
    setError(null);
    try {
      const result = await joinTournament(supabaseRef.current, tournamentId, childId);
      if (!result.joined && result.reason === "full") setError("Tournament Full");
      else if (!result.joined && result.reason === "already_started") setError("This tournament has already started.");
      else refreshRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!childId || !tournament || tournament === "loading") return;
    const tournamentId = tournament.id;
    setBusy(true);
    setError(null);
    try {
      await startTournament(supabaseRef.current, tournamentId, childId);
      refreshRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the tournament.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <p className={`${TEXT.meta} text-premium-gold`}>
            {tc.label} {tournament.category}
          </p>
          <h1 className={`${TEXT.display} mt-1`}>{tournament.name}</h1>
          <p className={`${TEXT.body} mt-2`}>
            {participantCount}/{tournament.max_players} players · {tournament.rounds_total} rounds
          </p>
        </div>

        {error && <p className="font-classic-body text-sm text-red-300">{error}</p>}

        {/* --- Waiting / starting: lobby --- */}
        {(tournament.status === "waiting" || tournament.status === "starting") && (
          <SecondaryCard className="w-full max-w-md text-center flex flex-col items-center gap-3">
            <p className={TEXT.body}>{STATUS_LABEL[tournament.status]}</p>
            {isFull && !isParticipant && (
              <p className="font-classic-display text-lg text-premium-gold">Tournament Full</p>
            )}
            {canJoin && (
              <Button tone="premium" onClick={handleJoin} disabled={busy}>
                {busy ? "Joining..." : "Join Tournament"}
              </Button>
            )}
            {isParticipant && tournament.status === "waiting" && (
              <p className={`${TEXT.caption} normal-case`}>You&apos;re in — waiting for the tournament to start.</p>
            )}
            {canStart && (
              <Button tone="premium" onClick={handleStart} disabled={busy}>
                {busy ? "Starting..." : "Start Tournament"}
              </Button>
            )}
          </SecondaryCard>
        )}

        {/* --- Active: my pairing + round status --- */}
        {tournament.status === "active" && (
          <>
            <div className="w-full max-w-md text-center">
              <p className={`${TEXT.caption} uppercase tracking-wide`}>
                Round {tournament.current_round} / {tournament.rounds_total}
              </p>
            </div>

            {myPairing ? (
              myPairing.is_bye ? (
                <PrimaryCard className="w-full max-w-md text-center flex flex-col items-center gap-2">
                  <span className="text-3xl">😴</span>
                  <p className={TEXT.heading}>BYE — +1 point</p>
                  <p className={`${TEXT.caption} normal-case`}>No game this round — you get a free point.</p>
                </PrimaryCard>
              ) : (
                <PrimaryCard className="w-full max-w-md flex flex-col items-center gap-3">
                  <p className={`${TEXT.caption} uppercase tracking-wide`}>Your Pairing</p>
                  <div className="flex items-center gap-3 text-center">
                    <div>
                      <p className="text-2xl">♔</p>
                      <p className="font-classic-display text-sm text-premium-ivory">
                        {nameById.get(myPairing.white_participant_id) ?? "Player"}
                      </p>
                    </div>
                    <p className={TEXT.caption}>vs</p>
                    <div>
                      <p className="text-2xl">♚</p>
                      <p className="font-classic-display text-sm text-premium-ivory">
                        {myPairing.black_participant_id ? nameById.get(myPairing.black_participant_id) ?? "Player" : "—"}
                      </p>
                    </div>
                  </div>
                  <p className={TEXT.caption}>
                    {tc.label} {tournament.category}
                  </p>
                  {myPairing.online_game_id && (
                    <Link href={`/online/${myPairing.online_game_id}`}>
                      <Button tone="premium">Play Game →</Button>
                    </Link>
                  )}
                </PrimaryCard>
              )
            ) : (
              <SecondaryCard className="w-full max-w-md text-center">
                <p className={TEXT.body}>No pairing found for you this round.</p>
              </SecondaryCard>
            )}

            <p className={`${TEXT.caption} normal-case`}>{gamesInRound.length} games this round</p>
          </>
        )}

        {/* --- Completed: final standings --- */}
        {tournament.status === "completed" && (
          <PrimaryCard className="w-full max-w-md text-center flex flex-col items-center gap-3">
            <span className="text-4xl">🏆</span>
            <p className={TEXT.heading}>Tournament Complete</p>
            {myRank && (
              <p className={`${TEXT.body}`}>
                You finished <span className="text-premium-gold font-semibold">#{myRank}</span> of {standings.length}
              </p>
            )}
          </PrimaryCard>
        )}

        {/* --- Standings (shown once the tournament has actually started) --- */}
        {standings.length > 0 && (
          <div className="w-full max-w-md flex flex-col gap-2">
            <p className={`${TEXT.caption} uppercase tracking-wide`}>Standings</p>
            <div className="flex flex-col gap-1.5">
              {standings.map((s) => (
                <div
                  key={s.participant_id}
                  className={`flex items-center gap-3 rounded-premiumBtn px-4 py-2.5 border ${
                    s.participant_id === myParticipant?.id
                      ? "bg-premium-gold/10 border-premium-gold/40"
                      : "bg-premium-navy/60 border-white/5"
                  }`}
                >
                  <span className="w-8 flex-none font-classic-display text-sm text-premium-ivory/70">
                    {MEDALS[s.rank - 1] ?? `#${s.rank}`}
                  </span>
                  <span className="flex-1 min-w-0 font-classic-body text-sm text-premium-ivory truncate">
                    {s.display_name}
                  </span>
                  <span className="font-classic-display text-sm text-premium-gold flex-none">{s.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <PrimaryNav />
    </>
  );
}
