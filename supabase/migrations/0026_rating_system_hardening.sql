-- Random Match rating system hardening (Phase 26).
--
-- Audit findings (verified against the LIVE database, not just migration
-- files, before writing anything below):
--
--   - children.rating already defaults to 400 for new rows (0020). Existing
--     rows are untouched by that migration, exactly as intended: 4 real
--     children (real parent emails, created 2026-07-29 through 2026-08-06,
--     before 0020 shipped) still legitimately sit at 1200 -- their own real
--     historical rating, not a bug and not a hardcoded UI value (grepped
--     the whole app for "1200" in .ts/.tsx: zero hits outside migration
--     files). Per this phase's own explicit instruction ("existing users
--     already above 400 keep their current rating"), these are left
--     completely alone here. The one child created after 0020 (the
--     dev-test account) already correctly shows 400.
--   - children.rating already has zero client write privilege at all
--     (confirmed live via information_schema.role_column_grants: only
--     SELECT/REFERENCES for authenticated and anon, no INSERT, no UPDATE)
--     -- migrations 0022 and 0024 from an earlier phase already closed
--     both the column-vs-table-grant-override gap and the INSERT-with-
--     arbitrary-rating gap for this exact column. Nothing to fix here.
--   - apply_match_rating() already uses the real Elo formula with K=32,
--     already guards match_type<>'random' (tournament/invite games never
--     touch rating), already guards rating_applied for idempotency. Two
--     real gaps found and fixed below: (1) no floor -- a rating could fall
--     below 400 in principle; (2) no rating_history was ever written, so
--     there's no way to show a rating trend over time.
--   - find_or_create_match() already orders candidates by
--     (rating difference asc, waiting time asc) -- already exactly
--     "closest rating first, then longest-waiting tie-break" -- and
--     already has an expanding search window. One real gap: it trusts the
--     client-supplied p_rating parameter both for the comparison AND for
--     the value stored in matchmaking_queue, instead of deriving it from
--     children.rating server-side. Fixed below (parameter kept for
--     backward compatibility with the existing call site, but its value is
--     now ignored). The window's growth curve is also reshaped to match
--     this phase's specific requested steps (±50/±100/±150/±250/±400+)
--     instead of the previous continuous 150+75-per-10s formula -- same
--     mechanism (grows with the WAITING candidate's own elapsed wait,
--     symmetric and fair), different numbers.
--   - No rating_history table existed. Added below, server-write-only.

-- ============================================================================
-- 1. rating_history -- server-authoritative record of every rating change.
-- ============================================================================

