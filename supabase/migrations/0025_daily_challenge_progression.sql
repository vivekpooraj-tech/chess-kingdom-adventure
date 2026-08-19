-- Daily Challenge personalization (Phase 25).
--
-- The previous Daily Challenge was `content/puzzles.ts`'s getDailyPuzzle():
-- `PUZZLES[dayOfYear % PUZZLES.length]` -- a pure, deterministic, entirely
-- client-side rotation. Every player got the exact same puzzle on a given
-- date, the whole pool (16 puzzles) repeated every 16 days regardless of
-- who was playing, and nothing about a child's attempt was ever recorded
-- (app/puzzles/page.tsx only increments the free-tier preview counter,
-- ` puzzle_attempts`/`child_chess_mind_activity` are both scoped to other
-- features -- Academy lesson-day puzzles and Chess Mind mini-games
-- respectively -- and neither shares this feature's puzzle-id space, so
-- neither is reusable here without conflating two different concepts).
-- There was no Daily Challenge history, streak, or difficulty of any kind
-- to preserve or break.
--
-- This migration makes puzzle SELECTION server-authoritative and
-- personalized: which puzzle a child gets today, and at what difficulty,
-- is decided here from that child's own real history (falling back to
-- children.rating and child_chess_mind_stats only on their very first day,
-- when no Daily Challenge history exists yet). The puzzle CONTENT itself
-- (FEN, and move-legality/checkmate validation) stays exactly where it
-- already lived and already worked well: content/puzzles.ts +
-- lib/chess-engine/puzzleValidation.ts, unchanged. Only a lightweight
-- metadata mirror (id/level/mate_in/theme -- NOT fen, NOT the client
-- bundle) lives in the database, so the selection RPC has something to
-- select from; kept in sync by hand with content/puzzles.ts, the same
-- accepted tradeoff already used for TIME_CONTROLS ids vs the
-- online_games.time_control CHECK constraint.

-- ============================================================================
-- 1. Puzzle metadata mirror (id/level/mate_in/theme only).
-- ============================================================================

create table if not exists public.daily_challenge_puzzles (
  puzzle_id text primary key,
  level int not null check (level between 1 and 6),
  mate_in int not null check (mate_in between 1 and 3),
  theme text not null,
  active boolean not null default true
);

alter table public.daily_challenge_puzzles enable row level security;
-- No client access at all -- only the SECURITY DEFINER RPCs below read this
-- table; nothing legitimate needs it directly (the client already has the
-- full puzzle content, including level, via content/puzzles.ts).
revoke all on public.daily_challenge_puzzles from authenticated, anon;

-- Levels below are the literal output of scripts/compute-puzzle-levels.js
-- (mateIn is the primary axis; the objective precision/avgReplies signals
-- that script computes decide the +0/+1 sub-tier) -- not hand-guessed.
-- Level 6 has no puzzles yet: the current pool's mate-in-3 content is all
-- similarly "simple" (avgReplies=1 for every one of them), so nothing in
-- it is objectively harder than the rest by this measure -- see the final
-- report's Limitations section rather than pretending otherwise.
insert into public.daily_challenge_puzzles (puzzle_id, level, mate_in, theme) values
  ('m1-backrank-rook', 1, 1, 'Back-Rank Mate'),
  ('m1-backrank-queen', 1, 1, 'Back-Rank Mate'),
  ('m1-corner-queen-a', 1, 1, 'Cornered King'),
  ('m1-corner-queen-b', 1, 1, 'Cornered King'),
  ('m1-smothered-knight', 1, 1, 'Smothered Mate'),
  ('m1-king-rook-ladder', 1, 1, 'King & Rook Mate'),
  ('m1-ladder-mid-a', 1, 1, 'Rook Ladder'),
  ('m1-corner-rook-a', 2, 1, 'Corridor Mate'),
  ('m1-corner-rook-b', 2, 1, 'Corridor Mate'),
  ('m1-knight-rook-a', 2, 1, 'Knight & Rook Mate'),
  ('m1-two-rooks-adjacent', 2, 1, 'Rook Ladder'),
  ('m2-two-rooks-a', 3, 2, 'Rook Ladder'),
  ('m2-two-rooks-b', 4, 2, 'Rook Ladder'),
  ('m2-queen-king-a', 3, 2, 'Queen & King'),
  ('m2-queen-king-b', 3, 2, 'Queen & King'),
  ('m2-two-rooks-mirror', 3, 2, 'Rook Ladder'),
  ('m2-queen-king-mirror', 3, 2, 'Queen & King'),
  ('m3-queen-net-a', 5, 3, 'Queen Mating Net'),
  ('m3-queen-net-b', 5, 3, 'Queen Mating Net'),
  ('m3-queen-net-c', 5, 3, 'Queen Mating Net'),
  ('m3-rook-box-a', 5, 3, 'Rook Box Mate'),
  ('m3-rook-box-b', 5, 3, 'Rook Box Mate'),
  ('m3-rook-box-c', 5, 3, 'Rook Box Mate'),
  ('m3-queen-short-side', 5, 3, 'Queen Mating Net')
