-- Phase 5, Objective A — Train Your Mind daily usage, server-authoritative.
--
-- Free: 2 completed activities per category (module_id) per calendar day.
-- Premium: unlimited. The `2` below MUST stay synchronized with
-- lib/entitlement/dailyLimits.ts's DAILY_LIMITS.trainYourMindPerCategory — if
-- that TS constant ever changes, this migration's hardcoded limit has to
-- change with it. This duplication is deliberate and accepted, the same way
-- 0019_daily_free_game_limits.sql already hardcodes its own free-game cap
-- rather than reading it from anywhere generic.
--
-- Replaces the Phase 4 stopgap (lib/trainYourMind/dailyUsage.ts,
-- browser localStorage) with a real server-enforced limit. localStorage was
-- never authoritative and is not migrated — a child's count simply starts
-- fresh, server-side, from zero.
--
-- WHY THE TABLE IS NOT CLIENT-WRITABLE (unlike child_chess_mind_activity,
-- screen_time_usage, puzzle_preview_usage, which all use `for all`): those
-- tables back a display counter or a soft/best-effort feature, never a real
-- entitlement boundary. This one does. A client-writable row would let a
-- free account's own browser set activities_completed to whatever it wants,
-- which defeats the entire point of moving off localStorage. The only
-- existing precedent in this codebase for a real usage cap,
-- free_game_usage (0019), makes the same choice: revoke all direct writes,
-- route every write through a SECURITY DEFINER RPC. This migration follows
-- that precedent.
--
-- PREMIUM SOURCE OF TRUTH: this migration adds no new entitlement table,
-- column, or flag. record_train_your_mind_use() below calls the existing
-- parent_is_premium(uuid) (0031_premium_entitlements.sql) — the same
-- expiry-aware function that is the SQL-side mirror of
-- lib/premium/entitlement.ts's resolvePremiumState(). Premium status is
-- never re-derived independently here.

create table public.child_train_your_mind_activity (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  activity_date date not null,
  module_id text not null,
  activities_completed int not null default 0,
  updated_at timestamptz not null default now(),
  unique (child_id, activity_date, module_id)
);

alter table public.child_train_your_mind_activity enable row level security;

create policy "parent can view own child's train your mind usage"
  on public.child_train_your_mind_activity for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- No insert/update/delete policy for authenticated — every write goes
-- through record_train_your_mind_use() below, which re-verifies ownership
-- and re-derives Premium status itself before touching a row. This REVOKE
-- is the actual security boundary; a direct authenticated INSERT/UPDATE/
-- DELETE against this table must fail regardless of any policy.
revoke insert, update, delete on public.child_train_your_mind_activity from authenticated;

-- ----------------------------------------------------------------------------
-- record_train_your_mind_use(child, module, date) — the one write path.
--
--   1. Authenticate: auth.uid() is the Supabase-verified caller identity,
--      never a client-supplied value.
--   2. Verify parent -> child ownership in the same lookup; raise if the
--      caller does not own p_child_id.
--   3. Resolve Premium via the existing parent_is_premium() (0031) — not
--      re-derived, not a second Premium source of truth.
--   4. Free: increment ONLY if activities_completed < 2. Premium: increment
--      unconditionally. Enforced by the UPDATE's own WHERE clause, inside
--      the same statement as the insert/increment — not a separate
--      check-then-act, which would race under two concurrent calls.
--   5. Return the authoritative post-call state: allowed, used_today,
--      remaining (null for Premium == unlimited, matching
--      lib/entitlement/dailyLimits.ts's remainingToday() convention),
--      is_premium.
--
-- p_activity_date: the caller's LOCAL calendar date (lib/supabase/queries.ts's
-- localDateString(), the same convention every other daily-reset feature in
-- this app already uses — screen_time_usage, puzzle_preview_usage,
-- child_chess_mind_activity, get_daily_challenge's p_date). Postgres/Supabase
-- current_date is UTC and is NOT the child's local day, so it is only a
-- defensive fallback here for a caller that omits the parameter — the app
-- itself must always pass it explicitly, exactly as it already does for
-- get_daily_challenge.
-- ----------------------------------------------------------------------------
create or replace function public.record_train_your_mind_use(
  p_child_id uuid,
  p_module_id text,
  p_activity_date date default current_date
)
returns table(allowed boolean, used_today int, remaining int, is_premium boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_parent_id uuid;
  v_is_premium boolean;
  v_count int;
  v_rows int;
begin
  select c.parent_id into v_parent_id
  from public.children c
  join public.parents p on p.id = c.parent_id
  where c.id = p_child_id and p.auth_user_id = auth.uid();

  if v_parent_id is null then
    raise exception 'not authorized for this child';
  end if;

  v_is_premium := public.parent_is_premium(v_parent_id);

  -- The free limit (2) mirrors lib/entitlement/dailyLimits.ts's
  -- DAILY_LIMITS.trainYourMindPerCategory — keep both in sync if either
  -- changes.
  insert into public.child_train_your_mind_activity (child_id, activity_date, module_id, activities_completed)
  values (p_child_id, p_activity_date, p_module_id, 1)
  on conflict (child_id, activity_date, module_id) do update
    set activities_completed = child_train_your_mind_activity.activities_completed + 1,
        updated_at = now()
    where v_is_premium or child_train_your_mind_activity.activities_completed < 2
  returning child_train_your_mind_activity.activities_completed into v_count;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Free account already at 2 — the write was refused, not applied.
    -- Fetch the real (unchanged) count rather than guessing at one.
    select c.activities_completed into v_count
    from public.child_train_your_mind_activity c
    where c.child_id = p_child_id and c.activity_date = p_activity_date and c.module_id = p_module_id;

    return query select false, v_count, greatest(0, 2 - v_count), v_is_premium;
  else
    return query select
      true,
      v_count,
      case when v_is_premium then null else greatest(0, 2 - v_count) end,
      v_is_premium;
  end if;
end;
$$;

revoke all on function public.record_train_your_mind_use(uuid, text, date) from public, anon;
grant execute on function public.record_train_your_mind_use(uuid, text, date) to authenticated;
