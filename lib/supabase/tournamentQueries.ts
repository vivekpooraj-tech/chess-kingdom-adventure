import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Group Tournament (Phase 23) query wrappers — kept in a separate file from
 * the already-large lib/supabase/queries.ts, matching this codebase's
 * existing pattern of concern-specific modules (lib/openings/,
 * lib/chess-engine/). Every write goes through a SECURITY DEFINER RPC (see
 * supabase/migrations/0023_group_tournaments.sql) — nothing here ever
 * inserts/updates a tournament table directly.
 */

export type TournamentStatus = "waiting" | "starting" | "active" | "completed" | "cancelled";
export type TournamentCategory = "Blitz" | "Rapid";

export interface Tournament {
  id: string;
  name: string;
  creator_child_id: string;
  category: TournamentCategory;
  time_control: string;
  max_players: number;
  rounds_total: number;
  current_round: number;
  status: TournamentStatus;
  created_at: string;
}

export interface TournamentStandingRow {
  participant_id: string;
  child_id: string;
  display_name: string;
  points: number;
  buchholz: number;
  seed: number;
  rank: number;
}

export interface TournamentPairing {
  id: string;
  tournament_id: string;
  round_number: number;
  white_participant_id: string;
  black_participant_id: string | null;
  is_bye: boolean;
  points_awarded: boolean;
  online_game_id: string | null;
  created_at: string;
}

export async function createTournament(
  supabase: SupabaseClient,
  params: {
    creatorChildId: string;
    name: string;
    category: TournamentCategory;
    timeControlId: string;
    maxPlayers: number;
    roundsTotal: number;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc("create_tournament", {
    p_creator_child_id: params.creatorChildId,
    p_name: params.name,
    p_category: params.category,
    p_time_control: params.timeControlId,
    p_max_players: params.maxPlayers,
    p_rounds_total: params.roundsTotal,
  });
  if (error) throw error;
  return data as string;
}

export interface JoinTournamentResult {
  joined: boolean;
  reason: "joined" | "already_joined" | "already_started" | "full" | "not_found";
}

export async function joinTournament(
  supabase: SupabaseClient,
  tournamentId: string,
  childId: string
): Promise<JoinTournamentResult> {
  const { data, error } = await supabase.rpc("join_tournament", {
    p_tournament_id: tournamentId,
    p_child_id: childId,
  });
  if (error) throw error;
  const row = data?.[0];
  return { joined: row?.joined ?? false, reason: row?.reason ?? "not_found" };
}

export async function startTournament(
  supabase: SupabaseClient,
  tournamentId: string,
  creatorChildId: string
): Promise<void> {
  const { error } = await supabase.rpc("start_tournament", {
    p_tournament_id: tournamentId,
    p_creator_child_id: creatorChildId,
  });
  if (error) throw error;
}

export async function getTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle();
  if (error) throw error;
  return data as Tournament | null;
}

export async function getOpenTournaments(supabase: SupabaseClient): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

/** Tournaments a specific child has joined (any status) — "My Tournaments". */
export async function getMyTournaments(
  supabase: SupabaseClient,
  childId: string
): Promise<(Tournament & { my_points: number })[]> {
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("points, tournaments!tournament_participants_tournament_id_fkey(*)")
    .eq("child_id", childId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((row: any) => row.tournaments)
    .map((row: any) => ({ ...row.tournaments, my_points: row.points }));
}

export async function getTournamentStandings(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<TournamentStandingRow[]> {
  const { data, error } = await supabase.rpc("get_tournament_standings", {
    p_tournament_id: tournamentId,
  });
  if (error) throw error;
  return (data ?? []) as TournamentStandingRow[];
}

export async function getTournamentPairingsForRound(
  supabase: SupabaseClient,
  tournamentId: string,
  round: number
): Promise<TournamentPairing[]> {
  const { data, error } = await supabase
    .from("tournament_pairings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round_number", round);
  if (error) throw error;
  return (data ?? []) as TournamentPairing[];
}

/** This child's own participant row in a tournament, if any. */
export async function getMyTournamentParticipant(
  supabase: SupabaseClient,
  tournamentId: string,
  childId: string
): Promise<{ id: string; points: number; seed: number } | null> {
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("id, points, seed")
    .eq("tournament_id", tournamentId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTournamentParticipantCount(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("tournament_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return count ?? 0;
}

/** Player counts for several tournaments at once (avoids N+1 in list views). */
export async function getParticipantCountsForTournaments(
  supabase: SupabaseClient,
  tournamentIds: string[]
): Promise<Record<string, number>> {
  if (tournamentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("tournament_id")
    .in("tournament_id", tournamentIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.tournament_id] = (counts[row.tournament_id] ?? 0) + 1;
  }
  return counts;
}
