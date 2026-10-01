-- Random Match server-side hardening.
--
-- Three independent fixes, all reversible, none of which rewrite an active
-- or finished game:
--
--   1. Realtime. The matchmaking screen subscribes to UPDATE events on
--      matchmaking_queue filtered by child_id. The primary key is id, and
--      the table was left on the default replica identity (primary key
--      only). Supabase Realtime rejects an UPDATE/DELETE filter on a column
--      that is not in the replica identity with
--      "Unable to subscribe to changes with given parameters", so the
--      subscription never comes up and the client waits for its 5s poll.
--      REPLICA IDENTITY FULL puts every column, including child_id, into
--      the change record. The client poll stays; this only makes the
--      primary path able to connect.
--
--   2. Rating window. The window already widens with the waiting row's age,
--      but it is only evaluated when someone calls find_or_create_match, and
--      the no-match branch deleted and reinserted the caller's row, which
--      reset that age. A periodic retry from the client would therefore pin
--      every waiter at the ±50 window forever. The no-match branch now keeps
--      the existing waiting row (same id, same created_at) when the speed
--      has not changed. The window is also capped at 400: the previous final
--      branch grew without a limit. Two players more than 400 apart never
--      match, however long they wait. Closest-rating ordering is unchanged.
--
--   3. Abandoned pre-start games. A random game left in status 'matched'
--      (the ready gate never completed) stayed there forever. expire
--      finishes those rows the same way abandon_matched_game does: no
--      winner, rating_applied true, so apply_match_rating cannot pay out.
--      Active games, finished games, and invite games are not candidates.
--      Games younger than 10 minutes are not candidates, which is far longer
--      than the ready gate takes. The same function runs from
--      find_or_create_match and from the daily settle-games cron.
--
-- ROLLBACK
--   alter table public.matchmaking_queue replica identity default;
--   -- re-apply the find_or_create_match body from
--   -- 0049_activate_random_match_ready_gate.sql
--   drop function if exists public.expire_abandoned_matched_games(boolean);

-- ---------------------------------------------------------------------------
-- 1. Realtime subscription parameters
-- ---------------------------------------------------------------------------

alter table public.matchmaking_queue replica identity full;

-- The table may already be in the publication (dashboard toggle). Adding it
-- twice errors, so only add it when it is missing. A project without the
-- Supabase publication (a bare replay) skips this; replica identity is what
-- the filter check requires once the table is published.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'matchmaking_queue'
     ) then
    alter publication supabase_realtime add table public.matchmaking_queue;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Expire abandoned pre-start games
-- ---------------------------------------------------------------------------
-- Granted to service_role only, same boundary as settle_timeout_as_server.
-- find_or_create_match is security definer and calls it as the owner, so
-- authenticated does not need (and must not have) EXECUTE: a browser must
-- not be able to finish other children's games directly.

