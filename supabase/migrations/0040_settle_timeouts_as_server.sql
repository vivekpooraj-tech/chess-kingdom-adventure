-- Let the server settle a flagged clock without a browser.
--
-- THE ROOT CAUSE
--
-- claim_timeout is already fully authoritative: it takes the row `for update`,
-- recomputes elapsed time from clock_timestamp() and last_move_at, decrements
-- only the clock of the side whose turn it is, and returns the unchanged state
-- if the game is not active. A client cannot influence its outcome.
--
-- But it is gated on auth.uid() ownership, so ONLY a signed-in participant can
-- trigger it. That is the entire bug: settlement requires a browser to be
-- open. If both players close the app on a timed game, nothing ever calls it,
-- the game stays `active` forever, and a rated game never settles its rating.
--
-- THE FIX
--
-- The same arithmetic, reachable by the server. No ownership check, because
-- there is no participant to identify — a cron has no auth.uid(). Following
-- 0039, the authorization boundary is the GRANT: this is revoked from public,
-- anon and authenticated, and granted only to service_role. It is NOT gated on
-- `auth.uid() is null`, which would also admit anonymous callers.
--
-- Deliberately a copy of claim_timeout's clock logic rather than a wrapper
-- around it: wrapping would require claim_timeout to relax its own ownership
-- check, which is the one thing that must not happen. The duplication is 15
-- lines of arithmetic that scripts/test-settlement-fixtures.js exercises
-- against real rows.
--
-- WHAT IT DOES NOT DO
--
--   * untimed games (time_control is null) — no clock, so no forfeit can be
--     proven. Returns unchanged. An abandoned untimed game stays active.
--   * waiting games — an unjoined invite has no result to settle.
--   * finished games — returns unchanged, which is what makes repeated cron
--     runs safe.
--   * rating — left to apply_match_rating, which is already idempotent via
--     the rating_applied flag under its own row lock.
--
-- A game stays unresolved rather than having a winner invented for it.
--
-- Safe to run more than once. Additive: creates one new function and touches
-- no existing object.
--
-- ROLLBACK:
--   drop function if exists public.settle_timeout_as_server(uuid);
--   -- and remove the cron entry from vercel.json. Nothing else depends on it;
--   -- browser-driven claim_timeout is unaffected either way.

create or replace function public.settle_timeout_as_server(p_game_id uuid)
returns table(settled boolean, status text, winner text, white_time_ms bigint, black_time_ms bigint)
language plpgsql
security definer set search_path = public
as $$
declare
  g record;
  v_now timestamptz := clock_timestamp();
  v_elapsed_ms bigint;
  v_white_ms bigint;
  v_black_ms bigint;
begin
  -- The lock is the race-safety mechanism. submit_online_move_as_server takes
  -- the same lock on the same row, so a move arriving as the cron fires is
  -- serialised against it: whichever transaction gets the row first wins, and
  -- the second sees the result of the first. If the move lands first it has
  -- refreshed last_move_at and the clock below no longer reads as expired; if
  -- this lands first the game is finished and the move is rejected with
  -- 'Game is not active'. There is exactly one outcome either way.
  select * into g from online_games where id = p_game_id for update;

  if g.id is null then
    raise exception 'Game not found';
  end if;

  -- Everything that is not a live, timed, clocked game returns unchanged.
  -- This is what makes the sweeper idempotent: a second run sees `finished`
  -- and reports settled = false without writing.
  --
  -- The clock columns are checked for NULL explicitly, and this is NOT
  -- belt-and-braces. Without it a null clock FAILS OPEN and hands someone a
  -- win they did not earn:
  --
  --   v_white_ms := null - v_elapsed_ms          -> null
  --   if v_white_ms > 0 and v_black_ms > 0       -> null, so NOT true:
  --                                                 falls through to the UPDATE
  --   case when v_white_ms <= 0 then 'b' else 'w'-> null <= 0 is null, so 'w'
  --
  -- i.e. a row with a null white_time_ms would be silently finished with white
  -- declared the winner, on no evidence whatsoever. Three-valued logic makes
  -- "not greater than zero" and "less than or equal to zero" both false for a
  -- null, so neither branch guards the other. Never let a null reach the
  -- arithmetic.
  if g.status <> 'active'
     or g.time_control is null
     or g.current_turn is null
     or g.last_move_at is null
     or g.white_time_ms is null
     or g.black_time_ms is null then
    return query select false, g.status, g.winner, g.white_time_ms, g.black_time_ms;
    return;
  end if;

  -- A last_move_at in the future would make elapsed negative. greatest(0, ...)
  -- clamps it, so the clock reads as untouched rather than as expired — the
  -- safe direction, stated rather than left to chance.

  v_elapsed_ms := greatest(0, (extract(epoch from (v_now - g.last_move_at)) * 1000))::bigint;
  v_white_ms := g.white_time_ms;
  v_black_ms := g.black_time_ms;

  -- Only the running clock is charged, exactly as claim_timeout does it.
  if g.current_turn = 'w' then
    v_white_ms := g.white_time_ms - v_elapsed_ms;
  else
    v_black_ms := g.black_time_ms - v_elapsed_ms;
  end if;

  -- Not expired: report the live values and change nothing.
  if v_white_ms > 0 and v_black_ms > 0 then
    return query select false, g.status, g.winner, v_white_ms, v_black_ms;
    return;
  end if;

  update online_games
  set status = 'finished',
      winner = case when v_white_ms <= 0 then 'b' else 'w' end,
      white_time_ms = greatest(0, v_white_ms),
      black_time_ms = greatest(0, v_black_ms)
  where id = p_game_id
  returning online_games.status, online_games.winner,
            online_games.white_time_ms, online_games.black_time_ms
  into g;

  return query select true, g.status, g.winner, g.white_time_ms, g.black_time_ms;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — the authorization boundary, per 0039
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC on creation, which is how anon reaches a
-- function at all. Revoke first, then grant narrowly.

revoke execute on function public.settle_timeout_as_server(uuid) from public;
revoke execute on function public.settle_timeout_as_server(uuid) from anon;
revoke execute on function public.settle_timeout_as_server(uuid) from authenticated;
grant  execute on function public.settle_timeout_as_server(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------
-- The sweeper's candidate query is
--   where status = 'active' and time_control is not null
-- A partial index keeps that from scanning finished and waiting rows as the
-- table grows. Partial so it stays small: only live timed games are in it, and
-- rows leave the index the moment they finish.

create index if not exists online_games_active_timed_idx
  on public.online_games (last_move_at)
  where status = 'active' and time_control is not null;

-- ---------------------------------------------------------------------------
-- VERIFICATION (read-only — run after applying)
-- ---------------------------------------------------------------------------
-- (a) service_role only. Expect exactly one row: service_role.
--
-- select r.rolname as grantee
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
-- join pg_roles r on r.oid = a.grantee
-- where n.nspname = 'public' and p.proname = 'settle_timeout_as_server'
--   and a.privilege_type = 'EXECUTE';
--
-- (b) PUBLIC must not hold EXECUTE. Expect 0 rows.
--
-- select 1
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
-- where n.nspname = 'public' and p.proname = 'settle_timeout_as_server'
--   and a.privilege_type = 'EXECUTE' and a.grantee = 0;
--
-- (c) Nothing was settled by applying the migration itself.
--     Expect the same counts as before you ran it.
--
-- select status, count(*) from public.online_games group by status order by status;
