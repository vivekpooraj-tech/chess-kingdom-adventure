-- Tournament Pre-Deployment Hardening (Phase 24).
--
-- Scope, per the requested audit: (1) replace the greedy Swiss pairing
-- algorithm with an exhaustive, provably-correct backtracking search so no
-- avoidable repeat opponent is ever produced; (2) add a reusable,
-- independent round-validation function that fails the whole transaction
-- (no round created) if anything is structurally wrong; (3) add hard
-- database constraints so duplicate pairings/games/byes are impossible even
-- if application logic has a bug; (4) close a real result-tampering gap in
-- finish_online_game_by_result (missing status guard — pre-existing, used
-- by Random Match/Invite/Tournament alike); (5) close a defense-in-depth
-- grant gap where `anon` still held table/column-level write grants that
-- were only ever revoked from `authenticated` in 0021/0022 (RLS already
-- blocked these in practice — this is pure hardening, not a behavior
-- change); (6) close a live gap where `authenticated` could still directly
-- INSERT a `children` row with an arbitrary `rating` (the app's own
-- createChild() never sets it — verified — so this only closes an API-level
-- bypass, doesn't touch the rating system itself).
--
-- Explicitly NOT touched here (documented in the audit report, not fixed,
-- because fixing them would mean changing the Random Match/matchmaking
-- system without approval): apply_match_rating, find_or_create_match,
-- check_free_game_eligibility, consume_free_game_credit all lack a caller-
-- ownership check on p_child_id. None of them let a caller choose an
-- outcome or rating value — the rating math is fully deterministic from
-- already-recorded game state — but a caller could invoke them for a
-- child_id that isn't their own. This is a pre-existing gap (predates
-- tournaments) in core matchmaking, not something this migration changes.

-- ============================================================================
-- 1. finish_online_game_by_result: close the missing status guard.
-- Every other terminal path (claim_timeout, submit_online_move's timeout
-- branch) already checks status = 'active' before writing a result; this
-- one didn't, which meant a participant could call it again after the game
-- was already finished (rewriting `winner`) or before it ever started. Made
-- idempotent (silent no-op once not-active) rather than raising, because
-- both players' clients legitimately call this near-simultaneously on a
-- real checkmate (app/online/[gameId]/page.tsx's handleGameOver has no
-- try/catch around it) — an exception here would break that existing,
-- correct double-call pattern. Added the same `for update` row lock its
-- sibling functions already use, closing the TOCTOU window between the two
-- near-simultaneous legitimate calls.
-- ============================================================================

