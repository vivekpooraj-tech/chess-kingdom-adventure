-- Random Match clock-start fix, Phase A (infrastructure only).
--
-- THE BUG
--
-- find_or_create_match creates a random-match online_games row already
-- status='active' with last_move_at=clock_timestamp() at INSERT time -- the
-- clock's zero-point is set the instant the server matches two players, not
-- when either of their clients has actually loaded /online/[gameId]. A
-- client that loads late (or never, if it's still stuck elsewhere) sees a
-- clock that has already been silently running. Confirmed against real
-- production games: a 3+0 match whose queue row was created at 17:06:44 UTC
-- and whose online_games row was created 7 seconds later already showed a
-- guest-side clock reading ~24s elapsed on that guest's very first render,
-- purely from render-time network/boot latency after row creation -- proven
-- by useRemainingMs's own math (displayMs = baseMs - (Date.now() -
-- last_move_at)), not by anything client-side going wrong.
--
-- THE FIX (this migration)
--
-- Add a distinct 'matched' status, sitting between 'waiting' (invite, not
-- yet joined) and 'active' (clock genuinely running), plus a per-participant
-- readiness signal. The clock's zero-point (started_at / last_move_at) is
-- set only once BOTH participants have loaded their game screen and called
-- mark_game_client_ready -- never at row creation.
--
-- PHASED ROLLOUT -- READ BEFORE CHANGING find_or_create_match
--
-- This migration is Phase A: it adds the new columns, the new
-- mark_game_client_ready / abandon_matched_game RPCs, and locks the new
-- columns down the same way last_move_at etc. already are. It deliberately
-- does NOT touch find_or_create_match -- that function still creates random
-- games directly as 'active', exactly as it does today. Every online_games
-- row created before AND immediately after this migration behaves
-- identically to today; started_at/host_ready_at/guest_ready_at stay null on
-- all of them and mark_game_client_ready is a safe, inert no-op against them
-- (see its own comment: anything not match_type='random' AND status=
-- 'matched' is returned unchanged).
--
-- Phase B is deploying the frontend that calls mark_game_client_ready and
-- renders the new 'matched' waiting state -- safe to ship any time after
-- this migration, since nothing in the live data will ever be 'matched'
-- until Phase C happens, so the new frontend code path stays dormant.
--
-- Phase C -- flipping find_or_create_match to insert status='matched'
-- instead of 'active', and to stop setting last_move_at -- is a SEPARATE,
-- LATER migration, applied only once Phase B's frontend has had time to
-- reach every client. Applying Phase C before that would strand any player
-- still running the old frontend (which has never heard of 'matched' and has
-- no code path to call mark_game_client_ready) in a game that can never
-- start. This migration does not do that. Phase C is intentionally left for
-- a follow-up change once Phase A+B are confirmed live.
--
-- INVITE GAMES ARE UNTOUCHED
--
-- create_invite_game / join_online_game are not modified. An invite game's
-- clock already starts at a real player action (the guest tapping "Accept
-- Game", which calls join_online_game) -- that model is already correct and
-- is out of scope here. mark_game_client_ready explicitly no-ops on any
-- non-random game, so it can never interfere with the invite flow even if
-- called on one by mistake.
--
-- Safe to run more than once: all DDL is additive/IF NOT EXISTS, and both
-- new functions are CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1. Schema -- additive, all nullable, no backfill
-- ---------------------------------------------------------------------------

alter table public.online_games
  add column if not exists started_at timestamptz,
  add column if not exists host_ready_at timestamptz,
  add column if not exists guest_ready_at timestamptz;

-- Verified directly against production before writing this (not assumed from
-- migration files -- this table predates this repo's migration history):
--   online_games_status_check: CHECK (status = ANY (ARRAY['waiting',
--   'active', 'finished'])). Widen it to also allow 'matched'. Existing rows
--   are all 'waiting'/'active'/'finished' already, so this ADD is a pure
--   widening -- nothing currently in the table can violate it, and dropping
--   back to the 3-value set later only fails if a 'matched' row still exists
--   at that time (see this file's own rollback note at the bottom).
alter table public.online_games drop constraint if exists online_games_status_check;
alter table public.online_games add constraint online_games_status_check
  check (status = any (array['waiting', 'active', 'finished', 'matched']));

-- ---------------------------------------------------------------------------
-- 2. mark_game_client_ready -- the readiness RPC
-- ---------------------------------------------------------------------------
-- Same ownership-check and FOR UPDATE row-lock pattern as every other
-- participant-facing RPC on this table (submit_online_move, claim_timeout,
-- join_online_game). Never accepts a client timestamp; every timestamp
-- written here is clock_timestamp(), read once into v_now so started_at and
-- last_move_at are provably the exact same instant, not two separate calls
-- that could theoretically differ by a tick.
--
-- Idempotency: a repeated call from the same player is harmless --
-- host_ready_at/guest_ready_at are only ever set via
-- coalesce(existing, v_now), so a second call keeps the FIRST timestamp and
-- writes nothing new. A call once the game is already 'active' (or is not a
-- 'random' game at all) is a pure read-and-return, no write attempted.
--
-- Atomicity: the initial `for update` holds the row lock for the entire
-- function body, so two participants' calls landing at the same instant are
-- serialised by Postgres itself -- there is no window where both could
-- observe "not ready yet" and neither performs the active-transition.
create or replace function public.mark_game_client_ready(
  p_game_id uuid,
  p_child_id uuid
)
returns table(
  status text,
  started_at timestamptz,
  last_move_at timestamptz,
  white_time_ms bigint,
  black_time_ms bigint,
  current_turn text
)
language plpgsql
security definer set search_path = public
as $$
declare
  g record;
  v_owns boolean;
  v_is_host boolean;
  v_now timestamptz := clock_timestamp();
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select * into g from online_games where id = p_game_id for update;
  if g.id is null then
    raise exception 'Game not found';
  end if;

  v_is_host := (g.host_child_id = p_child_id);
  if not v_is_host and g.guest_child_id is distinct from p_child_id then
    raise exception 'Not a participant in this game';
  end if;

  -- Only a random match sitting in the pre-start 'matched' state has
  -- anything to do here. Everything else -- already active, finished, or an
  -- invite game (which never uses this flow at all) -- is a safe no-op that
  -- just reports current state. This is what makes remount/reconnect and an
  -- accidental call on the wrong game type both harmless.
  if g.match_type <> 'random' or g.status <> 'matched' then
    return query select g.status, g.started_at, g.last_move_at,
      g.white_time_ms, g.black_time_ms, g.current_turn;
    return;
  end if;

  if v_is_host then
    update online_games set host_ready_at = coalesce(host_ready_at, v_now) where id = p_game_id;
  else
    update online_games set guest_ready_at = coalesce(guest_ready_at, v_now) where id = p_game_id;
  end if;

  select * into g from online_games where id = p_game_id;

  -- The second participant's call is the one that observes both timestamps
  -- set and performs the transition. started_at and last_move_at are set
  -- from the SAME v_now read at the top of this call, not two separate
  -- clock_timestamp() calls.
  if g.host_ready_at is not null and g.guest_ready_at is not null and g.status = 'matched' then
    update online_games
    set status = 'active',
        started_at = v_now,
        last_move_at = v_now
    where id = p_game_id
    returning * into g;
  end if;

  return query select g.status, g.started_at, g.last_move_at,
    g.white_time_ms, g.black_time_ms, g.current_turn;
end;
$$;

revoke all on function public.mark_game_client_ready(uuid, uuid) from public;
grant execute on function public.mark_game_client_ready(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. abandon_matched_game -- the stale-'matched'-game escape hatch
-- ---------------------------------------------------------------------------
-- Lets either participant exit a random match that never actually started
-- (their opponent's client never loaded / never signalled ready). Mirrors
-- cancelMatchmaking's role for the pre-match queue, one stage later.
--
-- Deliberately narrow: only ever touches a row that is match_type='random'
-- AND status='matched' -- an active game, a finished game, or an invite game
-- are completely untouched no matter what this is called with. No winner is
-- recorded (this undoes a match that never started; it is not a result), and
-- rating_applied is set true in the same statement so apply_match_rating
-- (called from both the cron sweep and a client-side effect whenever a
-- random game reaches 'finished') can never later run its rating arithmetic
-- against a null winner -- verified: apply_match_rating's winner-branch
-- treats a null winner as "guest won" (neither `winner = 'draw'` nor
-- `winner = host_color` is true for a null, so it falls through to the guest
-- branch), which would silently mis-rate both players. Setting
-- rating_applied here closes that off at the source rather than relying on
-- every future caller to remember never to invoke it on this row.
create or replace function public.abandon_matched_game(
  p_game_id uuid,
  p_child_id uuid
)
returns table(status text)
language plpgsql
security definer set search_path = public
as $$
declare
  g record;
  v_owns boolean;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select * into g from online_games where id = p_game_id for update;
  if g.id is null then
    raise exception 'Game not found';
  end if;

  if g.host_child_id <> p_child_id and g.guest_child_id is distinct from p_child_id then
    raise exception 'Not a participant in this game';
  end if;

  if g.match_type = 'random' and g.status = 'matched' then
    update online_games
    set status = 'finished', winner = null, rating_applied = true
    where id = p_game_id;
  end if;

  select status into g from online_games where id = p_game_id;
  return query select g.status;
end;
$$;

revoke all on function public.abandon_matched_game(uuid, uuid) from public;
grant execute on function public.abandon_matched_game(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Column-level lockdown -- same REVOKE pattern as 0017/0021
-- ---------------------------------------------------------------------------
-- Verified directly against production before writing this migration: the
-- `authenticated` role currently has table-level UPDATE on online_games with
-- only host_reaction/guest_reaction left grantable at the column level (every
-- clock/state column -- fen, moves, status, current_turn, white_time_ms,
-- black_time_ms, last_move_at, winner, guest_child_id -- is already revoked
-- for authenticated, per 0017/0021). A newly-added column is NOT covered by
-- an old REVOKE list that predates its existence, so without this explicit
-- REVOKE, started_at/host_ready_at/guest_ready_at would be directly
-- client-writable the instant they're created -- exactly the bypass this
-- whole RPC-only-write model exists to prevent.
revoke update (started_at, host_ready_at, guest_ready_at)
  on public.online_games from authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Safe at any point during Phase A (find_or_create_match is untouched, so no
-- row can ever be 'matched' unless a caller manually inserted one for
-- testing):
--
--   drop function if exists public.abandon_matched_game(uuid, uuid);
--   drop function if exists public.mark_game_client_ready(uuid, uuid);
--   alter table public.online_games drop constraint online_games_status_check;
--   alter table public.online_games add constraint online_games_status_check
--     check (status = any (array['waiting', 'active', 'finished']));
--   alter table public.online_games
--     drop column if exists started_at,
--     drop column if exists host_ready_at,
--     drop column if exists guest_ready_at;
--
-- The status-check rollback line will fail if any row is still 'matched' at
-- that time -- resolve those rows (e.g. via abandon_matched_game, before
-- dropping it) first.
