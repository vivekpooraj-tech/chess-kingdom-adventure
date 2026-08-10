-- Phase 16B: server-authoritative chess clocks for online games.
--
-- AUDIT FINDING that shaped this migration: appendGameMove() (the existing
-- move-submission path) was a PLAIN client-side .update({fen, moves}) call
-- — not an RPC, no SECURITY DEFINER, no turn-order check, nothing server-
-- authoritative about it at all. Bolting clock columns onto that same path
-- would make the clock trivially cheatable: any client could just call
-- .update({white_time_ms: 600000}) directly, or simply keep calling the
-- old plain-update path and never touch the clock at all (free unlimited
-- time). So this migration does two things together, not one:
--   1. Adds the clock columns.
--   2. Makes a handful of SECURITY DEFINER RPCs (mirroring the existing
--      mark_lesson_complete / find_or_create_match pattern) the ONLY way
--      to write fen/moves/current_turn/status/winner/the clock columns —
--      enforced with column-level REVOKE, not just RLS (RLS is row-level;
--      it can't stop a client from writing an allowed row's clock column
--      directly, only column-level GRANT/REVOKE can).
--
-- Untimed legacy games (time_control is null — every game created before
-- this migration) are deliberately left with NO new turn/clock enforcement
-- at all in submit_online_move, so an in-progress old game can't suddenly
-- start rejecting moves it would have accepted yesterday. Only newly
-- created games (which always get a time_control from here on) get real
-- clock+turn enforcement.

alter table public.online_games
  add column time_control text check (time_control is null or time_control in ('5+0', '10+0', '15+10')),
  add column initial_time_ms bigint,
  add column increment_ms bigint not null default 0,
  add column white_time_ms bigint,
  add column black_time_ms bigint,
  add column last_move_at timestamptz,
  add column current_turn text check (current_turn in ('w', 'b'));

