-- Random Match clock-start fix, Phase C: activate the ready-gate.
--
-- Phase A (0048_random_match_ready_gate.sql) added the 'matched' status, the
-- host_ready_at/guest_ready_at/started_at columns, and the
-- mark_game_client_ready/abandon_matched_game RPCs, but deliberately left
-- find_or_create_match untouched so nothing in production could produce a
-- 'matched' row yet. Phase B deployed the frontend that knows how to render
-- that state and call mark_game_client_ready. Both have been confirmed live
-- and stable, with zero 'matched' games ever created and find_or_create_match
-- verified unchanged at every step since.
--
-- This migration is the one behavioural change Phase C exists for. It is a
-- CREATE OR REPLACE of find_or_create_match with an otherwise byte-identical
-- body (ownership check, time-control validation, free-game eligibility,
-- stale-queue reaping, opponent selection, the rating-window widening ladder,
-- matchmaking_queue bookkeeping, free-game credit consumption, and the
-- returned matched/game_id/blocked tuple are all unchanged) -- the only
-- difference is the two literals in the online_games INSERT:
--
--   status:        'active'          -> 'matched'
--   last_move_at:  clock_timestamp() -> null
--
-- The clock no longer starts at match time. It starts only when
-- mark_game_client_ready() (0048) observes both host_ready_at and
-- guest_ready_at set, at which point it sets status='active',
-- started_at=now(), and last_move_at=now() (the same instant) atomically
-- under a row lock -- see that function's own comment for the full
-- transition.
--
-- Not touched by this migration: opponent matching, rating windows,
-- free-game logic, matchmaking_queue handling, stale-queue reaping, invite
-- games (create_invite_game/join_online_game), or any RPC other than
-- find_or_create_match itself.
--
-- ROLLBACK: re-run this CREATE OR REPLACE with 'active' and
-- clock_timestamp() restored in place of 'matched' and null (i.e. the
-- function body as it existed immediately before this migration -- verified
-- and recorded during this change's review). A game already sitting in
-- 'matched' at rollback time is not retroactively started; it is picked up
-- by the existing abandon/stale-game handling from 0048.

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
  -- Deliberately long. A waiting client holds its place through a Realtime
  -- subscription, not by polling, so created_at is never refreshed — and the
  -- rating window WIDENS with that age (the final branch below exists to serve
  -- waits past 120s). Reaping on a short timer would therefore delete exactly
  -- the patient players the expansion is designed to match. Thirty minutes is
  -- past any plausible real wait, so it only removes rows whose client is
  -- genuinely gone.
  v_stale_secs constant int := 1800;
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

  -- Reap abandoned rows before matching. A waiting row is only meaningful
  -- while that client is still polling; once it stops, the row is a trap for
  -- the next player to search.
  delete from matchmaking_queue
  where status = 'waiting'
    and created_at < clock_timestamp() - make_interval(secs => v_stale_secs);

  select * into opponent
  from matchmaking_queue q
  where q.status = 'waiting'
    and q.child_id <> p_child_id
    -- The one behavioural change: only ever match inside the same speed.
    and q.time_control = v_tc
    -- Belt and braces: even if the reap above missed a row (a concurrent
    -- insert, say), never match against one that has gone quiet.
    and q.created_at >= clock_timestamp() - make_interval(secs => v_stale_secs)
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
      -- Was 'active' -- the game is now created pre-start. The clock does
      -- not begin until mark_game_client_ready() (0048) sees both players'
      -- clients ready and flips this to 'active' itself.
      'matched',
      'random',
      -- The agreed speed, rather than a hardcoded 10+0. The clock-defaults
      -- trigger reads this and fills initial/increment/white/black times.
      -- last_move_at is intentionally NULL here (was clock_timestamp()) --
      -- see mark_game_client_ready for where it's actually set, atomically
      -- with started_at, once both clients have loaded the game.
      v_tc, null
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

grant execute on function public.find_or_create_match(uuid, int, text) to authenticated;
