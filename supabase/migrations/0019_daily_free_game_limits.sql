-- Phase: Daily Free Play limit + unlimited premium access.
--
-- Free (non-premium) children get 2 AI games + 2 multiplayer games per
-- rolling 24-hour window (independent counters, not midnight-reset).
-- Premium children are unlimited. This is a NEW, separate entitlement
-- layer from the lesson/Academy paywall (child_lesson_progress,
-- premium_status-gated lesson days, zone free-days) — nothing about that
-- system is touched here.
--
-- AUDIT NOTE that shaped this migration: online_games' own CREATE TABLE
-- and RLS setup do not exist in this migrations folder at all (it predates
-- the migration history, likely created directly against the live DB) —
-- so the REVOKE below is written to be safe/idempotent regardless of its
-- exact current grants, the same way every other REVOKE in this file is,
-- rather than assuming a specific prior state.
--
-- WHEN A GAME IS "CONSUMED" (the exact rule, so it's not ambiguous):
--   - AI (Free Play): the moment the child picks a difficulty and the
--     server allows it (start_ai_game) — before the board ever renders.
--     Opening the Free Play screen, or viewing the difficulty picker,
--     never consumes anything.
--   - Multiplayer (Random Match): the moment a real 2-player active game
--     is created — i.e. when find_or_create_match actually pairs two
--     children, for BOTH of them at once. Simply joining the matchmaking
--     queue (no opponent found yet) consumes nothing; cancelling search
--     consumes nothing.
--   - Multiplayer (Invite a Friend): the moment a friend actually joins
--     the invite (join_online_game succeeds), for BOTH host and guest at
--     once. Creating/sharing an invite link that nobody joins consumes
--     nothing for the host.
-- In every case a credit is spent at game START and is NOT refunded for
-- resignation, abandonment, disconnection, or loss — once a real game
-- exists, it counts, regardless of how it ends. This is the simplest rule
-- that can't be gamed by starting-and-quitting to "retry" for a better
-- position, and it's consistent across AI and multiplayer.

create table public.free_game_usage (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  game_type text not null check (game_type in ('ai', 'multiplayer')),
  started_at timestamptz not null default clock_timestamp()
);

create index free_game_usage_child_type_started_idx
  on public.free_game_usage (child_id, game_type, started_at);

alter table public.free_game_usage enable row level security;

-- Read-only for the owning parent (e.g. a future parent-dashboard usage
-- view) — every WRITE goes through the SECURITY DEFINER functions below,
-- never a direct client insert/update/delete.
create policy "parent can view own child's free game usage"
  on public.free_game_usage for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.free_game_usage from authenticated;

-- --------------------------------------------------------------------------
-- Internal helpers — deliberately NOT granted to `authenticated`. Only
-- callable from within the other SECURITY DEFINER functions below, each of
-- which has already verified the calling parent owns the child_id in
-- question. Keeping the actual counting/consuming logic in one place so
-- the AI path and every multiplayer path (Random Match pairing either
-- direction, Invite a Friend join) all enforce the exact same rule.
-- --------------------------------------------------------------------------
create or replace function public.check_free_game_eligibility(p_child_id uuid, p_game_type text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_premium boolean;
  v_count int;
begin
  select (pr.premium_status = 'premium') into v_is_premium
  from children c join parents pr on pr.id = c.parent_id
  where c.id = p_child_id;

  if v_is_premium then
    return true;
  end if;

  select count(*) into v_count from free_game_usage
  where child_id = p_child_id and game_type = p_game_type
    and started_at > clock_timestamp() - interval '24 hours';

  return v_count < 2;
end;
$$;

create or replace function public.consume_free_game_credit(p_child_id uuid, p_game_type text)
returns table(allowed boolean, remaining int, next_available_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_premium boolean;
  v_count int;
  v_oldest timestamptz;
begin
  select (pr.premium_status = 'premium') into v_is_premium
  from children c join parents pr on pr.id = c.parent_id
  where c.id = p_child_id;

  if v_is_premium then
    return query select true, null::int, null::timestamptz;
    return;
  end if;

  select count(*), min(started_at) into v_count, v_oldest
  from free_game_usage
  where child_id = p_child_id and game_type = p_game_type
    and started_at > clock_timestamp() - interval '24 hours';

  if v_count >= 2 then
    return query select false, 0, v_oldest + interval '24 hours';
    return;
  end if;

  insert into free_game_usage (child_id, game_type) values (p_child_id, p_game_type);
  return query select true, (1 - v_count), null::timestamptz;
end;
$$;

-- --------------------------------------------------------------------------
-- get_free_game_status — read-only, for the "X of 2 free games remaining
-- today" UI. Never consumes a credit.
-- --------------------------------------------------------------------------
create or replace function public.get_free_game_status(p_child_id uuid)
returns table(
  is_premium boolean,
  ai_remaining int,
  ai_next_available_at timestamptz,
  mp_remaining int,
  mp_next_available_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_is_premium boolean;
  v_ai_count int; v_ai_oldest timestamptz;
  v_mp_count int; v_mp_oldest timestamptz;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select (pr.premium_status = 'premium') into v_is_premium
  from children c join parents pr on pr.id = c.parent_id
  where c.id = p_child_id;

  if v_is_premium then
    return query select true, null::int, null::timestamptz, null::int, null::timestamptz;
    return;
  end if;

  select count(*), min(started_at) into v_ai_count, v_ai_oldest
  from free_game_usage where child_id = p_child_id and game_type = 'ai'
    and started_at > clock_timestamp() - interval '24 hours';
  select count(*), min(started_at) into v_mp_count, v_mp_oldest
  from free_game_usage where child_id = p_child_id and game_type = 'multiplayer'
    and started_at > clock_timestamp() - interval '24 hours';

  return query select
    false,
    greatest(0, 2 - v_ai_count),
    case when v_ai_count >= 2 then v_ai_oldest + interval '24 hours' else null end,
    greatest(0, 2 - v_mp_count),
    case when v_mp_count >= 2 then v_mp_oldest + interval '24 hours' else null end;
end;
$$;
grant execute on function public.get_free_game_status(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- start_ai_game — called right when a child picks a difficulty on the Free
-- Play screen, BEFORE the board renders. Free Play has no server-side game
-- row at all (Stockfish runs client-side), so this is the only "a game
-- just started" event that exists for AI games.
-- --------------------------------------------------------------------------
create or replace function public.start_ai_game(p_child_id uuid)
returns table(allowed boolean, remaining int, next_available_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  return query select * from consume_free_game_credit(p_child_id, 'ai');
end;
$$;
grant execute on function public.start_ai_game(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- create_invite_game — replaces the plain client insert createOnlineGame()
-- used to do. Checks the HOST's multiplayer eligibility before an invite
-- link is even generated (so a fully-exhausted free host isn't handed a
-- link they can't use), but does NOT consume a credit yet — an invite that
-- nobody joins is not a game that started (see the header comment).
-- --------------------------------------------------------------------------
create or replace function public.create_invite_game(p_host_child_id uuid, p_time_control text)
returns table(id uuid, blocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
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

  select check_free_game_eligibility(p_host_child_id, 'multiplayer') into v_eligible;
  if not v_eligible then
    return query select null::uuid, true;
    return;
  end if;

  insert into online_games (host_child_id, time_control)
  values (p_host_child_id, p_time_control)
  returning online_games.id into new_id;

  return query select new_id, false;
end;
$$;
grant execute on function public.create_invite_game(uuid, text) to authenticated;

-- --------------------------------------------------------------------------
-- join_online_game — return shape changed from `boolean` to
-- `table(joined boolean, blocked boolean)` so the client can distinguish
-- "someone else already claimed this invite" from "blocked by the free
-- multiplayer limit" (host's or guest's — re-checked here since time may
-- have passed since the host's own create_invite_game check). A credit is
-- consumed for BOTH host and guest only once the join actually succeeds —
-- this is the real "game started" moment for an Invite a Friend match.
-- --------------------------------------------------------------------------
drop function if exists public.join_online_game(uuid, uuid);

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

-- --------------------------------------------------------------------------
-- find_or_create_match — return shape changed from
-- `table(matched boolean, game_id uuid)` to
-- `table(matched boolean, game_id uuid, blocked boolean)`. Checks the
-- CALLER's eligibility before even joining the matchmaking queue (so an
-- exhausted free child never sits in queue at all). If a waiting opponent
-- is found, ALSO re-checks that opponent's eligibility — they may have
-- exhausted their own multiplayer credit elsewhere since joining the
-- queue — and if so removes their stale queue entry (same effect as them
-- cancelling) instead of leaving a permanently-unmatchable row at the
-- front of the queue. A credit is consumed for both sides only when a
-- real active game is actually created; joining the queue alone consumes
-- nothing.
-- --------------------------------------------------------------------------
drop function if exists public.find_or_create_match(uuid, int);

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
  where status = 'waiting' and child_id <> p_child_id
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

-- Forces all invite-game creation through create_invite_game() above,
-- which enforces the host's free-multiplayer eligibility before ever
-- inserting a row. Written defensively (see header note) rather than
-- assuming the exact prior grant state.
revoke insert on public.online_games from authenticated;
