-- Raises Train Your Mind's free daily per-module limit from 2 to 3
-- activities per calendar day. Replaces record_train_your_mind_use() with
-- the same name/signature/table (0044_train_your_mind_daily_usage.sql) —
-- only the hardcoded free-cap literal changes, everywhere it appeared:
-- the WHERE clause that actually gates the increment, and both `remaining`
-- calculations. Must stay synchronized with
-- lib/entitlement/dailyLimits.ts's DAILY_LIMITS.trainYourMindPerCategory,
-- exactly as 0044's own header comment already requires.
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

  -- The free limit (3) mirrors lib/entitlement/dailyLimits.ts's
  -- DAILY_LIMITS.trainYourMindPerCategory — keep both in sync if either
  -- changes.
  insert into public.child_train_your_mind_activity (child_id, activity_date, module_id, activities_completed)
  values (p_child_id, p_activity_date, p_module_id, 1)
  on conflict (child_id, activity_date, module_id) do update
    set activities_completed = child_train_your_mind_activity.activities_completed + 1,
        updated_at = now()
    where v_is_premium or child_train_your_mind_activity.activities_completed < 3
  returning child_train_your_mind_activity.activities_completed into v_count;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Free account already at 3 — the write was refused, not applied.
    -- Fetch the real (unchanged) count rather than guessing at one.
    select c.activities_completed into v_count
    from public.child_train_your_mind_activity c
    where c.child_id = p_child_id and c.activity_date = p_activity_date and c.module_id = p_module_id;

    return query select false, v_count, greatest(0, 3 - v_count), v_is_premium;
  else
    return query select
      true,
      v_count,
      case when v_is_premium then null else greatest(0, 3 - v_count) end,
      v_is_premium;
  end if;
end;
$$;