create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  game_id uuid references public.online_games(id) on delete set null,
  old_rating int not null,
  rating_change int not null,
  new_rating int not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  opponent_child_id uuid references public.children(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists rating_history_child_created_idx
  on public.rating_history (child_id, created_at desc);

alter table public.rating_history enable row level security;

drop policy if exists "parent can view own child's rating history" on public.rating_history;
create policy "parent can view own child's rating history"
  on public.rating_history for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- Server-write-only, same reasoning as daily_challenge_history: this drives
-- future rating changes indirectly (it's an audit trail of exactly what
-- apply_match_rating did), so a client must never be able to insert a
-- fabricated entry or edit history after the fact.
revoke insert, update, delete on public.rating_history from authenticated, anon;

-- ============================================================================
-- 2. apply_match_rating: add the 400 floor, and write rating_history for
-- both players. Structurally identical otherwise -- same K=32 Elo formula,
-- same guards (match_type='random' only, rating_applied idempotency,
-- status='finished' + guest present).
-- ============================================================================

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
  host_result text;
  guest_result text;
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
    host_result := 'draw'; guest_result := 'draw';
  elsif g.winner = g.host_color then
    host_score := 1; guest_score := 0;
    host_result := 'win'; guest_result := 'loss';
  else
    host_score := 0; guest_score := 1;
    host_result := 'loss'; guest_result := 'win';
  end if;

  -- Floor at 400: a rating can never be driven below the starting point,
  -- no matter how long a losing streak runs.
  host_new := greatest(400, round(host_rating + k * (host_score - 1.0 / (1 + power(10, (guest_rating - host_rating) / 400.0)))));
  guest_new := greatest(400, round(guest_rating + k * (guest_score - 1.0 / (1 + power(10, (host_rating - guest_rating) / 400.0)))));

  update children set rating = host_new where id = g.host_child_id;
  update children set rating = guest_new where id = g.guest_child_id;

  update online_games
  set rating_applied = true,
      host_rating_before = host_rating,
      host_rating_after = host_new,
      guest_rating_before = guest_rating,
      guest_rating_after = guest_new
  where id = p_game_id;

  insert into rating_history (child_id, game_id, old_rating, rating_change, new_rating, result, opponent_child_id)
  values
    (g.host_child_id, p_game_id, host_rating, host_new - host_rating, host_new, host_result, g.guest_child_id),
    (g.guest_child_id, p_game_id, guest_rating, guest_new - guest_rating, guest_new, guest_result, g.host_child_id);
end;
$$;

grant execute on function public.apply_match_rating(uuid) to authenticated;

-- ============================================================================
-- 3. find_or_create_match: derive rating server-side (p_rating kept in the
-- signature for the existing call site, but its VALUE is no longer
-- trusted for anything -- a client could otherwise misrepresent its own
-- queue-visible rating independently of its real children.rating, biasing
-- who it gets matched against even though the eventual Elo update still
-- correctly used the real column). Search window reshaped to the
-- requested step curve; range-form comparison (rating between lo and hi)
-- instead of abs(...) so the partial index below can actually help prune;
-- deterministic final tie-break added (id) for the near-impossible case of
-- two candidates tied on both rating-difference and created_at.
-- ============================================================================

create or replace function public.find_or_create_match(p_child_id uuid, p_rating int)
returns table(matched boolean, game_id uuid, blocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_rating int;
  opponent record;
  new_game_id uuid;
  v_eligible boolean;
  v_opponent_eligible boolean;
  v_have_opponent boolean := false;
begin
  -- Pre-existing gap, closed here: find_or_create_match previously had no
  -- ownership check at all on p_child_id (every other RPC in this schema
  -- has one) -- a caller could look for/create a match, and thereby
  -- create an online_games row and consume a free-game credit, under a
  -- child_id that isn't theirs. Same ownership pattern used everywhere
  -- else in this codebase.
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
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

  select * into opponent
  from matchmaking_queue q
  where q.status = 'waiting'
    and q.child_id <> p_child_id
    and q.rating between v_rating - (
      -- Stepped expanding window, based on how long THIS waiting candidate
      -- has been sitting in the queue (symmetric: a patient waiter becomes
      -- matchable by a wider range of newcomers, not just by luck).
      case
        when extract(epoch from (clock_timestamp() - q.created_at)) < 15 then 50
        when extract(epoch from (clock_timestamp() - q.created_at)) < 30 then 100
        when extract(epoch from (clock_timestamp() - q.created_at)) < 60 then 150
        when extract(epoch from (clock_timestamp() - q.created_at)) < 120 then 250
        else 400 + floor((extract(epoch from (clock_timestamp() - q.created_at)) - 120) / 30) * 50
      end
    ) and v_rating + (
      case
        when extract(epoch from (clock_timestamp() - q.created_at)) < 15 then 50
        when extract(epoch from (clock_timestamp() - q.created_at)) < 30 then 100
        when extract(epoch from (clock_timestamp() - q.created_at)) < 60 then 150
        when extract(epoch from (clock_timestamp() - q.created_at)) < 120 then 250
        else 400 + floor((extract(epoch from (clock_timestamp() - q.created_at)) - 120) / 30) * 50
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
    insert into matchmaking_queue (child_id, rating, status) values (p_child_id, v_rating, 'waiting');
    return query select false, null::uuid, false;
  end if;
end;
$$;

grant execute on function public.find_or_create_match(uuid, int) to authenticated;

-- Partial index: prunes to just the (small, transient) set of currently-
-- waiting rows and gives the planner a sorted rating structure to work
-- from. The window itself is a per-row computed value (each candidate's
-- own elapsed wait), so the final bound still needs a per-row check --
-- fully sargable pruning isn't possible for a genuinely variable window --
-- but this still avoids scanning matched/historical rows, which is the
-- overwhelming majority of the table over time.
create index if not exists matchmaking_queue_waiting_rating_idx
  on public.matchmaking_queue (rating)
  where status = 'waiting';