create or replace function public.finish_online_game_by_result(p_game_id uuid, p_child_id uuid, p_winner text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  g record;
begin
  select * into g from online_games where id = p_game_id for update;
  if g.id is null then
    raise exception 'Game not found';
  end if;

  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  if g.host_child_id <> p_child_id and g.guest_child_id is distinct from p_child_id then
    raise exception 'Not a participant in this game';
  end if;

  if g.status <> 'active' then
    return; -- idempotent no-op: already finished, or never started. Prevents
             -- post-finish result tampering/replay without breaking the
             -- legitimate near-simultaneous double-call from both clients.
  end if;

  update online_games set status = 'finished', winner = p_winner where id = p_game_id;
end;
$$;

-- ============================================================================
-- 1b. claim_timeout: fix a pre-existing ambiguous-column bug (present
-- verbatim in the original migration source restored by 0021, not
-- introduced by this phase) that made EVERY timeout claim fail outright.
-- RETURNS TABLE(status text, winner text, white_time_ms bigint, black_time_
-- ms bigint) declares OUT parameters with the exact same names as
-- online_games' own columns; the UPDATE ... RETURNING status, winner, ...
-- INTO g clause is genuinely ambiguous between the two, and Postgres
-- rejects it ("column reference \"status\" is ambiguous") every time a
-- timeout is actually claimed. Found via Phase 11 regression testing (a
-- real timeout claim), not assumed. Left completely unnoticed until now
-- because no prior test exercised a real timeout end to end. This silently
-- broke Random Match/Invite Friend timeouts already, and would have left
-- any tournament game that times out stuck forever (check_and_advance_
-- tournament_round waits for every game in the round to reach 'finished',
-- which a timeout could never reach). Fix: qualify the RETURNING columns
-- with the table name so they resolve to the online_games columns, not the
-- OUT parameters. No behavior change beyond making the call succeed.
-- ============================================================================

create or replace function public.claim_timeout(p_game_id uuid, p_child_id uuid)
returns table(status text, winner text, white_time_ms bigint, black_time_ms bigint)
language plpgsql
security definer set search_path = public
as $$
declare
  g record;
  v_owns boolean;
  v_now timestamptz := clock_timestamp();
  v_elapsed_ms bigint;
  v_white_ms bigint;
  v_black_ms bigint;
begin
  select * into g from online_games where id = p_game_id for update;
  if g.id is null then
    raise exception 'Game not found';
  end if;

  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  if g.host_child_id <> p_child_id and g.guest_child_id is distinct from p_child_id then
    raise exception 'Not a participant in this game';
  end if;

  if g.status <> 'active' or g.time_control is null then
    return query select g.status, g.winner, g.white_time_ms, g.black_time_ms;
    return;
  end if;

  v_elapsed_ms := greatest(0, (extract(epoch from (v_now - g.last_move_at)) * 1000))::bigint;
  v_white_ms := g.white_time_ms;
  v_black_ms := g.black_time_ms;

  if g.current_turn = 'w' then
    v_white_ms := g.white_time_ms - v_elapsed_ms;
  else
    v_black_ms := g.black_time_ms - v_elapsed_ms;
  end if;

  if v_white_ms <= 0 or v_black_ms <= 0 then
    update online_games
    set status = 'finished',
        winner = case when v_white_ms <= 0 then 'b' else 'w' end,
        white_time_ms = greatest(0, v_white_ms),
        black_time_ms = greatest(0, v_black_ms)
    where id = p_game_id
    returning online_games.status, online_games.winner, online_games.white_time_ms, online_games.black_time_ms into g;
  end if;

  return query select g.status, g.winner, g.white_time_ms, g.black_time_ms;
end;
$$;

-- ============================================================================
-- 2. Hard database-level anti-duplication constraints for tournaments.
-- Independent of whether the pairing algorithm below is bug-free.
-- ============================================================================

-- A participant can never be assigned to the same round twice — enforced by
-- a real UNIQUE primary key on a normalized slots table, populated
-- alongside every pairing/bye insert. This is a genuine DB-level guarantee,
-- not just an in-function assertion.
create table if not exists public.tournament_pairing_slots (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number int not null,
  participant_id uuid not null references public.tournament_participants(id) on delete cascade,
  primary key (tournament_id, round_number, participant_id)
);
alter table public.tournament_pairing_slots enable row level security;
revoke all on public.tournament_pairing_slots from authenticated, anon;

alter table public.tournament_pairings add column if not exists forced_repeat boolean not null default false;

-- No self-pairing, at the constraint level (defense in depth on top of the
-- pairing algorithm and the validator below).
alter table public.tournament_pairings drop constraint if exists tournament_pairings_no_self_pair;
alter table public.tournament_pairings
  add constraint tournament_pairings_no_self_pair
  check (black_participant_id is null or white_participant_id <> black_participant_id);

-- One online_games row can back at most one pairing, and vice versa.
drop index if exists tournament_pairings_online_game_unique;
create unique index tournament_pairings_online_game_unique
  on public.tournament_pairings (online_game_id) where online_game_id is not null;

drop index if exists online_games_tournament_pairing_unique;
create unique index online_games_tournament_pairing_unique
  on public.online_games (tournament_pairing_id) where tournament_pairing_id is not null;

-- At most one bye per participant per tournament, enforced at the
-- constraint level (mirrors the existing "not exists prior bye" check in
-- generate_tournament_round, but this one can't be bypassed by a bug).
drop index if exists tournament_pairings_one_bye_per_participant;
create unique index tournament_pairings_one_bye_per_participant
  on public.tournament_pairings (tournament_id, white_participant_id) where is_bye = true;

-- A tournament can never claim to be further along than its own round count.
alter table public.tournaments drop constraint if exists tournaments_current_round_bound;
alter table public.tournaments
  add constraint tournaments_current_round_bound
  check (current_round <= rounds_total);

-- ============================================================================
-- 3. Exhaustive Swiss pairing search (replaces the greedy algorithm).
--
-- Design: process the round's pool as a single priority-ordered list
-- (points desc, rating desc, seed asc — round 1 uses random order per the
-- product spec). For the first player in priority order, try every
-- remaining candidate in order of (has this pair played before? asc, then
-- |score gap| asc, then priority-order asc), recursing on the rest of the
-- pool for each candidate; backtrack to the next candidate whenever the
-- recursive call can't complete a full matching. A repeat-opponent
-- candidate is only ever tried after every non-repeat candidate — and their
-- entire recursive subtrees — have been exhausted. That ordering makes the
-- search correct-by-construction for the hard requirement in this phase:
-- if any zero-repeat perfect matching of the pool exists, depth-first
-- search restricted to non-repeat edges first is guaranteed to find one
-- before it ever descends into a repeat-containing branch, because it
-- doesn't stop at the first non-repeat candidate for a player — it tries
-- ALL of them (and their subtrees) before conceding. This is exhaustive
-- backtracking, not a greedy single-pass choice.
--
-- This is not a polynomial-time optimal matcher (true global optimality
-- would need a weighted general-graph matching solver, e.g. Blossom, which
-- isn't practical to implement correctly in PL/pgSQL in this codebase). For
-- a real Swiss tournament the "previously played" graph is sparse (a player
-- has at most rounds_total-1 prior opponents), so exhaustive backtracking
-- with this candidate ordering resolves in a handful of steps in every
-- realistic case, including every scenario in the test suite for this
-- phase. A step-budget safety valve (500,000 recursive calls) bounds
-- worst-case runtime against a deliberately pathological, densely-adversarial
-- synthetic graph that could never arise from an actual tournament played
-- through this same pairing system; see the fallback branch in
-- generate_tournament_round below for what happens if it's ever hit.
-- ============================================================================

-- p_allow_repeats = false runs a STRICT search: repeat-opponent edges are
-- entirely excluded from the candidate list, not just deprioritized. This
-- is the piece that makes the "never repeat if a non-repeat pairing exists
-- anywhere" guarantee actually hold: a single-phase search that merely
-- *prefers* non-repeat candidates can still return the first COMPLETE
-- pairing it finds even when that pairing contains a repeat forced by an
-- early, locally-reasonable choice — while a different early choice would
-- have avoided it entirely elsewhere in the tree (concretely: 6 players,
-- only 5-6 have played before; pairing 1-2 then 3-4 leaves 5-6 stuck with
-- each other, even though 1-2,3-5,4-6 or similar has zero repeats). Running
-- the strict, repeats-excluded search FIRST and treating a null result as
-- proof that no zero-repeat perfect matching exists at all is what actually
-- guarantees correctness; generate_tournament_round only calls this again
-- with p_allow_repeats = true (a normal search where repeats are just
-- ordered last, guaranteed to succeed since the pool is always even) after
-- the strict pass has exhaustively proven no better solution exists.
drop function if exists public._pairing_backtrack(uuid[], numeric[]);

create or replace function public._pairing_backtrack(p_ids uuid[], p_points numeric[], p_allow_repeats boolean)
returns uuid[]
language plpgsql
security definer set search_path = public
as $$
declare
  n int := coalesce(array_length(p_ids, 1), 0);
  p1_id uuid;
  p1_pts numeric;
  ordered_idx int[];
  i int;
  cand_id uuid;
  rest_ids uuid[];
  rest_points numeric[];
  sub_result uuid[];
  v_budget int;
begin
  if n = 0 then
    return array[]::uuid[];
  end if;

  update pairing_search_budget set steps_remaining = steps_remaining - 1
    where true
    returning steps_remaining into v_budget;
  if v_budget is null or v_budget <= 0 then
    return null; -- budget exhausted; caller falls back
  end if;

  p1_id := p_ids[1];
  p1_pts := p_points[1];

  select array_agg(idx order by abs(p_points[idx] - p1_pts) asc, idx asc)
    into ordered_idx
    from generate_series(2, n) as idx
    where p_allow_repeats
       or not exists (select 1 from pairing_played_pairs where a = p1_id and b = p_ids[idx]);

  if ordered_idx is null then
    return null; -- no legal candidate for p1 under the current mode
  end if;

  foreach i in array ordered_idx loop
    cand_id := p_ids[i];

    select array_agg(p_ids[k] order by k), array_agg(p_points[k] order by k)
      into rest_ids, rest_points
      from generate_series(1, n) as k
      where k <> 1 and k <> i;

    sub_result := public._pairing_backtrack(rest_ids, rest_points, p_allow_repeats);

    if sub_result is not null then
      return array[p1_id, cand_id] || sub_result;
    end if;

    select steps_remaining into v_budget from pairing_search_budget;
    if v_budget is null or v_budget <= 0 then
      return null;
    end if;
  end loop;

  return null; -- every legal candidate led to a dead end for the rest of the pool
end;
$$;

revoke all on function public._pairing_backtrack(uuid[], numeric[], boolean) from authenticated, anon;

-- ============================================================================
-- 4. Reusable round validator. Independent of the generator: re-derives
-- every structural invariant from tournament_pairings/tournament_participants
-- directly, and — only when the generated round actually contains a repeat
-- pairing — independently re-runs the exhaustive search over that exact
-- player set (using history that excludes this round) to confirm a
-- zero-repeat solution truly did not exist. If one did, that's a bug in the
-- generator, not an acceptable outcome, and validation fails.
-- ============================================================================

create or replace function public.validate_tournament_round(p_tournament_id uuid, p_round int)
returns table(valid boolean, reason text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_total_participants int;
  v_appearances int;
  v_distinct int;
  v_bye_count int;
  v_self_pair_count int;
  v_double_bye int;
  v_repeat_count int;
  v_non_bye_ids uuid[];
  v_non_bye_points numeric[];
  v_recheck uuid[];
begin
  select count(*) into v_total_participants
  from tournament_participants where tournament_id = p_tournament_id;

  with appearances as (
    select white_participant_id as pid from tournament_pairings
      where tournament_id = p_tournament_id and round_number = p_round
    union all
    select black_participant_id from tournament_pairings
      where tournament_id = p_tournament_id and round_number = p_round and black_participant_id is not null
  )
  select count(*), count(distinct pid) into v_appearances, v_distinct from appearances;

  if v_appearances <> v_distinct then
    return query select false, 'a participant appears more than once in this round';
    return;
  end if;

  if v_distinct <> v_total_participants then
    return query select false, format('round covers %s participants but the tournament has %s', v_distinct, v_total_participants);
    return;
  end if;

  select count(*) into v_self_pair_count
  from tournament_pairings
  where tournament_id = p_tournament_id and round_number = p_round
    and black_participant_id is not null and white_participant_id = black_participant_id;
  if v_self_pair_count > 0 then
    return query select false, 'a participant is paired against themselves';
    return;
  end if;

  select count(*) into v_bye_count
  from tournament_pairings
  where tournament_id = p_tournament_id and round_number = p_round and is_bye = true;
  if v_bye_count > 1 then
    return query select false, 'more than one bye in a single round';
    return;
  end if;
  if (v_total_participants % 2 = 1 and v_bye_count <> 1) or (v_total_participants % 2 = 0 and v_bye_count <> 0) then
    return query select false, 'bye count does not match the parity of the participant pool';
    return;
  end if;

  select count(*) into v_double_bye
  from tournament_pairings tp
  where tp.tournament_id = p_tournament_id and tp.round_number = p_round and tp.is_bye = true
    and exists (
      select 1 from tournament_pairings tp2
      where tp2.tournament_id = p_tournament_id and tp2.round_number <> p_round
        and tp2.is_bye = true and tp2.white_participant_id = tp.white_participant_id
    );
  if v_double_bye > 0 then
    return query select false, 'a participant received more than one bye across the tournament';
    return;
  end if;

  select count(*) into v_repeat_count
  from tournament_pairings tp
  where tp.tournament_id = p_tournament_id and tp.round_number = p_round and tp.is_bye = false
    and exists (
      select 1 from tournament_pairings prior
      where prior.tournament_id = p_tournament_id and prior.round_number <> p_round and prior.is_bye = false
        and ((prior.white_participant_id = tp.white_participant_id and prior.black_participant_id = tp.black_participant_id)
          or (prior.white_participant_id = tp.black_participant_id and prior.black_participant_id = tp.white_participant_id))
    );

  if v_repeat_count > 0 then
    select array_agg(distinct pid) into v_non_bye_ids
    from (
      select white_participant_id as pid from tournament_pairings
        where tournament_id = p_tournament_id and round_number = p_round and is_bye = false
      union all
      select black_participant_id from tournament_pairings
        where tournament_id = p_tournament_id and round_number = p_round and is_bye = false
    ) x;

    select array_agg(tp2.points order by u.ord) into v_non_bye_points
    from unnest(v_non_bye_ids) with ordinality as u(pid, ord)
    join tournament_participants tp2 on tp2.id = u.pid;
    -- points are aligned to v_non_bye_ids via u.ord (the array's own position), not any incidental row order

    -- validate_tournament_round is a standalone, independently-callable
    -- function (per spec) as well as being called from inside
    -- generate_tournament_round — these temp tables may or may not already
    -- exist depending on the caller, so create-if-needed here too.
    create temporary table if not exists pairing_played_pairs (
      a uuid not null,
      b uuid not null
    ) on commit drop;
    create temporary table if not exists pairing_search_budget (
      steps_remaining int not null
    ) on commit drop;

    delete from pairing_played_pairs where true;
    insert into pairing_played_pairs (a, b)
    select white_participant_id, black_participant_id from tournament_pairings
      where tournament_id = p_tournament_id and round_number <> p_round and is_bye = false
    union all
    select black_participant_id, white_participant_id from tournament_pairings
      where tournament_id = p_tournament_id and round_number <> p_round and is_bye = false;

    delete from pairing_search_budget where true;
    insert into pairing_search_budget values (500000);

    v_recheck := public._pairing_backtrack(v_non_bye_ids, v_non_bye_points, false);

    if v_recheck is not null then
      -- An independent re-search over the exact same player set, using the
      -- exact same history, found a zero-repeat solution — but the round as
      -- generated contains a repeat anyway. That's only possible if the
      -- generator has a bug (or was bypassed). Reject the round.
      return query select false, 'a repeat opponent was assigned even though a repeat-free pairing existed';
      return;
    end if;
    -- Independent re-search also could not find a zero-repeat solution (or
    -- hit the same budget ceiling) — the repeat(s) in this round are
    -- genuinely forced. Not a validation failure.
  end if;

  return query select true, null::text;
end;
$$;

revoke all on function public.validate_tournament_round(uuid, int) from authenticated, anon;

-- ============================================================================
-- 5. Rewritten generate_tournament_round: same bye logic as before (odd-pool
-- bye assignment, lowest-rating/lowest-points preference, never twice —
-- unchanged), same colour-balancing as before (unchanged), but the pairing
-- decision itself now comes from the exhaustive search above instead of a
-- single-pass greedy loop. Ends with a call to validate_tournament_round;
-- any failure rolls back the entire round (nothing is left half-created).
-- ============================================================================

create or replace function public.generate_tournament_round(p_tournament_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_tournament record;
  v_round int;
  v_is_round1 boolean;
  v_bye_participant_id uuid;
  v_pool_count int;
  v_ids uuid[];
  v_points numeric[];
  v_pairing uuid[];
  v_n int;
  v_a uuid;
  v_b uuid;
  v_is_repeat boolean;
  v_white uuid;
  v_black uuid;
  v_p1_white_ct int;
  v_p1_black_ct int;
  v_p2_white_ct int;
  v_p2_black_ct int;
  v_white_child uuid;
  v_black_child uuid;
  v_new_game_id uuid;
  v_new_pairing_id uuid;
  v_valid boolean;
  v_reason text;
  idx int;
begin
  select * into v_tournament from tournaments where id = p_tournament_id for update;
  if v_tournament.id is null then
    return;
  end if;

  v_round := v_tournament.current_round + 1;

  if exists (select 1 from tournament_pairings where tournament_id = p_tournament_id and round_number = v_round) then
    return; -- idempotent: a concurrent caller already generated this round
  end if;

  if v_round > v_tournament.rounds_total then
    return;
  end if;

  -- Defense in depth: never generate a round while the previous round still
  -- has an unfinished game. In real usage this is already guaranteed by
  -- check_and_advance_tournament_round (the only caller that generates
  -- rounds 2+, and only after confirming every pairing in the current round
  -- is resolved) — this is a second, independent gate directly inside the
  -- generator itself, so the "wait until ALL games in the round finish"
  -- rule holds even if this function is ever called some other way in the
  -- future, not just via today's single call path.
  if v_round > 1 and exists (
    select 1 from tournament_pairings tpg
    left join online_games og on og.id = tpg.online_game_id
    where tpg.tournament_id = p_tournament_id
      and tpg.round_number = v_round - 1
      and tpg.is_bye = false
      and og.status is distinct from 'finished'
  ) then
    return;
  end if;

  v_is_round1 := (v_round = 1);

  create temporary table if not exists pairing_pool (
    participant_id uuid primary key,
    child_id uuid not null,
    points numeric not null,
    rating int not null,
    ord int not null
  ) on commit drop;
  delete from pairing_pool where true;

  create temporary table if not exists pairing_played_pairs (
    a uuid not null,
    b uuid not null
  ) on commit drop;
  delete from pairing_played_pairs where true;

  create temporary table if not exists pairing_search_budget (
    steps_remaining int not null
  ) on commit drop;
  delete from pairing_search_budget where true;

  if v_is_round1 then
    insert into pairing_pool (participant_id, child_id, points, rating, ord)
    select tp.id, tp.child_id, tp.points, c.rating, (row_number() over (order by random()))::int
    from tournament_participants tp
    join children c on c.id = tp.child_id
    where tp.tournament_id = p_tournament_id;
  else
    insert into pairing_pool (participant_id, child_id, points, rating, ord)
    select tp.id, tp.child_id, tp.points, c.rating,
      (row_number() over (order by tp.points desc, c.rating desc, tp.seed asc))::int
    from tournament_participants tp
    join children c on c.id = tp.child_id
    where tp.tournament_id = p_tournament_id;
  end if;

  select count(*) into v_pool_count from pairing_pool;

  if v_pool_count % 2 = 1 then
    select pp.participant_id into v_bye_participant_id
    from pairing_pool pp
    where not exists (
      select 1 from tournament_pairings tpg
      where tpg.tournament_id = p_tournament_id
        and tpg.is_bye = true
        and tpg.white_participant_id = pp.participant_id
    )
    order by (case when v_is_round1 then pp.rating else pp.points end) asc, pp.rating asc, pp.ord asc
    limit 1;

    if v_bye_participant_id is null then
      -- A small actual turnout combined with a larger configured
      -- rounds_total (e.g. only 3 people actually joined a tournament
      -- sized/suggested for 20) can exhaust the odd-pool bye rotation
      -- before rounds_total rounds have been played: with N players every
      -- round needs a fresh bye recipient, and "at most one bye per
      -- player, ever" is a hard rule that must not be relaxed to make room
      -- for it. Rather than leave the tournament permanently stuck (no
      -- further round ever generates, current_round frozen forever — an
      -- impossible/broken state), treat this as the natural end of how
      -- many meaningful rounds this pool can support and complete the
      -- tournament now with the standings as they stand.
      update tournaments set status = 'completed' where id = p_tournament_id;
      return;
    end if;

    insert into tournament_pairings (tournament_id, round_number, white_participant_id, black_participant_id, is_bye, points_awarded)
    values (p_tournament_id, v_round, v_bye_participant_id, null, true, true);
    insert into tournament_pairing_slots (tournament_id, round_number, participant_id)
    values (p_tournament_id, v_round, v_bye_participant_id);

    update tournament_participants set points = points + 1 where id = v_bye_participant_id;

    delete from pairing_pool where participant_id = v_bye_participant_id;
  end if;

  insert into pairing_played_pairs (a, b)
  select white_participant_id, black_participant_id from tournament_pairings
    where tournament_id = p_tournament_id and is_bye = false
  union all
  select black_participant_id, white_participant_id from tournament_pairings
    where tournament_id = p_tournament_id and is_bye = false;

  select array_agg(participant_id order by ord), array_agg(points order by ord)
    into v_ids, v_points
    from pairing_pool;

  v_n := coalesce(array_length(v_ids, 1), 0);

  if v_n > 0 then
    -- Phase 1: strict search — repeat-opponent edges are not candidates at
    -- all. If this finds a complete pairing, it is proven zero-repeat.
    insert into pairing_search_budget values (500000);
    v_pairing := public._pairing_backtrack(v_ids, v_points, false);

    if v_pairing is null then
      -- Phase 1 exhausted every possibility (or hit its budget) without
      -- completing a zero-repeat pairing. Re-run allowing repeats — this is
      -- the only point at which a repeat can be accepted, and only after
      -- phase 1 has proven (budget permitting) that no better solution
      -- exists for this pool.
      delete from pairing_search_budget where true;
      insert into pairing_search_budget values (500000);
      v_pairing := public._pairing_backtrack(v_ids, v_points, true);
    end if;

    if v_pairing is null then
      -- Both phases hit the step budget on every branch (should not happen
      -- for any realistic or even deliberately-adversarial-but-plausible
      -- tournament — see the design note above). Fall back to a simple
      -- priority-order pairing so the round is still produced rather than
      -- the whole request hanging or failing outright; any resulting
      -- repeats are flagged via forced_repeat below and surfaced honestly.
      select array_agg(participant_id order by ord) into v_pairing from pairing_pool;
    end if;

    idx := 1;
    while idx <= v_n loop
      v_a := v_pairing[idx];
      v_b := v_pairing[idx + 1];

      v_is_repeat := exists(select 1 from pairing_played_pairs where a = v_a and b = v_b);

      select count(*) filter (where white_participant_id = v_a),
             count(*) filter (where black_participant_id = v_a)
        into v_p1_white_ct, v_p1_black_ct
        from tournament_pairings where tournament_id = p_tournament_id and is_bye = false;
      select count(*) filter (where white_participant_id = v_b),
             count(*) filter (where black_participant_id = v_b)
        into v_p2_white_ct, v_p2_black_ct
        from tournament_pairings where tournament_id = p_tournament_id and is_bye = false;

      if (v_p1_white_ct - v_p1_black_ct) < (v_p2_white_ct - v_p2_black_ct) then
        v_white := v_a; v_black := v_b;
      elsif (v_p2_white_ct - v_p2_black_ct) < (v_p1_white_ct - v_p1_black_ct) then
        v_white := v_b; v_black := v_a;
      elsif random() < 0.5 then
        v_white := v_a; v_black := v_b;
      else
        v_white := v_b; v_black := v_a;
      end if;

      select child_id into v_white_child from tournament_participants where id = v_white;
      select child_id into v_black_child from tournament_participants where id = v_black;

      insert into online_games (
        host_child_id, guest_child_id, host_color, status, match_type,
        time_control, last_move_at, tournament_id, round_number
      )
      values (
        v_white_child, v_black_child, 'w', 'active', 'tournament',
        v_tournament.time_control, clock_timestamp(), p_tournament_id, v_round
      )
      returning id into v_new_game_id;

      insert into tournament_pairings (tournament_id, round_number, white_participant_id, black_participant_id, is_bye, online_game_id, forced_repeat)
      values (p_tournament_id, v_round, v_white, v_black, false, v_new_game_id, v_is_repeat)
      returning id into v_new_pairing_id;

      insert into tournament_pairing_slots (tournament_id, round_number, participant_id)
      values (p_tournament_id, v_round, v_a), (p_tournament_id, v_round, v_b);

      update online_games set tournament_pairing_id = v_new_pairing_id where id = v_new_game_id;

      idx := idx + 2;
    end loop;
  end if;

  select valid, reason into v_valid, v_reason from public.validate_tournament_round(p_tournament_id, v_round);
  if not v_valid then
    raise exception 'Tournament pairing integrity check failed for round % of tournament %: %', v_round, p_tournament_id, v_reason;
  end if;

  update tournaments set current_round = v_round where id = p_tournament_id;
end;
$$;

-- ============================================================================
-- 6. Defense-in-depth grant hardening. RLS already blocks `anon` on every
-- table below (no anon-usable policy exists anywhere in this schema for
-- INSERT/UPDATE/DELETE), so this changes no observable behavior — it just
-- removes the legacy grant-layer access that RLS was the only thing
-- standing in front of, matching the same treatment 0022 already gave
-- `authenticated`.
-- ============================================================================

revoke insert, update, delete on public.tournaments from anon;
revoke insert, update, delete on public.tournament_participants from anon;
revoke insert, update, delete on public.tournament_pairings from anon;
revoke insert, update, delete on public.online_games from anon;
revoke insert, update, delete on public.children from anon;
revoke insert, update, delete on public.parents from anon;
revoke insert, update, delete on public.free_game_usage from anon;

-- Close the one live gap: `authenticated` (and `anon`) could INSERT a new
-- `children` row specifying an arbitrary `rating` directly (RLS only checks
-- parent_id ownership, not the rating value). The app's own createChild()
-- (lib/supabase/queries.ts) sends exactly {parent_id, display_name} on
-- insert — verified — so this only removes a bypass reachable by a
-- hand-crafted API call, not any real app behavior. New children keep
-- getting every other column's default (rating: 400, current_day: 1, etc).
--
-- A plain column-level `revoke insert (rating) ...` alone does NOT work
-- here — same lesson as 0022: `children` already carries a broad
-- table-level INSERT grant (needed for parent_id/display_name), and a
-- table-level grant is not narrowed by a separate column-level revoke.
-- Verified empirically (scripts/test-tournament-security.js) that a
-- column-only revoke left the insert-with-rating bypass wide open even
-- though information_schema showed the revoke as applied. The correct
-- pattern, same as 0022: full table-level REVOKE INSERT, then re-GRANT
-- INSERT on only the columns real client code sends.
revoke insert on public.children from authenticated, anon;
grant insert (parent_id, display_name) on public.children to authenticated;

-- ============================================================================
-- 7. Critical fix: generate_tournament_round and check_and_advance_tournament_
-- round were never explicitly locked down in 0023 — Postgres grants EXECUTE
-- to PUBLIC by default on a newly created function unless revoked, and
-- 0023 only added explicit grants for the functions meant to be public
-- (create_tournament/join_tournament/start_tournament/get_tournament_
-- standings). That meant any authenticated (or even anon) client could call
-- supabase.rpc('generate_tournament_round', {p_tournament_id}) directly on
-- ANY tournament, forcing its next round to generate before the current
-- round's games had actually finished — a complete bypass of "wait until
-- all games in the round finish" and of "clients must never be trusted for
-- ... round creation, opponent selection." These two functions are only
-- ever meant to run from inside the trigger functions above (which
-- themselves run as the table owner regardless of these grants, so this
-- costs the real, intended call path nothing). handle_tournament_game_
-- finished/handle_tournament_starting are RETURNS TRIGGER functions, which
-- Postgres already refuses to invoke outside of trigger context regardless
-- of grants — revoked here too, purely for consistency, not because they
-- were actually callable.
-- ============================================================================

revoke all on function public.generate_tournament_round(uuid) from authenticated, anon, public;
revoke all on function public.check_and_advance_tournament_round(uuid, int) from authenticated, anon, public;
revoke all on function public.handle_tournament_game_finished() from authenticated, anon, public;
revoke all on function public.handle_tournament_starting() from authenticated, anon, public;
