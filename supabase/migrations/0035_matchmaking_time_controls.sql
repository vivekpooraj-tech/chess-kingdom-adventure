-- Let players choose the speed of a random match.
--
-- find_or_create_match (current definition in 0026) hardcodes '10+0' on every
-- game it creates, so every random game in Chess Mind is a 10-minute Rapid
-- game. There is no way to play Blitz against a stranger, and the queue has no
-- notion of speed at all — a player who wanted 3+0 would be matched against
-- someone who wanted 15+10, which on any other chess site would be two
-- different pools.
--
-- This migration is ADDITIVE and BACKWARD COMPATIBLE:
--
--   * matchmaking_queue gains a nullable time_control, defaulted to '10+0', so
--     rows written by an older client keep the exact behaviour they have today.
--   * find_or_create_match gains a third parameter with a DEFAULT, so the
--     existing two-argument call from lib/supabase/queries.ts continues to work
--     unchanged and continues to produce 10+0 games. Nothing breaks if the app
--     is deployed before, or without, this migration.
--
-- Bullet (1+0, 2+1) is deliberately NOT added. The clock system has not been
-- measured for drift at that speed, and a 60-second game is where an unreliable
-- clock stops being a nuisance and starts deciding games.
--
-- Safe to run more than once.

-- 1. Queue gains a speed --------------------------------------------------

alter table public.matchmaking_queue
  add column if not exists time_control text not null default '10+0';

-- Constrain to the controls the app offers AND that the clock-defaults trigger
-- (0017, extended by 0021) knows how to initialise. A value outside this set
-- would create a game whose clocks never start.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matchmaking_queue_time_control_check'
  ) then
    alter table public.matchmaking_queue
      add constraint matchmaking_queue_time_control_check
      check (time_control in ('3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'));
  end if;
end $$;

-- Players waiting for different speeds are different pools, so the queue is
-- scanned per speed. Replaces the rating-only partial index from 0026.
create index if not exists matchmaking_queue_waiting_tc_rating_idx
  on public.matchmaking_queue (time_control, rating)
  where status = 'waiting';

-- 2. Matching within a speed ----------------------------------------------

create or replace function public.find_or_create_match(
  p_child_id uuid,
  p_rating int,
  p_time_control text default '10+0'
)
returns table(matched boolean, game_id uuid, blocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_rating int;
  v_tc text;
  opponent record;
  new_game_id uuid;
  v_eligible boolean;
  v_opponent_eligible boolean;
  v_have_opponent boolean := false;
begin
  -- Ownership check, unchanged from 0026: a caller may only act as a child
  -- they own, or they could create games and burn free-game credits as
  -- someone else.
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  -- Never trust a client-supplied time control: an unknown value would pass
  -- through to online_games and produce a game the clock trigger cannot
  -- initialise. Anything unrecognised falls back to the previous behaviour.
  v_tc := coalesce(p_time_control, '10+0');
  if v_tc not in ('3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10') then
    v_tc := '10+0';
  end if;

  select rating into v_rating from children where id = p_child_id;
  if v_rating is null then
    raise exception 'Child not found';
  end if;

  select check_free_game_eligibility(p_child_id, 'multiplayer') into v_eligible;
  if not v_eligible then
    return query select false, null::uuid, true;
    return;
  end if;

  select * into opponent
  from matchmaking_queue q
  where q.status = 'waiting'
    and q.child_id <> p_child_id
    -- The one behavioural change: only ever match inside the same speed.
    and q.time_control = v_tc
    and q.rating between v_rating - (
      case
        when extract(epoch from (clock_timestamp() - q.created_at)) < 15 then 50
        when extract(epoch from (clock_timestamp() - q.created_at)) < 30 then 100
        when extract(epoch from (clock_timestamp() - q.created_at)) < 60 then 150
        when extract(epoch from (clock_timestamp() - q.created_at)) < 120 then 250
        else 400 + floor((extract(epoch from (clock_timestamp() - q.created_at)) - 120) / 30) * 50
      end
    ) and v_rating + (
      case
        when extract(epoch from (clock_timestamp() - q.created_at)) < 15 then 50
        when extract(epoch from (clock_timestamp() - q.created_at)) < 30 then 100
        when extract(epoch from (clock_timestamp() - q.created_at)) < 60 then 150
        when extract(epoch from (clock_timestamp() - q.created_at)) < 120 then 250
        else 400 + floor((extract(epoch from (clock_timestamp() - q.created_at)) - 120) / 30) * 50
      end
    )
  order by abs(q.rating - v_rating) asc, q.created_at asc, q.id asc
  limit 1
  for update skip locked;

  if opponent.id is not null then
    select check_free_game_eligibility(opponent.child_id, 'multiplayer') into v_opponent_eligible;
    if v_opponent_eligible then
      v_have_opponent := true;
    else
      delete from matchmaking_queue where id = opponent.id;
    end if;
  end if;

  if v_have_opponent then
    insert into online_games (
      host_child_id, guest_child_id, host_color, status, match_type,
      time_control, last_move_at
    )
    values (
      opponent.child_id,
      p_child_id,
      case when random() < 0.5 then 'w' else 'b' end,
      'active',
      'random',
      -- The agreed speed, rather than a hardcoded 10+0. The clock-defaults
      -- trigger reads this and fills initial/increment/white/black times.
      v_tc, clock_timestamp()
    )
    returning id into new_game_id;

    update matchmaking_queue set status = 'matched', matched_game_id = new_game_id where id = opponent.id;
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';

    perform consume_free_game_credit(opponent.child_id, 'multiplayer');
    perform consume_free_game_credit(p_child_id, 'multiplayer');

    return query select true, new_game_id, false;
  else
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';
    insert into matchmaking_queue (child_id, rating, status, time_control)
    values (p_child_id, v_rating, 'waiting', v_tc);
    return query select false, null::uuid, false;
  end if;
end;
$$;

-- The three-argument form is what the app calls from here on. The old
-- two-argument signature is left in place deliberately: a client deployed
-- before this migration keeps working, and its games keep being 10+0.
grant execute on function public.find_or_create_match(uuid, int, text) to authenticated;
