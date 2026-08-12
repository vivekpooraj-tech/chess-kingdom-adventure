-- Phase: rating as player identity — numeric-only, no skill labels; new
-- players start at 400 (was 1200); matchmaking now expands its acceptable
-- rating gap the longer a candidate has been waiting instead of matching
-- unconditionally with whoever's closest, however far off that is; and the
-- rating column itself is locked down the same way premium_status
-- (0018_secure_premium_status.sql) and online_games' clock/status columns
-- (0017_online_game_clocks.sql) already are — closing a gap 0008 left open,
-- where nothing stopped a signed-in parent's client from writing
-- children.rating directly (RLS there is a blanket parent-owns-child policy
-- with no column restriction).

-- New players start at 400, not 1200. Existing children keep whatever
-- rating they already have — this only changes the default applied to
-- future inserts, it does not touch existing rows.
alter table public.children
  alter column rating set default 400;

revoke update (rating) on public.children from authenticated;

-- Persist the before/after values from apply_match_rating() so EITHER
-- player's client can render "you: X -> Y (+/-N)" / "opponent: X -> Y
-- (+/-N)" after a finished random match. Only one of the two clients'
-- apply_match_rating calls actually does the work (guarded by
-- rating_applied below) — storing the result on the game row itself, not
-- just returning it, is what lets the OTHER player's client see it too,
-- via the existing Realtime subscription on online_games.
alter table public.online_games
  add column if not exists host_rating_before int,
  add column if not exists host_rating_after int,
  add column if not exists guest_rating_before int,
  add column if not exists guest_rating_after int;

-- Same Elo-style K=32 logistic formula as 0008_matchmaking.sql — only
-- change is capturing + persisting the before/after values alongside
-- applying them, so the post-game screen can show real server-calculated
-- deltas instead of just the new absolute number.
create or replace function public.apply_match_rating(p_game_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  g record;
  host_rating int;
  guest_rating int;
  host_score numeric;
  guest_score numeric;
  host_new int;
  guest_new int;
  k int := 32;
begin
  select * into g from online_games where id = p_game_id for update;
  if g.id is null then return; end if;
  if g.match_type <> 'random' then return; end if;
  if g.rating_applied then return; end if;
  if g.status <> 'finished' or g.guest_child_id is null then return; end if;

  select rating into host_rating from children where id = g.host_child_id;
  select rating into guest_rating from children where id = g.guest_child_id;

  if g.winner = 'draw' then
    host_score := 0.5; guest_score := 0.5;
  elsif g.winner = g.host_color then
    host_score := 1; guest_score := 0;
  else
    host_score := 0; guest_score := 1;
  end if;

  host_new := round(host_rating + k * (host_score - 1.0 / (1 + power(10, (guest_rating - host_rating) / 400.0))));
  guest_new := round(guest_rating + k * (guest_score - 1.0 / (1 + power(10, (host_rating - guest_rating) / 400.0))));

  update children set rating = host_new where id = g.host_child_id;
  update children set rating = guest_new where id = g.guest_child_id;

  update online_games
  set rating_applied = true,
      host_rating_before = host_rating,
      host_rating_after = host_new,
      guest_rating_before = guest_rating,
      guest_rating_after = guest_new
  where id = p_game_id;
end;
$$;

grant execute on function public.apply_match_rating(uuid) to authenticated;

-- find_or_create_match — identical signature, return shape, eligibility
-- checks, credit consumption and game-creation logic to
-- 0019_daily_free_game_limits.sql. The only change is the opponent-lookup
-- query: instead of matching with whoever is closest in rating no matter
-- how far off (the old query had no ceiling at all — a 400 could be matched
-- against a 2000 if that's literally who was waiting), each waiting
-- candidate's acceptable rating gap now grows continuously with how long
-- THEY'VE been waiting (starts at 150, widens by 75 every 10 seconds). A
-- fresh searcher is only paired with someone within ~150 points at first,
-- but nobody is left waiting indefinitely for a "perfect" match — this is a
-- continuous function of wait time and rating gap, not a fixed bracket
-- table.
create or replace function public.find_or_create_match(p_child_id uuid, p_rating int)
returns table(matched boolean, game_id uuid, blocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  opponent record;
  new_game_id uuid;
  v_eligible boolean;
  v_opponent_eligible boolean;
  v_have_opponent boolean := false;
begin
  select check_free_game_eligibility(p_child_id, 'multiplayer') into v_eligible;
  if not v_eligible then
    return query select false, null::uuid, true;
    return;
  end if;

  select * into opponent
  from matchmaking_queue
  where status = 'waiting'
    and child_id <> p_child_id
    and abs(rating - p_rating) <= (150 + floor(extract(epoch from (clock_timestamp() - created_at)) / 10) * 75)
  order by abs(rating - p_rating) asc, created_at asc
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
      '10+0', clock_timestamp()
    )
    returning id into new_game_id;

    update matchmaking_queue set status = 'matched', matched_game_id = new_game_id where id = opponent.id;
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';

    perform consume_free_game_credit(opponent.child_id, 'multiplayer');
    perform consume_free_game_credit(p_child_id, 'multiplayer');

    return query select true, new_game_id, false;
  else
    delete from matchmaking_queue where child_id = p_child_id and status = 'waiting';
    insert into matchmaking_queue (child_id, rating, status) values (p_child_id, p_rating, 'waiting');
    return query select false, null::uuid, false;
  end if;
end;
$$;

grant execute on function public.find_or_create_match(uuid, int) to authenticated;
