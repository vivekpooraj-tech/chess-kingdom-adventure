-- Stop a player banking a rated win they did not play.
--
-- finish_online_game_by_result (current definition in 0024) checks that the
-- caller owns the child, that the child is in the game, and that the game is
-- still active. It does NOT look at the board: p_winner arrives from the client
-- and is written verbatim. So a participant in a live RATED game can declare
-- themselves the winner and immediately call apply_match_rating to collect the
-- points.
--
-- This was demonstrated, not inferred. scripts/test-rated-match-e2e.js matches
-- two players through the real queue, has one of them announce victory with
-- ZERO moves played, and observes the result accepted and the rating awarded.
--
-- Fully fixing this needs the server to replay the moves and confirm the
-- position, which plpgsql cannot do — there is no chess engine in the database,
-- and adding a service to host one is outside what this project runs.
--
-- What IS decidable in SQL is that some claims are impossible. The fastest
-- possible checkmate is four plies (1. f3 e5 2. g4 Qh4#), so a player claiming
-- a win in a game with fewer than four moves is certainly not reporting a real
-- checkmate. That single check removes the zero-effort exploit — sitting in the
-- queue and instantly claiming wins — without ever being able to reject a
-- legitimate mate.
--
-- Deliberately NOT restricted:
--   * resignation — declaring the OPPONENT the winner is against the caller's
--     own interest and is legitimate on move one
--   * draws — agreeing a draw early is legal and gains a self-declaring player
--     nothing against an equal opponent
--   * unrated invite games — nothing is at stake, and blocking early results
--     would break casual play between friends
--
-- Safe to run more than once. Additive: the signature is unchanged.

create or replace function public.finish_online_game_by_result(p_game_id uuid, p_child_id uuid, p_winner text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  g record;
  v_my_color text;
  -- 1. f3 e5 2. g4 Qh4# — the shortest mate there is.
  v_min_plies_for_mate constant int := 4;
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

  -- New: a RATED win claimed for oneself must at least be possible.
  if g.match_type = 'random' and p_winner in ('w', 'b') then
    v_my_color := case
      when p_child_id = g.host_child_id then g.host_color
      else case when g.host_color = 'w' then 'b' else 'w' end
    end;

    if p_winner = v_my_color
       and coalesce(array_length(g.moves, 1), 0) < v_min_plies_for_mate then
      raise exception 'Cannot claim a win before a checkmate is possible';
    end if;
  end if;

  update online_games set status = 'finished', winner = p_winner where id = p_game_id;
end;
$$;
