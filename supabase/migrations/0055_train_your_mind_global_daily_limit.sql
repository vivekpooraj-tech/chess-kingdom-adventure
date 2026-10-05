-- Train Your Chess Mind — server-enforced, idempotent free daily limit:
-- 3 completed exercises PER CATEGORY, per child, per calendar day.
--
-- The eight categories are counted INDEPENDENTLY — Pattern, Visualization, Calculation,
-- Memory, Spatial, Mathematics, Reaction and Tactical Thinking each get their own 3 a day
-- (so a free child can do 3 + 3 + 3 + ... across the categories, but never a 4th in any one).
--
-- (The file keeps its original name from before the rule was clarified; it has not been
-- applied anywhere. The old per-category RPC of 0044/0050 stays untouched.)
--
-- WHY A NEW LEDGER: child_train_your_mind_activity (0044) already counts per (child, day,
-- module), but it has no idempotency key (a retried request counts twice), is only ever
-- called AFTER an exercise was served (the server never refused to serve one), and cannot
-- cover Tactical Thinking (an Academy course served by another route). One row per
-- completion gives all of that: duplicate-proof, readable by the serve routes, and the same
-- rule for every category. 0044's table and RPC are left exactly as they are; the app
-- simply stops calling record_train_your_mind_use().
--
-- WHAT COUNTS: a COMPLETION is an exercise the learner has answered (right or wrong —
-- otherwise a learner could answer wrong forever and never use a slot). Opening a page,
-- loading or prefetching an exercise, or retrying the same exercise does not consume a
-- slot. Each completion carries a client-generated key; the same key sent twice (retry,
-- double tap, duplicate request) is recorded once.
--
-- ENFORCEMENT: server-side, in two places that share one rule —
--   * record_train_your_mind_completion() refuses the 4th free completion IN THAT CATEGORY;
--   * get_train_your_mind_usage() lets /api/chess-mind/train and /api/academy/lesson
--     (Tactical Thinking) refuse to even SERVE a 4th exercise in that category.
-- Nothing here reads browser state. Premium (parent_is_premium(), the existing entitlement
-- function — not re-derived) is never limited.
--
-- DAY BOUNDARY: unchanged from the rest of the app — the caller's LOCAL calendar date
-- (lib/supabase/queries.ts localDateString(), passed as p_activity_date, exactly as 0044
-- and get_daily_challenge do). To stop the client-supplied date being used to open extra
-- buckets, the date is clamped: never earlier than the latest day this child already used,
-- never earlier than UTC-yesterday, never later than UTC-tomorrow (the real-world spread
-- of timezones). Alternating dates therefore cannot mint extra free slots.
--
-- Purely additive. Does not touch 0044/0050/0053/0054 objects, pricing or entitlement.
--
-- ROLLBACK (not run automatically):
--   drop function if exists public.record_train_your_mind_completion(uuid, text, text, text, date);
--   drop function if exists public.get_train_your_mind_usage(uuid, date);
--   drop function if exists public.tym_effective_date(uuid, date);
--   drop table if exists public.child_train_your_mind_completions;

create table public.child_train_your_mind_completions (
  child_id uuid not null references public.children(id) on delete cascade,
  completion_key text not null,
  activity_date date not null,
  module_id text not null,
  exercise_id text,
  created_at timestamptz not null default now(),
  primary key (child_id, completion_key),
  constraint tym_completion_key_len check (char_length(completion_key) between 8 and 80),
  constraint tym_completion_exercise_len check (exercise_id is null or char_length(exercise_id) <= 200),
  constraint tym_completion_module check (
    module_id in ('pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction', 'tactical')
  )
);

create index tym_completions_day_idx
  on public.child_train_your_mind_completions (child_id, activity_date, module_id);

alter table public.child_train_your_mind_completions enable row level security;

create policy "parent can view own child's train your mind completions"
  on public.child_train_your_mind_completions for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- Writes only through the RPC below; no table privilege beyond SELECT.
revoke all on public.child_train_your_mind_completions from public, anon, authenticated;
grant select on public.child_train_your_mind_completions to authenticated;

-- ----------------------------------------------------------------------------
-- tym_effective_date(child, requested date) — the clamped day bucket (see header).
-- ----------------------------------------------------------------------------
create or replace function public.tym_effective_date(p_child_id uuid, p_activity_date date)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select least(
    greatest(
      coalesce(p_activity_date, (now() at time zone 'utc')::date),
      (now() at time zone 'utc')::date - 1,
      coalesce((select max(c.activity_date) from public.child_train_your_mind_completions c where c.child_id = p_child_id), date '0001-01-01')
    ),
    (now() at time zone 'utc')::date + 1
  );
$$;

