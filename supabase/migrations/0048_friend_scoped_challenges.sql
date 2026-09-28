-- Friend-scoped challenges.
--
-- Today's "Invite a Friend" link (create_invite_game/join_online_game,
-- 0019_daily_free_game_limits.sql) is deliberately OPEN: any signed-in
-- child who obtains the link/gameId can join, by design — the host shares
-- it out of band, and nothing about that flow changes here.
--
-- This adds a SECOND, narrower flow on top of the same online_games table:
-- challenging a specific accepted friend by their child id, where only
-- that friend may accept. It reuses every existing online_games mechanic
-- (moves, clocks, draw/resign, completion, rating) untouched — the only
-- new concept is WHO is allowed to fill guest_child_id.
--
-- invited_child_id is nullable and defaults to null, so every existing row
-- and every future generic-invite/random/tournament row is completely
-- unaffected: the new join_online_game guard below is a no-op whenever
-- this column is null.

alter table public.online_games
  add column invited_child_id uuid references public.children(id) on delete set null;

-- Only useful while a challenge is still open (status='waiting'); a
-- partial index keeps it small and keeps getOpenChallengesForChild() fast
-- without indexing the (large, mostly null) column for finished games.
create index online_games_invited_child_id_idx
  on public.online_games (invited_child_id)
  where status = 'waiting';

-- ----------------------------------------------------------------------------
-- create_friend_challenge — same shape as create_invite_game (id, blocked)
-- so the client can reuse the exact same result handling, plus the same
-- host-eligibility check. The one addition: the target must be an ACCEPTED
-- friend of the host — pending/declined/blocked relationships (or no
-- relationship at all) are rejected, matching respond_to_friend_request's
-- existing accepted-only semantics for everything friendship grants.
-- ----------------------------------------------------------------------------
create or replace function public.create_friend_challenge(
  p_host_child_id uuid,
  p_friend_child_id uuid,
  p_time_control text
)
returns table(id uuid, blocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_are_friends boolean;
  v_eligible boolean;
  new_id uuid;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_host_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  if p_friend_child_id = p_host_child_id then
    raise exception 'Cannot challenge yourself';
  end if;

  select exists (
    select 1 from friendships
    where status = 'accepted'
      and (
        (child_a = p_host_child_id and child_b = p_friend_child_id) or
        (child_a = p_friend_child_id and child_b = p_host_child_id)
      )
  ) into v_are_friends;
  if not v_are_friends then
    raise exception 'Not friends';
  end if;

  select check_free_game_eligibility(p_host_child_id, 'multiplayer') into v_eligible;
  if not v_eligible then
    return query select null::uuid, true;
    return;
  end if;

  insert into online_games (host_child_id, time_control, invited_child_id)
  values (p_host_child_id, p_time_control, p_friend_child_id)
  returning online_games.id into new_id;

  return query select new_id, false;
end;
$$;
grant execute on function public.create_friend_challenge(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- join_online_game — re-created with one added guard, otherwise byte-for-
-- byte identical to the 0019 version (same signature, same eligibility
-- checks, same compare-and-swap update). The guard sits before the
-- eligibility checks so an unrelated child is rejected cheaply, the same
-- "someone else already claimed this invite" shape the client already
-- handles (joined=false, blocked=false) — no new client-side case needed.
-- ----------------------------------------------------------------------------
create or replace function public.join_online_game(p_game_id uuid, p_guest_child_id uuid)
returns table(joined boolean, blocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  g record;
  v_guest_eligible boolean;
  v_host_eligible boolean;
  v_updated int;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_guest_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select * into g from online_games where id = p_game_id for update;
  if g.id is null or g.guest_child_id is not null then
    return query select false, false;
    return;
  end if;

  if g.invited_child_id is not null and g.invited_child_id <> p_guest_child_id then
    return query select false, false;
    return;
  end if;

  select check_free_game_eligibility(p_guest_child_id, 'multiplayer') into v_guest_eligible;
  select check_free_game_eligibility(g.host_child_id, 'multiplayer') into v_host_eligible;

  if not v_guest_eligible or not v_host_eligible then
    return query select false, true;
    return;
  end if;

  update online_games
  set guest_child_id = p_guest_child_id,
      status = 'active',
      current_turn = coalesce(current_turn, 'w'),
      last_move_at = case when time_control is not null then clock_timestamp() else last_move_at end
  where id = p_game_id and guest_child_id is null;

  get diagnostics v_updated = row_count;
  if v_updated > 0 then
    perform consume_free_game_credit(g.host_child_id, 'multiplayer');
    perform consume_free_game_credit(p_guest_child_id, 'multiplayer');
    return query select true, false;
  else
    return query select false, false;
  end if;
end;
$$;
grant execute on function public.join_online_game(uuid, uuid) to authenticated;

-- invited_child_id is set only by create_friend_challenge (SECURITY
-- DEFINER) — it must never become client-writable. online_games' UPDATE
-- grant is already narrowed to (host_reaction, guest_reaction) only (see
-- 0022_fix_update_grants_table_level_override.sql); nothing to change
-- there, this is just documentation of why no grant is added here.
