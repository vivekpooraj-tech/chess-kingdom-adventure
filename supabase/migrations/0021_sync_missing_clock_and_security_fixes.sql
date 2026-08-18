-- Audit finding while building Group Tournament (Phase 23): the live
-- database does NOT match this migrations folder. Querying the live schema
-- directly (pg_proc, information_schema) rather than assuming the files
-- were all applied turned up three real gaps:
--
--   1. 0017_online_game_clocks.sql was never applied at all — no clock
--      columns on online_games, no online_games_set_clock_defaults
--      trigger, and none of submit_online_move/claim_timeout/
--      finish_online_game_by_result exist. Meanwhile 0019 and 0020 (which
--      WERE applied — confirmed by pulling their function bodies directly)
--      both replaced join_online_game/find_or_create_match with versions
--      that reference those same clock columns. Result: Random Match and
--      Invite a Friend are currently broken in production — either RPC
--      throws a real Postgres error the moment it tries to write
--      time_control/current_turn/last_move_at, columns that don't exist.
--   2. 0018_secure_premium_status.sql's `revoke update (premium_status)`
--      was never applied — right now, any signed-in parent can call
--      `.from('parents').update({premium_status:'premium'})` directly from
--      the browser and grant themselves premium for free, bypassing Stripe
--      entirely. A live, exploitable gap, not a theoretical one.
--   3. 0020's `revoke update (rating)` on children was never applied —
--      any signed-in parent can currently set their own child's rating to
--      anything directly, bypassing the Elo calculation in
--      apply_match_rating (which IS correctly live and unaffected by this
--      migration).
--
-- This migration applies exactly those three gaps and nothing else —
-- every other object 0017/0018/0019/0020 touch was independently confirmed
-- already correct and live (table columns, function bodies, other grants).
-- join_online_game is deliberately NOT re-created here: 0019's newer
-- version (with the free-game-limit check) is already live and correct;
-- re-applying 0017's older version would be a regression, not a fix.

