-- Group Tournament (Phase 23) — Swiss-style tournament mode. Reuses the
-- existing online_games infrastructure for every actual game (board, moves,
-- clocks, result detection — none of that changes); this migration only
-- adds the tournament "container" around it: who's in it, what round
-- they're on, who they're paired against, and their tournament points
-- (deliberately separate from children.rating — see the audit note in the
-- approved plan; apply_match_rating() already ignores anything that isn't
-- match_type='random', so tournament games never touch rating with zero
-- changes to that function).
--
-- Three new tables (a tournament is a fundamentally different shape than
-- one online_games row — one group, many rounds, many games per round —
-- so it can't be folded into that table):
--   tournaments             — one row per tournament
--   tournament_participants — who's in it + running points
--   tournament_pairings     — one row per pairing per round; previous-
--                             opponent history, bye history, and colour
--                             history are all DERIVED by querying prior
--                             rows here, not stored redundantly.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator_child_id uuid not null references public.children(id) on delete cascade,
  category text not null check (category in ('Blitz', 'Rapid')),
  time_control text not null check (time_control in ('3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10')),
  max_players int not null check (max_players between 2 and 200),
  rounds_total int not null check (rounds_total between 1 and 20),
  current_round int not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'starting', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

-- Open SELECT to any signed-in user — needed for "View Open Tournaments"
-- (browsing tournaments you haven't joined yet) and so every participant
-- can see tournament metadata. Nothing sensitive lives on this row (name,
-- format, player count) — see the participants table below for the one
-- real privacy consideration (display names).
create policy "any authenticated user can view tournaments"
  on public.tournaments for select
  using (auth.role() = 'authenticated');

-- No direct INSERT/UPDATE/DELETE for anyone — every write goes through
-- create_tournament/join_tournament/start_tournament or the trigger-invoked
-- internal functions below (all SECURITY DEFINER, unaffected by this).
revoke insert, update, delete on public.tournaments from authenticated;

create table public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  seed int not null,
  points numeric not null default 0,
  joined_at timestamptz not null default now(),
  unique (tournament_id, child_id)
);

alter table public.tournament_participants enable row level security;

create policy "any authenticated user can view tournament participants"
  on public.tournament_participants for select
  using (auth.role() = 'authenticated');

revoke insert, update, delete on public.tournament_participants from authenticated;

create table public.tournament_pairings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number int not null,
  white_participant_id uuid not null references public.tournament_participants(id) on delete cascade,
  black_participant_id uuid references public.tournament_participants(id) on delete cascade,
  is_bye boolean not null default false,
  points_awarded boolean not null default false,
  online_game_id uuid references public.online_games(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tournament_pairings enable row level security;

create policy "any authenticated user can view tournament pairings"
  on public.tournament_pairings for select
  using (auth.role() = 'authenticated');

revoke insert, update, delete on public.tournament_pairings from authenticated;

create index tournament_participants_tournament_idx on public.tournament_participants (tournament_id);
create index tournament_pairings_tournament_round_idx on public.tournament_pairings (tournament_id, round_number);

-- ============================================================================
-- 2. online_games extension
-- ============================================================================

alter table public.online_games
  add column if not exists tournament_id uuid references public.tournaments(id) on delete set null,
  add column if not exists round_number int,
  add column if not exists tournament_pairing_id uuid references public.tournament_pairings(id) on delete set null;

alter table public.online_games drop constraint if exists online_games_match_type_check;
alter table public.online_games
  add constraint online_games_match_type_check
  check (match_type in ('invite', 'random', 'tournament'));

-- Same reasoning as 0022: these columns must never be directly client-
-- writable (a participant could otherwise relabel their own game to dodge
-- the no-chat rule below, or corrupt which tournament/round/pairing a
-- result belongs to, which handle_tournament_game_finished() trusts
-- completely). match_type is already NOT in online_games' client-grant
-- list after 0022 fixed it (only host_reaction/guest_reaction are), so
-- nothing further needed there — this just confirms the 3 new columns
-- start with no client grant at all (the default for a new column).

-- ============================================================================
-- 3. Standings (read-only, points -> Buchholz -> seed — deterministic,
-- never random; head-to-head is surfaced via pairing history in the UI
-- rather than folded into this sort, see the approved plan)
-- ============================================================================

create or replace function public.get_tournament_standings(p_tournament_id uuid)
returns table(
  participant_id uuid,
  child_id uuid,
  display_name text,
  points numeric,
  buchholz numeric,
  seed int,
  rank int
)
language sql
security definer set search_path = public
stable
as $$
  with buchholz_calc as (
    select
      tp.id as participant_id,
      coalesce(sum(opp.points), 0) as buchholz
    from tournament_participants tp
    left join tournament_pairings tpg
      on tpg.tournament_id = p_tournament_id
      and tpg.is_bye = false
      and (tpg.white_participant_id = tp.id or tpg.black_participant_id = tp.id)
    left join tournament_participants opp
      on opp.id = (case when tpg.white_participant_id = tp.id then tpg.black_participant_id else tpg.white_participant_id end)
    where tp.tournament_id = p_tournament_id
    group by tp.id
  )
  select
    tp.id,
    tp.child_id,
    c.display_name,
    tp.points,
    bc.buchholz,
    tp.seed,
    (rank() over (order by tp.points desc, bc.buchholz desc, tp.seed asc))::int
  from tournament_participants tp
  join children c on c.id = tp.child_id
  join buchholz_calc bc on bc.participant_id = tp.id
  where tp.tournament_id = p_tournament_id
  order by tp.points desc, bc.buchholz desc, tp.seed asc;
$$;

grant execute on function public.get_tournament_standings(uuid) to authenticated;

-- ============================================================================
-- 4. Pairing generation (internal — NOT granted to authenticated; only
-- called from start_tournament/the two triggers below, all already
-- SECURITY DEFINER, so this doesn't need its own auth check)
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
  v_p1 record;
  v_p2_id uuid;
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
  v_dup_count int;
begin
  select * into v_tournament from tournaments where id = p_tournament_id for update;
  if v_tournament.id is null then
    return;
  end if;

  v_round := v_tournament.current_round + 1;

  -- Idempotency: this round was already generated by a concurrent caller.
  if exists (select 1 from tournament_pairings where tournament_id = p_tournament_id and round_number = v_round) then
    return;
  end if;

  -- Safety no-op — callers (start_tournament, check_and_advance_tournament_
  -- round) are responsible for the "no more rounds -> completed" decision;
  -- this just refuses to do anything if called out of range anyway.
  if v_round > v_tournament.rounds_total then
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
  delete from pairing_pool where true; -- Supabase requires an explicit WHERE clause

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

  -- Odd count: assign a bye before pairing anyone else. Round 1 has no
  -- standings yet, so "lower-ranked" falls back to rating (purely as a
  -- tie-break input, never as round-1 pairing criterion); rounds 2+ use
  -- actual current points. Never the same player twice (checked against
  -- prior bye pairings for this tournament).
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

    insert into tournament_pairings (tournament_id, round_number, white_participant_id, black_participant_id, is_bye, points_awarded)
    values (p_tournament_id, v_round, v_bye_participant_id, null, true, true);

    update tournament_participants set points = points + 1 where id = v_bye_participant_id;

    delete from pairing_pool where participant_id = v_bye_participant_id;
  end if;

  -- Greedy pairing: walk the priority-ordered pool; for each player, pick
  -- the closest-points opponent who hasn't been played yet, falling back
  -- to a repeat only if literally everyone remaining has already been
  -- played (last resort, per spec).
  loop
    select * into v_p1 from pairing_pool order by ord asc limit 1;
    exit when v_p1.participant_id is null;
    delete from pairing_pool where participant_id = v_p1.participant_id;

    select pp.participant_id into v_p2_id
    from pairing_pool pp
    where not exists (
      select 1 from tournament_pairings tpg
      where tpg.tournament_id = p_tournament_id
        and tpg.is_bye = false
        and (
          (tpg.white_participant_id = v_p1.participant_id and tpg.black_participant_id = pp.participant_id)
          or (tpg.black_participant_id = v_p1.participant_id and tpg.white_participant_id = pp.participant_id)
        )
    )
    order by abs(pp.points - v_p1.points) asc, pp.ord asc
    limit 1;

    if v_p2_id is null then
      select pp.participant_id into v_p2_id
      from pairing_pool pp
      order by abs(pp.points - v_p1.points) asc, pp.ord asc
      limit 1;
    end if;

    exit when v_p2_id is null; -- pool was made even above; safety exit only

    delete from pairing_pool where participant_id = v_p2_id;

    -- Colour balance: whoever has played white more often (relative to
    -- black) so far gives way to the other for this round; equal -> random,
    -- the same idiom find_or_create_match already uses for colour.
    select count(*) filter (where white_participant_id = v_p1.participant_id),
           count(*) filter (where black_participant_id = v_p1.participant_id)
      into v_p1_white_ct, v_p1_black_ct
      from tournament_pairings where tournament_id = p_tournament_id and is_bye = false;
    select count(*) filter (where white_participant_id = v_p2_id),
           count(*) filter (where black_participant_id = v_p2_id)
      into v_p2_white_ct, v_p2_black_ct
      from tournament_pairings where tournament_id = p_tournament_id and is_bye = false;

    if (v_p1_white_ct - v_p1_black_ct) < (v_p2_white_ct - v_p2_black_ct) then
      v_white := v_p1.participant_id; v_black := v_p2_id;
    elsif (v_p2_white_ct - v_p2_black_ct) < (v_p1_white_ct - v_p1_black_ct) then
      v_white := v_p2_id; v_black := v_p1.participant_id;
    elsif random() < 0.5 then
      v_white := v_p1.participant_id; v_black := v_p2_id;
    else
      v_white := v_p2_id; v_black := v_p1.participant_id;
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

    insert into tournament_pairings (tournament_id, round_number, white_participant_id, black_participant_id, is_bye, online_game_id)
    values (p_tournament_id, v_round, v_white, v_black, false, v_new_game_id)
    returning id into v_new_pairing_id;

    update online_games set tournament_pairing_id = v_new_pairing_id where id = v_new_game_id;
  end loop;

  -- Defensive assertion: nobody should ever appear twice in one round. If
  -- this ever fires, it's a real bug in the algorithm above, not a
  -- condition to paper over — roll back the whole round rather than ship
  -- a corrupted pairing.
  select count(*) into v_dup_count
  from (
    select participant_id, count(*) as c
    from (
      select white_participant_id as participant_id from tournament_pairings
        where tournament_id = p_tournament_id and round_number = v_round
      union all
      select black_participant_id from tournament_pairings
        where tournament_id = p_tournament_id and round_number = v_round and black_participant_id is not null
    ) all_appearances
    group by participant_id
    having count(*) > 1
  ) dupes;

  if v_dup_count > 0 then
    raise exception 'Tournament pairing integrity check failed: a participant appears twice in round % of tournament %', v_round, p_tournament_id;
  end if;

  update tournaments set current_round = v_round where id = p_tournament_id;
end;
$$;

-- ============================================================================
-- 5. Round-completion check + advance (internal)
-- ============================================================================

create or replace function public.check_and_advance_tournament_round(p_tournament_id uuid, p_round int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_tournament record;
  v_unresolved int;
begin
  select * into v_tournament from tournaments where id = p_tournament_id for update;
  if v_tournament.id is null then
    return;
  end if;

  -- A concurrent caller already advanced past this round -- nothing to do.
  if v_tournament.current_round <> p_round then
    return;
  end if;

  select count(*) into v_unresolved
  from tournament_pairings tpg
  left join online_games og on og.id = tpg.online_game_id
  where tpg.tournament_id = p_tournament_id
    and tpg.round_number = p_round
    and tpg.is_bye = false
    and og.status is distinct from 'finished';

  if v_unresolved > 0 then
    return; -- round not fully finished yet
  end if;

  if p_round >= v_tournament.rounds_total then
    update tournaments set status = 'completed' where id = p_tournament_id;
  else
    perform generate_tournament_round(p_tournament_id);
  end if;
end;
$$;

-- ============================================================================
-- 6. online_games -> tournament trigger. Fires as part of the SAME
-- transaction that marks a tournament game finished, regardless of which
-- existing path did it (finish_online_game_by_result, claim_timeout, or
-- submit_online_move's own timeout branch) — chosen over mirroring
-- apply_match_rating's "client pokes a follow-up RPC call" pattern because
-- that pattern has a real gap for timeout-finished games (no client path
-- calls apply_match_rating() after a timeout at all, confirmed by reading
-- every call site in app/online/[gameId]/page.tsx) and tournament
-- progression stalling for 20 waiting players is far more consequential
-- than one rating update. WHEN clause below means match_type='random'/
-- 'invite' games are completely untouched by this — new trigger, not a
-- change to any existing one.
-- ============================================================================

create or replace function public.handle_tournament_game_finished()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pairing record;
  v_white_points numeric;
  v_black_points numeric;
begin
  select * into v_pairing from tournament_pairings where id = new.tournament_pairing_id for update;
  if v_pairing.id is null then
    return new;
  end if;

  if v_pairing.points_awarded then
    return new; -- idempotent no-op, mirrors online_games.rating_applied
  end if;

  if new.winner = 'draw' then
    v_white_points := 0.5; v_black_points := 0.5;
  elsif new.winner = 'w' then
    v_white_points := 1; v_black_points := 0;
  else
    v_white_points := 0; v_black_points := 1;
  end if;

  update tournament_participants set points = points + v_white_points where id = v_pairing.white_participant_id;
  update tournament_participants set points = points + v_black_points where id = v_pairing.black_participant_id;

  update tournament_pairings set points_awarded = true where id = v_pairing.id;

  perform check_and_advance_tournament_round(new.tournament_id, new.round_number);

  return new;
end;
$$;

drop trigger if exists online_games_tournament_finish on public.online_games;
create trigger online_games_tournament_finish
  after update on public.online_games
  for each row
  when (new.status = 'finished' and old.status is distinct from 'finished' and new.tournament_pairing_id is not null)
  execute procedure public.handle_tournament_game_finished();

-- ============================================================================
-- 7. tournaments waiting -> starting trigger. start_tournament() below just
-- does one fast, real, observable status update (locking joins
-- immediately); this generates Round 1 and flips to 'active', same
-- philosophy as the trigger above.
-- ============================================================================

create or replace function public.handle_tournament_starting()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform generate_tournament_round(new.id);
  update tournaments set status = 'active' where id = new.id and status = 'starting';
  return new;
end;
$$;

drop trigger if exists tournaments_starting on public.tournaments;
create trigger tournaments_starting
  after update on public.tournaments
  for each row
  when (new.status = 'starting' and old.status is distinct from 'starting')
  execute procedure public.handle_tournament_starting();

-- ============================================================================
-- 8. Public RPCs
-- ============================================================================

create or replace function public.create_tournament(
  p_creator_child_id uuid,
  p_name text,
  p_category text,
  p_time_control text,
  p_max_players int,
  p_rounds_total int
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  new_id uuid;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_creator_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  if length(trim(p_name)) = 0 then
    raise exception 'Tournament name is required';
  end if;
  if p_category not in ('Blitz', 'Rapid') then
    raise exception 'Invalid category';
  end if;

  insert into tournaments (name, creator_child_id, category, time_control, max_players, rounds_total, status, current_round)
  values (trim(p_name), p_creator_child_id, p_category, p_time_control, p_max_players, p_rounds_total, 'waiting', 0)
  returning id into new_id;

  -- Creator automatically joins their own tournament as seed 0.
  insert into tournament_participants (tournament_id, child_id, seed)
  values (new_id, p_creator_child_id, 0);

  return new_id;
end;
$$;

grant execute on function public.create_tournament(uuid, text, text, text, int, int) to authenticated;

create or replace function public.join_tournament(p_tournament_id uuid, p_child_id uuid)
returns table(joined boolean, reason text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_tournament record;
  v_count int;
  v_next_seed int;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select * into v_tournament from tournaments where id = p_tournament_id for update;
  if v_tournament.id is null then
    return query select false, 'not_found';
    return;
  end if;

  if exists (select 1 from tournament_participants where tournament_id = p_tournament_id and child_id = p_child_id) then
    return query select true, 'already_joined';
    return;
  end if;

  if v_tournament.status <> 'waiting' then
    return query select false, 'already_started';
    return;
  end if;

  select count(*) into v_count from tournament_participants where tournament_id = p_tournament_id;
  if v_count >= v_tournament.max_players then
    return query select false, 'full';
    return;
  end if;

  select coalesce(max(seed), -1) + 1 into v_next_seed from tournament_participants where tournament_id = p_tournament_id;

  insert into tournament_participants (tournament_id, child_id, seed)
  values (p_tournament_id, p_child_id, v_next_seed);

  return query select true, 'joined';
end;
$$;

grant execute on function public.join_tournament(uuid, uuid) to authenticated;

create or replace function public.start_tournament(p_tournament_id uuid, p_creator_child_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_tournament record;
  v_count int;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_creator_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select * into v_tournament from tournaments where id = p_tournament_id for update;
  if v_tournament.id is null then
    raise exception 'Tournament not found';
  end if;
  if v_tournament.creator_child_id <> p_creator_child_id then
    raise exception 'Only the creator can start this tournament';
  end if;
  if v_tournament.status <> 'waiting' then
    return; -- already starting/started -- idempotent no-op
  end if;

  select count(*) into v_count from tournament_participants where tournament_id = p_tournament_id;
  if v_count < 2 then
    raise exception 'Need at least 2 players to start';
  end if;

  update tournaments set status = 'starting' where id = p_tournament_id;
end;
$$;

grant execute on function public.start_tournament(uuid, uuid) to authenticated;