create or replace function public.expire_abandoned_matched_games(p_dry_run boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_dry_run then
    select count(*)::int into v_count
    from online_games
    where match_type = 'random'
      and status = 'matched'
      and started_at is null
      and created_at < clock_timestamp() - interval '10 minutes';
    return v_count;
  end if;

  -- skip locked: a game currently inside mark_game_client_ready is left for
  -- the next pass. If that call starts it, status is no longer 'matched' and
  -- it drops out of this predicate permanently.
  with doomed as (
    select id
    from online_games
    where match_type = 'random'
      and status = 'matched'
      and started_at is null
      and created_at < clock_timestamp() - interval '10 minutes'
    for update skip locked
  ),
  updated as (
    update online_games g
    set status = 'finished',
        winner = null,
        rating_applied = true
    from doomed
    where g.id = doomed.id
      and g.match_type = 'random'
      and g.status = 'matched'
      and g.started_at is null
    returning g.id
  ),
  cleared as (
    delete from matchmaking_queue q
    using updated
    where q.matched_game_id = updated.id
    returning q.id
  )
  select count(*)::int into v_count from updated;

  return coalesce(v_count, 0);
end;
$$;

revoke execute on function public.expire_abandoned_matched_games(boolean) from public;
revoke execute on function public.expire_abandoned_matched_games(boolean) from anon;
revoke execute on function public.expire_abandoned_matched_games(boolean) from authenticated;
grant  execute on function public.expire_abandoned_matched_games(boolean) to service_role;

create index if not exists online_games_abandoned_matched_idx
  on public.online_games (created_at)
  where status = 'matched' and match_type = 'random';

-- ---------------------------------------------------------------------------
-- 3. find_or_create_match
-- ---------------------------------------------------------------------------
-- Same signature and return shape as 0049. Differences are marked inline.

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
  v_open_game uuid;
  v_eligible boolean;
  v_opponent_eligible boolean;
  v_have_opponent boolean := false;
  -- Unchanged from 0049. created_at is the waiter's age, and the window
  -- widens with it, so a short reap would delete the players the widening
  -- exists to match. Thirty minutes only removes a client that is gone.
  v_stale_secs constant int := 1800;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

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

  -- Housekeeping before matching. Both are no-ops when there is nothing stale.
  perform public.expire_abandoned_matched_games(false);

  -- Already in a random game that has not finished: return that game instead
  -- of queueing a second one. This is what makes a periodic retry safe. A
  -- retry that lands after the opponent has already paired us must not insert
  -- a new waiting row.
  select g.id into v_open_game
  from online_games g
  where g.match_type = 'random'
    and g.status in ('matched', 'active')
    and (g.host_child_id = p_child_id or g.guest_child_id = p_child_id)
  order by g.created_at desc
  limit 1;

  if v_open_game is not null then
    delete from matchmaking_queue
    where child_id = p_child_id and status = 'waiting';
    return query select true, v_open_game, false;
    return;
  end if;

  delete from matchmaking_queue
  where status = 'waiting'
    and created_at < clock_timestamp() - make_interval(secs => v_stale_secs);

  -- Lock our own waiting row before locking anyone else's. Two waiters
  -- retrying together then cannot deadlock: each holds only their own row,
  -- and the opponent select below uses skip locked rather than waiting.
  perform 1
  from matchmaking_queue
  where child_id = p_child_id
    and status = 'waiting'
    and time_control = v_tc
  for update;

  select * into opponent
  from matchmaking_queue q
  where q.status = 'waiting'
    and q.child_id <> p_child_id
    and q.time_control = v_tc
    and q.created_at >= clock_timestamp() - make_interval(secs => v_stale_secs)
    -- Capped at 400. The previous final branch grew by 50 every 30s with no
    -- ceiling, so a long enough wait would pair a beginner with anyone.
    and abs(q.rating - v_rating) <= (
      case
        when extract(epoch from (clock_timestamp() - q.created_at)) < 15 then 50
        when extract(epoch from (clock_timestamp() - q.created_at)) < 30 then 100
        when extract(epoch from (clock_timestamp() - q.created_at)) < 60 then 150
        when extract(epoch from (clock_timestamp() - q.created_at)) < 120 then 250
        else 400
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
      'matched',
      'random',
      v_tc, null
    )
    returning id into new_game_id;

    update matchmaking_queue set status = 'matched', matched_game_id = new_game_id where id = opponent.id;
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';

    perform consume_free_game_credit(opponent.child_id, 'multiplayer');
    perform consume_free_game_credit(p_child_id, 'multiplayer');

    return query select true, new_game_id, false;
  else
    -- Keep the caller's place in line. Replacing the row would reset
    -- created_at and freeze the rating window at its first step.
    update matchmaking_queue
    set rating = v_rating
    where child_id = p_child_id
      and status = 'waiting'
      and time_control = v_tc;

    if not found then
      delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';
      insert into matchmaking_queue (child_id, rating, status, time_control)
      values (p_child_id, v_rating, 'waiting', v_tc);
    end if;

    return query select false, null::uuid, false;
  end if;
end;
$$;

grant execute on function public.find_or_create_match(uuid, int, text) to authenticated;