-- --------------------------------------------------------------------------
-- Trigger, not just app-level derivation: initial_time_ms/increment_ms/
-- white_time_ms/black_time_ms/current_turn are NOT covered by the REVOKE
-- UPDATE below (INSERT is a separate privilege) — without this, a
-- malicious client could still INSERT a brand new game with asymmetric
-- clocks directly (e.g. white_time_ms: 999999, black_time_ms: 1) before
-- anyone else ever joins it. This derives all of those fields purely from
-- `time_control` (itself constrained to the 3 known presets above) on
-- every insert, overriding anything the client attempted to set for them
-- directly — keeps content/timeControls.ts's values in sync manually,
-- same tradeoff already accepted elsewhere in this schema.
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
    when '5+0' then v_initial_ms := 300000; v_increment_ms := 0;
    when '10+0' then v_initial_ms := 600000; v_increment_ms := 0;
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
-- join_online_game — replaces the plain client update in joinOnlineGame().
-- Needs to be server-side for one reason beyond just consistency: the
-- clock's start time (last_move_at) has to come from the database's own
-- clock_timestamp(), never a client-supplied value.
-- --------------------------------------------------------------------------
create or replace function public.join_online_game(p_game_id uuid, p_guest_child_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_updated int;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_guest_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  update online_games
  set guest_child_id = p_guest_child_id,
      status = 'active',
      current_turn = coalesce(current_turn, 'w'),
      last_move_at = case when time_control is not null then clock_timestamp() else last_move_at end
  where id = p_game_id and guest_child_id is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.join_online_game(uuid, uuid) to authenticated;

-- --------------------------------------------------------------------------
-- submit_online_move — replaces appendGameMove()'s plain client update.
-- The single atomic move+clock operation: verifies ownership and turn
-- order, deducts real elapsed time (server clock, not client-supplied)
-- from the mover's own remaining time, rejects the move outright if that
-- clock had already reached zero, adds increment, flips current_turn, and
-- persists fen/moves/clocks/last_move_at together in one UPDATE. Untimed
-- legacy games skip all of the turn/clock logic and behave exactly like
-- the old appendGameMove did.
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

  -- Untimed legacy game: identical behavior to the old plain-update
  -- appendGameMove — no turn check, no clock.
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

  -- The mover's own clock had already expired before this move arrived —
  -- reject the move and end the game on time, server time deciding, not
  -- whatever the client's local countdown happened to display. Returned
  -- as a normal result (status='finished'), NOT a raised exception: an
  -- exception here would roll back the very update that marks the game
  -- finished, silently undoing the timeout. The caller checks the
  -- returned `status` to tell a rejected-by-timeout call apart from a
  -- successful move.
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

-- --------------------------------------------------------------------------
-- claim_timeout — either player's client can call this (typically the
-- player who is NOT on move, watching the opponent's clock run out) to ask
-- the server to check whether the side on move has actually run out of
-- time. Purely re-derives the truth from last_move_at + the stored clock
-- using the server's own clock — a premature or malicious call just
-- returns the current (unchanged) state, it can't force a timeout that
-- hasn't genuinely happened.
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- finish_online_game_by_result — replaces finishOnlineGame()'s plain
-- client update. Called when a client locally detects checkmate/draw via
-- chess.js (unchanged trust model — this app has never re-validated chess
-- legality server-side; that's a pre-existing, separate scope from the
-- clock work this phase is about). Moved to an RPC purely so status/winner
-- can be REVOKEd from direct client writes below without also breaking
-- this call site.
-- --------------------------------------------------------------------------
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
-- Column-level lockdown: RLS only controls which ROWS a client can touch,
-- not which COLUMNS — without this, a client could still call
-- .update({white_time_ms: 600000}) directly on a row it's genuinely a
-- participant in, RPCs or not. SECURITY DEFINER functions run as the
-- function owner and are unaffected by these REVOKEs, so the RPCs above
-- keep working; only ad-hoc client REST calls to these columns stop
-- working, forcing every write through the audited RPC path.
--
-- host_reaction/guest_reaction (quick chat/emoji) and match_type/
-- rating_applied/time_control/initial_time_ms/increment_ms (set once at
-- creation, not part of the ongoing clock trust chain) are deliberately
-- left as normal client-writable columns — unchanged from before, no
-- reason to restrict them for this feature.
-- --------------------------------------------------------------------------
revoke update (
  fen, moves, current_turn, status, winner,
  white_time_ms, black_time_ms, last_move_at, guest_child_id
) on public.online_games from authenticated;

-- --------------------------------------------------------------------------
-- find_or_create_match (originally supabase/migrations/0008_matchmaking.sql)
-- — CREATE OR REPLACE, same signature, same SECURITY DEFINER + FOR UPDATE
-- SKIP LOCKED race-safety, unchanged matching logic. Only addition: random
-- matches now start with the 10+0 default clock (section 5 — "Use 10+0 as
-- the default initially"), since a match is created already 'active' with
-- both players present, so its clock has to start ticking immediately.
-- Only `time_control` is set explicitly here — the online_games_set_clock_
-- defaults trigger above derives initial_time_ms/increment_ms/white_time_ms/
-- black_time_ms/current_turn from it, so that logic isn't duplicated here.
-- --------------------------------------------------------------------------
create or replace function public.find_or_create_match(p_child_id uuid, p_rating int)
returns table(matched boolean, game_id uuid)
language plpgsql
security definer set search_path = public
as $$
declare
  opponent record;
  new_game_id uuid;
begin
  select * into opponent
  from matchmaking_queue
  where status = 'waiting' and child_id <> p_child_id
  order by abs(rating - p_rating) asc, created_at asc
  limit 1
  for update skip locked;

  if opponent.id is not null then
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
      '10+0', clock_timestamp()
    )
    returning id into new_game_id;

    update matchmaking_queue set status = 'matched', matched_game_id = new_game_id where id = opponent.id;
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';

    return query select true, new_game_id;
  else
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';
    insert into matchmaking_queue (child_id, rating, status) values (p_child_id, p_rating, 'waiting');
    return query select false, null::uuid;
  end if;
end;
$$;

grant execute on function public.find_or_create_match(uuid, int) to authenticated;