on conflict (puzzle_id) do update set level = excluded.level, mate_in = excluded.mate_in, theme = excluded.theme;

-- ============================================================================
-- 2. Per-child, per-day Daily Challenge history. unique(child_id,
-- challenge_date) is the same-day-consistency guarantee: a second request
-- the same day always finds and returns the existing row instead of
-- generating a new one (requirement: same player + same day => same
-- puzzle), and under real concurrency (two simultaneous requests) the
-- unique constraint means at most one INSERT can ever succeed -- the other
-- caller's insert fails the constraint and falls back to reading the
-- winning row, handled inside get_daily_challenge below via
-- `insert ... on conflict do nothing` followed by a select.
-- ============================================================================

create table if not exists public.daily_challenge_history (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  puzzle_id text not null references public.daily_challenge_puzzles(puzzle_id),
  challenge_date date not null,
  level_served int not null check (level_served between 1 and 6),
  result text not null default 'pending' check (result in ('pending', 'solved', 'failed')),
  attempts int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (child_id, challenge_date)
);

create index if not exists daily_challenge_history_child_date_idx
  on public.daily_challenge_history (child_id, challenge_date desc);

alter table public.daily_challenge_history enable row level security;

drop policy if exists "parent can view own child's daily challenge history" on public.daily_challenge_history;
create policy "parent can view own child's daily challenge history"
  on public.daily_challenge_history for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- Writes are server-authoritative only, via the RPCs below -- deliberately
-- NOT the looser "parent can manage" (client-writable) pattern used by
-- puzzle_preview_usage/puzzle_attempts. Difficulty progression is exactly
-- the kind of thing a client must not be able to directly manipulate
-- (report itself as always solving, or request a specific easier puzzle),
-- so this table follows the stricter tournament-style RPC-only model
-- instead.
revoke insert, update, delete on public.daily_challenge_history from authenticated, anon;

-- ============================================================================
-- 3. get_daily_challenge: returns today's puzzle for this child, creating
-- it (server-selected) on first call of the day, idempotently returning
-- the same one on every subsequent call the same day.
-- ============================================================================