-- --------------------------------------------------------------------------
-- 1a. Clock columns (0017)
-- --------------------------------------------------------------------------
alter table public.online_games
  add column if not exists time_control text,
  add column if not exists initial_time_ms bigint,
  add column if not exists increment_ms bigint not null default 0,
  add column if not exists white_time_ms bigint,
  add column if not exists black_time_ms bigint,
  add column if not exists last_move_at timestamptz,
  add column if not exists current_turn text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'online_games_time_control_check'
  ) then
    alter table public.online_games
      add constraint online_games_time_control_check
      check (time_control is null or time_control in ('3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'online_games_current_turn_check'
  ) then
    alter table public.online_games
      add constraint online_games_current_turn_check
      check (current_turn is null or current_turn in ('w', 'b'));
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1b. Clock-defaults trigger (0017) — extended with the 4 new time-control
-- presets content/timeControls.ts adds for Group Tournament, so it's a
-- single source of truth for every valid id going forward instead of two
-- migrations each defining a partial CASE list.
-- --------------------------------------------------------------------------
create or replace function public.set_online_game_clock_defaults()
returns trigger
language plpgsql
as $$
declare
  v_initial_ms bigint;
  v_increment_ms bigint;
begin
  if new.time_control is null then
    new.initial_time_ms := null;
    new.increment_ms := 0;
    new.white_time_ms := null;
    new.black_time_ms := null;
    new.current_turn := null;
    return new;
  end if;

  case new.time_control
    when '3+0' then v_initial_ms := 180000; v_increment_ms := 0;
    when '3+2' then v_initial_ms := 180000; v_increment_ms := 2000;
    when '5+0' then v_initial_ms := 300000; v_increment_ms := 0;
    when '5+3' then v_initial_ms := 300000; v_increment_ms := 3000;
    when '10+0' then v_initial_ms := 600000; v_increment_ms := 0;
    when '10+5' then v_initial_ms := 600000; v_increment_ms := 5000;
    when '15+10' then v_initial_ms := 900000; v_increment_ms := 10000;
  end case;

  new.initial_time_ms := v_initial_ms;
  new.increment_ms := v_increment_ms;
  new.white_time_ms := v_initial_ms;
  new.black_time_ms := v_initial_ms;
  new.current_turn := 'w';
  return new;
end;
$$;

drop trigger if exists online_games_set_clock_defaults on public.online_games;
create trigger online_games_set_clock_defaults
  before insert on public.online_games
  for each row execute procedure public.set_online_game_clock_defaults();

-- --------------------------------------------------------------------------
-- 1c. submit_online_move / claim_timeout / finish_online_game_by_result
-- (0017) — verbatim from the migration file, these were simply never run.
-- --------------------------------------------------------------------------
create or replace function public.submit_online_move(
  p_game_id uuid,
  p_child_id uuid,
  p_fen text,
  p_san text
)
returns table(white_time_ms bigint, black_time_ms bigint, status text, winner text)
language plpgsql
security definer set search_path = public
as $$
declare
  g record;
  v_owns boolean;
  v_is_host boolean;
  v_mover_color text;
  v_new_turn text;
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

  v_is_host := (g.host_child_id = p_child_id);
  if not v_is_host and g.guest_child_id is distinct from p_child_id then
    raise exception 'Not a participant in this game';
  end if;

  if g.status <> 'active' then
    raise exception 'Game is not active';
  end if;

  if g.time_control is null then
    update online_games
    set fen = p_fen, moves = array_append(moves, p_san)
    where id = p_game_id;
    return query select null::bigint, null::bigint, g.status, g.winner;
    return;
  end if;

  v_mover_color := case
    when v_is_host then g.host_color
    else (case when g.host_color = 'w' then 'b' else 'w' end)
  end;

  if g.current_turn is distinct from v_mover_color then
    raise exception 'Not your turn';
  end if;

  v_elapsed_ms := greatest(0, (extract(epoch from (v_now - g.last_move_at)) * 1000))::bigint;
  v_white_ms := g.white_time_ms;
  v_black_ms := g.black_time_ms;

  if v_mover_color = 'w' then
    v_white_ms := g.white_time_ms - v_elapsed_ms;
  else
    v_black_ms := g.black_time_ms - v_elapsed_ms;
  end if;

  if (v_mover_color = 'w' and v_white_ms <= 0) or (v_mover_color = 'b' and v_black_ms <= 0) then
    update online_games
    set status = 'finished',
        winner = case when v_mover_color = 'w' then 'b' else 'w' end,
        white_time_ms = greatest(0, v_white_ms),
        black_time_ms = greatest(0, v_black_ms)
    where id = p_game_id;
    return query select greatest(0, v_white_ms), greatest(0, v_black_ms),
      'finished'::text, (case when v_mover_color = 'w' then 'b' else 'w' end)::text;
    return;
  end if;

  if v_mover_color = 'w' then
    v_white_ms := v_white_ms + g.increment_ms;
  else
    v_black_ms := v_black_ms + g.increment_ms;
  end if;

  v_new_turn := case when v_mover_color = 'w' then 'b' else 'w' end;

  update online_games
  set fen = p_fen,
      moves = array_append(moves, p_san),
      current_turn = v_new_turn,
      white_time_ms = v_white_ms,
      black_time_ms = v_black_ms,
      last_move_at = v_now
  where id = p_game_id;

  return query select v_white_ms, v_black_ms, 'active'::text, null::text;
end;
$$;

grant execute on function public.submit_online_move(uuid, uuid, text, text) to authenticated;

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
    returning status, winner, white_time_ms, black_time_ms into g;
  end if;

  return query select g.status, g.winner, g.white_time_ms, g.black_time_ms;
end;
$$;

grant execute on function public.claim_timeout(uuid, uuid) to authenticated;

create or replace function public.finish_online_game_by_result(
  p_game_id uuid,
  p_child_id uuid,
  p_winner text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  g record;
begin
  select * into g from online_games where id = p_game_id;
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

  update online_games set status = 'finished', winner = p_winner where id = p_game_id;
end;
$$;

grant execute on function public.finish_online_game_by_result(uuid, uuid, text) to authenticated;

-- --------------------------------------------------------------------------
-- 1d. Column-level lockdown on online_games (0017's REVOKE, never applied —
-- until now, any client could directly UPDATE its own game's status/
-- winner/fen/etc, bypassing every RPC above entirely).
-- --------------------------------------------------------------------------
revoke update (
  fen, moves, current_turn, status, winner,
  white_time_ms, black_time_ms, last_move_at, guest_child_id
) on public.online_games from authenticated;

-- --------------------------------------------------------------------------
-- 2. parents.premium_status lockdown (0018, never applied) — currently
-- exploitable: any signed-in parent can self-grant premium.
-- --------------------------------------------------------------------------
revoke update (premium_status) on public.parents from authenticated;

-- --------------------------------------------------------------------------
-- 3. children.rating lockdown (0020, never applied) — currently
-- exploitable: any signed-in parent can set their own child's rating to
-- anything directly.
-- --------------------------------------------------------------------------
revoke update (rating) on public.children from authenticated;
