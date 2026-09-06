-- Stop the browser writing the board.
--
-- submit_online_move is granted to `authenticated`, and it takes p_fen and
-- p_san straight from the caller. It checks ownership, participation, whose
-- turn it is and the clock — all correctly — but it never checks the chess,
-- because Postgres has no engine to check it with. A signed-in player could
-- therefore store any position they liked, for either side.
--
-- Validation now happens in app/api/online/[gameId]/move, which replays the
-- authoritative move list with chess.js, rejects anything illegal, and
-- generates the official SAN and FEN itself. That route calls this function
-- with the service role, which is not subject to these grants, so the browser
-- no longer needs the privilege — and must not keep it, or the validation is
-- merely advisory.
--
-- It also fixes a real hole in the function. For untimed games (time_control
-- is null) it writes the move and RETURNS before the turn check further down,
-- so those games had no turn enforcement at all: either player could move at
-- any time, including the opponent's pieces. The early branch now performs the
-- same check as the timed path.
--
-- Additive and backward compatible: the signature is unchanged, existing games
-- keep working, and invite/matchmaking flows are untouched.
--
-- Safe to run more than once.
--
-- ROLLBACK, if the route must be disabled in a hurry:
--   grant execute on function public.submit_online_move(uuid, uuid, text, text) to authenticated;

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
  -- The service role has no auth.uid(); the route has already authenticated the
  -- player and verified participation before calling. A direct call from a
  -- signed-in client still has to pass this.
  if not v_owns and auth.uid() is not null then
    raise exception 'Not authorized for this child';
  end if;

  v_is_host := (g.host_child_id = p_child_id);
  if not v_is_host and g.guest_child_id is distinct from p_child_id then
    raise exception 'Not a participant in this game';
  end if;

  if g.status <> 'active' then
    raise exception 'Game is not active';
  end if;

  v_mover_color := case
    when v_is_host then g.host_color
    else (case when g.host_color = 'w' then 'b' else 'w' end)
  end;

  -- Untimed games: previously this branch returned before any turn check, so
  -- either player could move whenever they liked. It now enforces turn using
  -- the same rule as a timed game. current_turn is null on legacy untimed rows,
  -- which is treated as "no constraint recorded" rather than a rejection, so
  -- games created before clocks existed keep working.
  if g.time_control is null then
    if g.current_turn is not null and g.current_turn is distinct from v_mover_color then
      raise exception 'Not your turn';
    end if;
    update online_games
    set fen = p_fen,
        moves = array_append(moves, p_san),
        current_turn = case when v_mover_color = 'w' then 'b' else 'w' end
    where id = p_game_id;
    return query select null::bigint, null::bigint, g.status, g.winner;
    return;
  end if;

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

-- The browser may no longer write the board directly. Only the validating
-- route (service role) may call this.
revoke execute on function public.submit_online_move(uuid, uuid, text, text) from authenticated;
revoke execute on function public.submit_online_move(uuid, uuid, text, text) from public;
