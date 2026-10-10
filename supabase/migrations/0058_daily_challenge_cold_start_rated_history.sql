-- APPLIED to production on 2026-10-10 and verified (definition md5 f7fe95beb9fa4ea6c040cf444835d219, body md5 63a632221fe0c9a5c9ed740d0ab4bd4c). The executable SQL below (create or replace function ... to the final grant) was not changed after it was applied.
--
-- Run this file AS A WHOLE (select everything, then Run). Two statements: CREATE OR REPLACE FUNCTION (its body sits inside one dollar-quoted
-- block that opens and closes inside that statement), then a GRANT. Running only part of it fails with 42601.
--
-- Problem (found while reviewing the rating policy, 0056): the first Daily Challenge of a child with no Daily Challenge history adds one
-- difficulty step when children.rating >= 600 (0025, kept in 0030). On the old 400 default that threshold meant "this child has GAINED 200
-- points, so has won rated games". Once 0056 makes 1200 the default it is true for every child, so every new player's first Daily Challenge
-- would be one step harder (capped by their experience band) for no reason except the starting number.
--
-- Fix: the rating nudge now rewards DEMONSTRATED strength, measured from rated-game history instead of the raw number. It is given only when
-- the child has at least one rated game (a rating_history row) AND their rating is at least 200 above the rating they had at their FIRST rated
-- game. That is exactly what ">= 600 from a 400 start" always meant, and it stays correct whatever the starting rating is:
--     legacy child:  first rated game started at 400 -> nudge once rating >= 600     (unchanged)
--     new child:     first rated game started at 1200 -> nudge once rating >= 1400
--     any child with no rated game (a new player at 1200, or a child moved to 1200 by 0057): no nudge, because nothing was demonstrated
--
-- Deliberately unchanged (the rest of the function is byte-for-byte the 0030 body):
--   * experience-band start and caps: new -> 1 (cap 2), knows_basics -> 2 (cap 3), plays_regularly -> 3 (cap 4), NULL/unknown -> new;
--   * the Chess Mind engagement nudge (>= 20 pattern/calculation solves) and the final least(target, cap);
--   * the WARM-start rolling-window logic (any child with Daily Challenge history never reaches the changed branch);
--   * ownership check, same-day idempotency, 10-day exclusion, never-repeat-yesterday, tolerance widening, never-seen preference, weighted
--     random, the history insert, the return shape, SECURITY DEFINER and search_path, and the grant.
--
-- Independent of 0056/0057: it is safe to apply before, with, or after them. Without 0056 it changes nothing for a child on the 400 default
-- who has not played (they were never nudged). It also removes the Daily Challenge side effect of 0057.
--
-- BEFORE APPLYING (read-only): this replaces the function as 0030 defines it, and the deployed function has NOT been read for this change.
-- Confirm production still has the 0030 version: run this in the SQL editor
--     select md5(regexp_replace(pg_get_functiondef('public.get_daily_challenge(uuid,date)'::regprocedure), '\s+', ' ', 'g'));
-- and compare it with the value printed by   node scripts/test-daily-challenge-rated-history.js --print-md5   (that is the same expression
-- run on the 0030 function in an isolated PostgreSQL). A different PostgreSQL version can format the function header slightly differently,
-- so a mismatch is a reason to read the deployed definition and compare it with 0030, not proof that it was changed.
--
-- ROLLBACK: re-run the function from 0030_learner_aware_daily_challenge.sql. There is no schema or data change to undo.

create or replace function public.get_daily_challenge(p_child_id uuid, p_date date default current_date)
returns table(out_puzzle_id text, out_level_served int, out_result text, out_attempts int, out_theme text, out_mate_in int)
language plpgsql
security definer set search_path = public
as $function$
declare
  v_owns boolean;
  v_existing record;
  v_rating int;
  v_rated_start int;
  v_chess_mind_solved int;
  v_experience text;
  v_cold_cap int;
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
    -- Cold start: no Daily Challenge history yet, so there is no
    -- level_served anchor and no resolved-attempt window to lean on. The
    -- child's stated experience_level (Phase 13 / migration 0027) sets the
    -- starting band; the rated-game and Chess Mind signals stay as weak
    -- one-time nudges WITHIN that band. experience_level is consulted ONLY
    -- here -- once a real resolved history exists the rolling-window logic
    -- in the else branch takes over completely. NULL experience_level
    -- (every child created before 0027, and the app's own default) is
    -- treated as 'new', the safest floor.
    select c.rating, coalesce(c.experience_level, 'new')
      into v_rating, v_experience
      from children c where c.id = p_child_id;
    -- The rating the child had when their FIRST rated game began (null if they have never completed one).
    select h.old_rating into v_rated_start
      from rating_history h
      where h.child_id = p_child_id
      order by h.created_at asc, h.id asc
      limit 1;
    select coalesce(sum(s.total_solved), 0) into v_chess_mind_solved
      from child_chess_mind_stats s
      where s.child_id = p_child_id and s.module_id in ('pattern', 'calculation');

    if v_experience = 'plays_regularly' then
      v_target := 3;   -- plays regularly -> start at "intermediate"
      v_cold_cap := 4;
    elsif v_experience = 'knows_basics' then
      v_target := 2;   -- knows the basics -> start at "developing"
      v_cold_cap := 3;
    else
      v_target := 1;   -- 'new' (and NULL / any unexpected value) -> start at the floor
      v_cold_cap := 2;
    end if;

    -- Existing weak signals still apply, but only ever nudge UP and never
    -- past the experience band's early cap. The rating nudge needs
    -- DEMONSTRATED strength: a rated game on record and a rating at least
    -- 200 above where the child began. The starting rating alone is never
    -- evidence of anything (a new player at 1200 has shown nothing yet).
    if v_rated_start is not null and coalesce(v_rating, v_rated_start) >= v_rated_start + 200 then
      v_target := v_target + 1;
    end if;
    if v_chess_mind_solved >= 20 then
      v_target := v_target + 1;
    end if;
    v_target := least(v_target, v_cold_cap);
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
$function$;

grant execute on function public.get_daily_challenge(uuid, date) to authenticated;
