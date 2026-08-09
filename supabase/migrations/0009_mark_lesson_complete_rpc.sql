-- Closes a real paywall bypass: markLessonComplete() previously did a plain
-- client-side upsert into child_lesson_progress + update on children.
-- RLS only checks "does this child belong to this parent" — it has no
-- concept of FREE_DAY_LIMIT or premium_status, so nothing stopped a child's
-- own (legitimate, RLS-valid) Supabase session from calling
-- markLessonComplete(supabase, childId, 25) directly from devtools and
-- marking any locked day complete without paying. The UI never exposes
-- that path (locked days render a preview/upsell, not the full lesson
-- flow), but the write itself was never actually enforced server-side.
--
-- This function is the new single write path — same SECURITY DEFINER
-- pattern as find_or_create_match/apply_match_rating in 0008_matchmaking.sql.
create or replace function public.mark_lesson_complete(p_child_id uuid, p_day_number int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  -- Keep in sync with FREE_DAY_LIMIT in content/lessons.ts. A client-supplied
  -- limit can't be trusted here, so this is a second, server-side copy —
  -- the same manual-sync tradeoff already accepted for the brand name in
  -- capacitor.config.ts / android strings.xml.
  v_free_day_limit constant int := 3;
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

  if p_day_number > v_free_day_limit then
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

  -- Never move current_day backwards (same guard the old client-side code used).
  update children
  set current_day = p_day_number + 1
  where id = p_child_id and current_day <= p_day_number;
end;
$$;

grant execute on function public.mark_lesson_complete(uuid, int) to authenticated;