-- OUT columns are named with an "out_" prefix deliberately -- they mirror
-- daily_challenge_history/daily_challenge_puzzles column names 1:1 for a
-- clean API, but RETURNS TABLE column names are visible as plain
-- identifiers throughout the function body exactly like local variables,
-- and this schema's real column names (puzzle_id, level_served, result,
-- attempts, theme, mate_in) are used unqualified in dozens of places below.
-- Using the real names for both would repeat claim_timeout's ambiguous-
-- column bug (see this same migration's fix to that function) six times
-- over instead of once. Every internal query below still qualifies its
-- table references explicitly regardless, as a second layer of safety.
drop function if exists public.get_daily_challenge(uuid, date);

create or replace function public.get_daily_challenge(p_child_id uuid, p_date date default current_date)
returns table(out_puzzle_id text, out_level_served int, out_result text, out_attempts int, out_theme text, out_mate_in int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_existing record;
  v_rating int;
  v_chess_mind_solved int;
  v_last_level int;
  v_recent_count int;
  v_recent_solved int;
  v_recent_avg_attempts numeric;
  v_target int;
  v_excluded text[];
  v_pool text[];
  v_never_seen text[];
  v_roll numeric;
  v_chosen text;
  v_yesterday_puzzle text;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  -- Same-day consistency: a row already exists for today -> return it,
  -- never generate a second one.
  select h.puzzle_id, h.level_served, h.result, h.attempts, dp.theme, dp.mate_in
    into v_existing
    from daily_challenge_history h
    join daily_challenge_puzzles dp on dp.puzzle_id = h.puzzle_id
    where h.child_id = p_child_id and h.challenge_date = p_date;
  if v_existing.puzzle_id is not null then
    return query select v_existing.puzzle_id, v_existing.level_served, v_existing.result, v_existing.attempts, v_existing.theme, v_existing.mate_in;
    return;
  end if;

  -- ---- Determine target difficulty ----
  select h.level_served into v_last_level
    from daily_challenge_history h
    where h.child_id = p_child_id and h.challenge_date < p_date
    order by h.challenge_date desc
    limit 1;

  if v_last_level is null then
    -- Cold start: no Daily Challenge history yet. Use children.rating and
    -- Chess Mind engagement (pattern/calculation modules) as weak,
    -- one-time signals only -- never enough alone to assume "expert."
    select c.rating into v_rating from children c where c.id = p_child_id;
    select coalesce(sum(s.total_solved), 0) into v_chess_mind_solved
      from child_chess_mind_stats s
      where s.child_id = p_child_id and s.module_id in ('pattern', 'calculation');

    v_target := 1;
    if coalesce(v_rating, 400) >= 600 then
      v_target := v_target + 1;
    end if;
    if v_chess_mind_solved >= 20 then
      v_target := v_target + 1;
    end if;
    v_target := least(v_target, 3); -- a brand-new player is never started above "developing"
  else
    -- Rolling window: last 10 resolved (non-pending) attempts, requiring
    -- at least 3 before ever moving away from "maintain" -- one lucky (or
    -- unlucky) result can never swing difficulty on its own.
    select count(*), count(*) filter (where recent.result = 'solved'), avg(recent.attempts) filter (where recent.result = 'solved')
      into v_recent_count, v_recent_solved, v_recent_avg_attempts
      from (
        select h.result, h.attempts from daily_challenge_history h
        where h.child_id = p_child_id and h.challenge_date < p_date and h.result <> 'pending'
        order by h.challenge_date desc
        limit 10
      ) recent;

    v_target := v_last_level;
    if v_recent_count >= 3 then
      if v_recent_solved::numeric / v_recent_count >= 0.8 and coalesce(v_recent_avg_attempts, 99) <= 1.5 then
        v_target := least(v_last_level + 1, 6); -- strong recent performance -> nudge up, never more than one step
      elsif v_recent_solved::numeric / v_recent_count <= 0.4 then
        v_target := greatest(v_last_level - 1, 1); -- weak recent performance -> nudge down, never more than one step
      end if;
      -- otherwise: average performance, target stays at v_last_level (maintain)
    end if;
  end if;

  -- ---- Build eligible pool: unseen preferred, recent-history excluded,
  -- level within tolerance, widening only if genuinely necessary ----
  select array_agg(h.puzzle_id) into v_excluded
    from daily_challenge_history h
    where h.child_id = p_child_id
      and h.challenge_date >= p_date - interval '10 days'
      and h.challenge_date < p_date;
  v_excluded := coalesce(v_excluded, array[]::text[]);

  select h.puzzle_id into v_yesterday_puzzle
    from daily_challenge_history h
    where h.child_id = p_child_id and h.challenge_date = p_date - interval '1 day';
  if v_yesterday_puzzle is not null and not (v_yesterday_puzzle = any(v_excluded)) then
    v_excluded := v_excluded || v_yesterday_puzzle; -- belt-and-suspenders: never repeat yesterday specifically
  end if;

  for v_roll in select generate_series(0, 2) loop
    -- widen tolerance 0 -> 1 -> 2 only if the tighter band came up empty
    select array_agg(dp.puzzle_id) into v_pool
      from daily_challenge_puzzles dp
      where dp.active
        and abs(dp.level - v_target) <= v_roll
        and not (dp.puzzle_id = any(v_excluded));
    exit when v_pool is not null and array_length(v_pool, 1) > 0;
  end loop;

  if v_pool is null or array_length(v_pool, 1) = 0 then
    -- Cooldown has genuinely exhausted the whole pool at every tolerance
    -- (a very small pool + a long play history) -- fall back to "not
    -- served in the last 3 days" rather than serve nothing.
    select array_agg(dp.puzzle_id) into v_pool
      from daily_challenge_puzzles dp
      where dp.active
        and not exists (
          select 1 from daily_challenge_history h
          where h.child_id = p_child_id and h.puzzle_id = dp.puzzle_id
            and h.challenge_date >= p_date - interval '3 days' and h.challenge_date < p_date
        );
  end if;
  if v_pool is null or array_length(v_pool, 1) = 0 then
    select array_agg(dp.puzzle_id) into v_pool from daily_challenge_puzzles dp where dp.active; -- last resort: whole pool
  end if;

  select array_agg(pid) into v_never_seen
    from unnest(v_pool) as pid
    where not exists (
      select 1 from daily_challenge_history h where h.child_id = p_child_id and h.puzzle_id = pid
    );
  if v_never_seen is not null and array_length(v_never_seen, 1) > 0 then
    v_pool := v_never_seen;
  end if;

  -- Weighted random within the pool: closer to target is more likely, but
  -- not certain -- avoids "always the easiest/closest option" sameness
  -- while still being clearly progression-shaped, not merely random.
  select dp.puzzle_id into v_chosen
    from daily_challenge_puzzles dp
    where dp.puzzle_id = any(v_pool)
    order by (case abs(dp.level - v_target) when 0 then 3 when 1 then 1 else 0 end) * random() desc
    limit 1;

  -- ---- Record it (idempotent under concurrency: unique(child_id,
  -- challenge_date) means only one concurrent INSERT can ever win) ----
  insert into daily_challenge_history (child_id, puzzle_id, challenge_date, level_served)
  select p_child_id, v_chosen, p_date, dp.level
    from daily_challenge_puzzles dp where dp.puzzle_id = v_chosen
  on conflict (child_id, challenge_date) do nothing;

  select h.puzzle_id, h.level_served, h.result, h.attempts, dp.theme, dp.mate_in
    into v_existing
    from daily_challenge_history h
    join daily_challenge_puzzles dp on dp.puzzle_id = h.puzzle_id
    where h.child_id = p_child_id and h.challenge_date = p_date;

  return query select v_existing.puzzle_id, v_existing.level_served, v_existing.result, v_existing.attempts, v_existing.theme, v_existing.mate_in;
end;
$$;

grant execute on function public.get_daily_challenge(uuid, date) to authenticated;

-- ============================================================================
-- 4. record_daily_challenge_result: server-authoritative write of the
-- outcome. Idempotent -- once a day's row is 'solved' it stays 'solved'
-- (a client retrying the call, or reporting a stale/duplicate result,
-- cannot double-count or un-solve it); a 'failed' report only increments
-- attempts and leaves the row retryable, matching the existing Puzzle
-- Trainer's own "Try Again" behavior (app/puzzles/page.tsx has no attempt
-- cap today, and this migration does not add one).
--
-- Trust model, stated explicitly: p_solved is client-reported, same as
-- every other chess result in this codebase (finish_online_game_by_result
-- trusts the client's local chess.js checkmate detection the exact same
-- way -- this app has never re-validated chess legality server-side, see
-- that function's own header comment). This is not a new trust boundary;
-- what IS newly server-authoritative here is which puzzle is served, at
-- what difficulty, and that the recorded history cannot be edited or
-- fabricated by the client after the fact.
-- ============================================================================

create or replace function public.record_daily_challenge_result(p_child_id uuid, p_date date, p_solved boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owns boolean;
  v_row record;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select * into v_row from daily_challenge_history
    where child_id = p_child_id and challenge_date = p_date
    for update;
  if v_row.id is null then
    raise exception 'No Daily Challenge exists for this child on this date';
  end if;

  if v_row.result = 'solved' then
    return; -- idempotent no-op: already finalized, cannot be re-triggered or reversed
  end if;

  if p_solved then
    update daily_challenge_history
      set result = 'solved', attempts = attempts + 1, completed_at = now()
      where id = v_row.id;
  else
    update daily_challenge_history
      set result = 'failed', attempts = attempts + 1
      where id = v_row.id;
  end if;
end;
$$;

grant execute on function public.record_daily_challenge_result(uuid, date, boolean) to authenticated;
