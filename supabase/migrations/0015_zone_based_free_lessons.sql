-- Phase 14: replaces the flat "days 1-3 free" server-side check in
-- mark_lesson_complete (0009_mark_lesson_complete_rpc.sql) with a per-zone
-- rule: Pawn Village (days 1-5) gets 3 free lessons, every other zone
-- (5-day blocks starting at day 6, 11, 16, 21, 26) gets 2. Same
-- CREATE OR REPLACE pattern as the original — same function name/
-- signature, same SECURITY DEFINER + ownership check, same single write
-- path. Nothing about the security model changes, only which days count
-- as free.
--
-- This mirrors content/kingdomZones.ts's KINGDOM_ZONES.freeLessonCount
-- exactly (zone index = floor((day-1)/5), zone start = index*5+1, free
-- count = 3 for index 0 else 2) — a client-supplied "this day is free"
-- claim still can't be trusted here, so this is the same manual-sync
-- server-side copy already accepted for the original v_free_day_limit.
create or replace function public.mark_lesson_complete(p_child_id uuid, p_day_number int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_zone_index constant int := floor((p_day_number - 1) / 5);
  v_zone_day_start constant int := v_zone_index * 5 + 1;
  v_zone_free_count constant int := case when v_zone_index = 0 then 3 else 2 end;
  v_is_free constant boolean := (p_day_number - v_zone_day_start) < v_zone_free_count;
  v_premium_status text;
  v_owns boolean;
begin
  select exists (
    select 1 from children c
    join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;

  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  if not v_is_free then
    select p.premium_status into v_premium_status
    from children c
    join parents p on p.id = c.parent_id
    where c.id = p_child_id;

    if v_premium_status is distinct from 'premium' then
      raise exception 'Premium required to complete day %', p_day_number;
    end if;
  end if;

  insert into child_lesson_progress (child_id, day_number, status, completed_at)
  values (p_child_id, p_day_number, 'completed', now())
  on conflict (child_id, day_number) do update
    set status = 'completed', completed_at = now();

  -- Never move current_day backwards (same guard as before).
  update children
  set current_day = p_day_number + 1
  where id = p_child_id and current_day <= p_day_number;
end;
$$;

grant execute on function public.mark_lesson_complete(uuid, int) to authenticated;
