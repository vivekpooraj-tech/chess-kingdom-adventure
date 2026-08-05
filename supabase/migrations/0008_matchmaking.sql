-- Rating system + random worldwide matchmaking, unlocked after finishing
-- the course. Deliberately kept separate from the existing invite-link
-- online mode (docs/01-PRD.md scopes multiplayer to friend-invite-only for
-- child safety, explicitly ruling out open-ended stranger contact) — the
-- app layer strips quick-chat/emoji reactions for match_type='random'
-- games, this migration just adds what's needed to tell the two modes
-- apart and to settle ratings.

alter table public.children
  add column rating int not null default 1200;

alter table public.online_games
  add column match_type text not null default 'invite' check (match_type in ('invite', 'random')),
  add column rating_applied boolean not null default false;

-- Matchmaking queue -----------------------------------------------------
create table public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  rating int not null,
  status text not null default 'waiting' check (status in ('waiting', 'matched')),
  matched_game_id uuid references public.online_games(id),
  created_at timestamptz not null default now()
);

alter table public.matchmaking_queue enable row level security;

-- A child can only see/manage their OWN queue entry directly — the actual
-- cross-child matching happens inside find_or_create_match() below, which
-- runs as SECURITY DEFINER and so isn't limited by this policy. This keeps
-- "who else is waiting" invisible to normal client queries, matching the
-- rest of the app's no-stranger-visibility posture.
create policy "child can manage own queue entry"
  on public.matchmaking_queue for all
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- Atomically pairs the caller with the closest-rated waiting opponent, or
-- enqueues them if nobody's waiting yet. FOR UPDATE SKIP LOCKED is what
-- makes this safe against two callers racing to claim the same waiting
-- row — without it, two players could both create a game against the same
-- third player at once.
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
    insert into online_games (host_child_id, guest_child_id, host_color, status, match_type)
    values (
      opponent.child_id,
      p_child_id,
      case when random() < 0.5 then 'w' else 'b' end,
      'active',
      'random'
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

-- Settles ELO-style rating changes once a random match finishes. Guarded
-- by rating_applied so it's safe to call from either (or both) players'
-- clients without double-applying — both clients independently detect
-- checkmate locally (see ChessBoard's onGameOver) and may both call this.
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

  update children set rating = round(host_rating + k * (host_score - 1.0 / (1 + power(10, (guest_rating - host_rating) / 400.0))))
    where id = g.host_child_id;
  update children set rating = round(guest_rating + k * (guest_score - 1.0 / (1 + power(10, (host_rating - guest_rating) / 400.0))))
    where id = g.guest_child_id;

  update online_games set rating_applied = true where id = p_game_id;
end;
$$;

grant execute on function public.apply_match_rating(uuid) to authenticated;