revoke all on function public.tym_effective_date(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_train_your_mind_usage(child, date) — read-only; one row per category, so the serve
-- routes read their own category and the hub reads all eight in one call. The free limit
-- (3) mirrors lib/entitlement/dailyLimits.ts DAILY_LIMITS.trainYourMindPerCategory —
-- keep both in sync if either changes.
-- ----------------------------------------------------------------------------
create or replace function public.get_train_your_mind_usage(
  p_child_id uuid,
  p_activity_date date default current_date
)
returns table(module_id text, used_today int, remaining int, is_premium boolean, daily_limit int)
language plpgsql
stable
security definer set search_path = public, pg_temp
as $$
declare
  v_parent_id uuid;
  v_is_premium boolean;
  v_date date;
begin
  select c.parent_id into v_parent_id
  from public.children c
  join public.parents p on p.id = c.parent_id
  where c.id = p_child_id and p.auth_user_id = auth.uid();

  if v_parent_id is null then
    raise exception 'not authorized for this child';
  end if;

  v_is_premium := public.parent_is_premium(v_parent_id);
  v_date := public.tym_effective_date(p_child_id, p_activity_date);

  return query
  select m.module_id,
         coalesce(u.n, 0)::int,
         case when v_is_premium then null else greatest(0, 3 - coalesce(u.n, 0))::int end,
         v_is_premium,
         case when v_is_premium then null else 3 end
  from unnest(array['pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction', 'tactical']) as m(module_id)
  left join (
    select c.module_id, count(*) as n
    from public.child_train_your_mind_completions c
    where c.child_id = p_child_id and c.activity_date = v_date
    group by c.module_id
  ) u on u.module_id = m.module_id;
end;
$$;

revoke all on function public.get_train_your_mind_usage(uuid, date) from public, anon;
grant execute on function public.get_train_your_mind_usage(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- record_train_your_mind_completion(child, module, key, exercise, date)
--
--   1. Authenticate from auth.uid(); verify parent -> child ownership.
--   2. Validate module and key.
--   3. Serialise per child with a transaction advisory lock, so two devices completing
--      at the same instant cannot both squeeze under the cap.
--   4. Same key already recorded -> duplicate: nothing is consumed, current state returned.
--   5. Premium: record and allow. Free: refuse when 3 are already recorded TODAY IN THIS
--      CATEGORY.
-- ----------------------------------------------------------------------------
create or replace function public.record_train_your_mind_completion(
  p_child_id uuid,
  p_module_id text,
  p_completion_key text,
  p_exercise_id text default null,
  p_activity_date date default current_date
)
returns table(allowed boolean, duplicate boolean, used_today int, remaining int, is_premium boolean)
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_parent_id uuid;
  v_is_premium boolean;
  v_date date;
  v_used int;
begin
  select c.parent_id into v_parent_id
  from public.children c
  join public.parents p on p.id = c.parent_id
  where c.id = p_child_id and p.auth_user_id = auth.uid();

  if v_parent_id is null then
    raise exception 'not authorized for this child';
  end if;

  if p_module_id is null
     or p_module_id not in ('pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction', 'tactical') then
    raise exception 'invalid module';
  end if;

  if p_completion_key is null or char_length(p_completion_key) not between 8 and 80
     or (p_exercise_id is not null and char_length(p_exercise_id) > 200) then
    raise exception 'invalid completion';
  end if;

  v_is_premium := public.parent_is_premium(v_parent_id);

  -- One lock per child, held to the end of the transaction. Taken before the date is
  -- resolved so the "latest day used" it reads cannot change underneath us.
  perform pg_advisory_xact_lock(hashtextextended('tym:' || p_child_id::text, 0));

  v_date := public.tym_effective_date(p_child_id, p_activity_date);

  select count(*)::int into v_used
  from public.child_train_your_mind_completions c
  where c.child_id = p_child_id and c.activity_date = v_date and c.module_id = p_module_id;

  if exists (
    select 1 from public.child_train_your_mind_completions c
    where c.child_id = p_child_id and c.completion_key = p_completion_key
  ) then
    return query select true, true, v_used,
      case when v_is_premium then null else greatest(0, 3 - v_used) end, v_is_premium;
    return;
  end if;

  if not v_is_premium and v_used >= 3 then
    return query select false, false, v_used, 0, false;
    return;
  end if;

  insert into public.child_train_your_mind_completions (child_id, completion_key, activity_date, module_id, exercise_id)
  values (p_child_id, p_completion_key, v_date, p_module_id, p_exercise_id);

  v_used := v_used + 1;
  return query select true, false, v_used,
    case when v_is_premium then null else greatest(0, 3 - v_used) end, v_is_premium;
end;
$$;

revoke all on function public.record_train_your_mind_completion(uuid, text, text, text, date) from public, anon;
grant execute on function public.record_train_your_mind_completion(uuid, text, text, text, date) to authenticated;
