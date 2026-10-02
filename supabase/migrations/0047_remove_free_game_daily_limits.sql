-- Removes the legacy Free Play daily game limit introduced in
-- 0019_daily_free_game_limits.sql. Under the CURRENT approved product
-- model, Play vs Computer and Online Play are unlimited for Free users —
-- the daily-limit rule that migration was built for no longer applies. Only
-- Puzzles (3/day, lib/entitlement/dailyLimits.ts) and Train Your Mind
-- (2/category/day, migration 0044) are meant to carry daily limits; this
-- migration touches neither.
--
-- Nothing is dropped: the free_game_usage table, its indexes, its RLS
-- policy, and every RPC's name/argument/return signature are preserved
-- exactly, so start_ai_game(), create_invite_game(), join_online_game() and
-- find_or_create_match() — none of which are redefined here — keep working
-- unchanged for every existing caller (client code needs zero changes).
-- Historical rows already in free_game_usage are left untouched; the table
-- simply stops being written to or enforced against, per "the old tracking
-- system may remain dormant."
--
-- Three functions actually need to change, not two:
--   1. check_free_game_eligibility — the gate create_invite_game(),
--      join_online_game() and find_or_create_match() all call.
--   2. consume_free_game_credit — the gate start_ai_game(), join_online_game()
--      and find_or_create_match() all call to actually spend a credit.
--   3. get_free_game_status — NOT itself a gate, but app/free-play/page.tsx
--      computes its own client-side `exhausted` flag from this function's
--      `ai_remaining` field (`exhausted = aiRemaining === 0`) and disables
--      the difficulty buttons when true. Leaving this function's old
--      2-minus-count arithmetic in place would still show "0 remaining" and
--      block the UI after 2 games even though start_ai_game() itself would
--      now allow the 3rd — so this one has to change too for Free Play to
--      actually be unlimited end-to-end, not just at the RPC layer.

create or replace function public.check_free_game_eligibility(p_child_id uuid, p_game_type text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  -- Free Play (AI) and Online Play are unlimited for every child,
  -- Free or Premium — see this migration's header comment.
  return true;
end;
$$;

create or replace function public.consume_free_game_credit(p_child_id uuid, p_game_type text)
returns table(allowed boolean, remaining int, next_available_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
begin
  -- No credit is consumed or checked any more — every game is allowed.
  -- free_game_usage is intentionally left unwritten (dormant), not dropped.
  return query select true, null::int, null::timestamptz;
end;
$$;

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

  -- Unlimited for everyone now — same "no remaining count, no next
  -- available time" shape this function already used for Premium.
  return query select v_is_premium, null::int, null::timestamptz, null::int, null::timestamptz;
end;
$$;
