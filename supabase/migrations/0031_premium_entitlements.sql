-- Phase 15: Premium monetization foundation.
--
-- The app already had a Premium flag: parents.premium_status ('free' |
-- 'premium'), written ONLY server-side (Stripe webhook + the checkout
-- success page, both via the service-role admin client; direct client
-- writes REVOKEd in 0018). Checkout is a one-time Stripe payment with fixed
-- regional pricing (lib/pricing/regions.ts -- ₹299 for India). What was
-- missing:
--   * a real purchase RECORD (payment id, amount, when, provider);
--   * an EXPIRY -- Premium was implicitly forever. The product is now a
--     one-time ₹299 purchase good for TWO YEARS, no auto-renewal;
--   * webhook idempotency against Stripe's at-least-once delivery.
--
-- This migration is ADDITIVE and idempotent where practical:
--   1. parents.premium_expires_at  -- NULL means "no expiry" (every parent
--      who bought under the old forever model is grandfathered: their row
--      stays premium_status='premium', premium_expires_at NULL, and
--      parent_is_premium() keeps returning true for them forever).
--   2. public.premium_entitlements  -- one row per verified purchase.
--   3. parent_is_premium(parent)    -- the single source of truth for
--      "is this account currently Premium", honouring expiry. Every
--      existing Premium-gated RPC (mark_lesson_complete from 0015; the
--      free-game functions from 0019) is re-created below to call it, so
--      an expired entitlement is enforced server-side everywhere, not just
--      in the UI.
--   4. grant_premium_entitlement() / revoke_premium_entitlement()  --
--      SECURITY DEFINER, service-role only, the ONLY write path for
--      entitlements. Idempotent on the Stripe checkout session id.
--
-- NOT changed: puzzle content, Daily Challenge selection (0025/0030),
-- puzzle_library_solves (0029), learner columns (0027), RLS on any
-- existing table, the pricing model, Stripe product/price configuration.

-- ============================================================================
-- 1. parents.premium_expires_at
-- ============================================================================

alter table public.parents
  add column if not exists premium_expires_at timestamptz;

comment on column public.parents.premium_expires_at is
  'When the current Premium entitlement lapses. NULL = no expiry (legacy '
  'forever purchases are grandfathered). Written only by '
  'grant_premium_entitlement()/revoke_premium_entitlement().';

-- Same lockdown as premium_status (0018): a signed-in parent must not be
-- able to self-extend Premium with a direct PostgREST update.
revoke update (premium_expires_at) on public.parents from authenticated;

-- ============================================================================
-- 2. premium_entitlements -- one row per verified purchase
-- ============================================================================

create table if not exists public.premium_entitlements (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe', 'manual')),
  -- Stripe Checkout Session id -- the idempotency key. Stripe delivers
  -- checkout.session.completed at least once; a UNIQUE constraint plus
  -- ON CONFLICT DO NOTHING in grant_premium_entitlement() means repeated
  -- deliveries (and the belt-and-suspenders success-page call) create the
  -- entitlement exactly once.
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_minor integer,
  currency text,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists premium_entitlements_parent_expires_idx
  on public.premium_entitlements (parent_id, expires_at desc);

alter table public.premium_entitlements enable row level security;

-- A parent may READ their own purchase history (expiry date, receipt-style
-- info for the account screen). No client writes at all -- entitlements are
-- created only by the service-role RPCs below, from verified Stripe data.
drop policy if exists "parent can view own premium entitlements" on public.premium_entitlements;
create policy "parent can view own premium entitlements"
  on public.premium_entitlements for select
  using (
    parent_id in (
      select p.id from public.parents p where p.auth_user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.premium_entitlements from authenticated, anon;

-- updated_at maintenance
create or replace function public.touch_premium_entitlements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists premium_entitlements_touch_updated_at on public.premium_entitlements;
create trigger premium_entitlements_touch_updated_at
  before update on public.premium_entitlements
  for each row execute procedure public.touch_premium_entitlements_updated_at();

-- ============================================================================
-- 3. parent_is_premium(parent) -- single source of truth, expiry-aware
-- ============================================================================

create or replace function public.parent_is_premium(p_parent_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (
      select pr.premium_status = 'premium'
        and (pr.premium_expires_at is null or pr.premium_expires_at > now())
      from public.parents pr
      where pr.id = p_parent_id
    ),
    false
  );
$$;

-- Internal helper for the SECURITY DEFINER functions below -- not granted to
-- authenticated (the app computes the same thing in TS from the parents row
-- it already reads; see lib/premium/entitlement.ts). service_role (trusted
-- server code + tests) may call it directly.
revoke all on function public.parent_is_premium(uuid) from public, anon, authenticated;
grant execute on function public.parent_is_premium(uuid) to service_role;

-- ============================================================================
-- 4. grant / revoke entitlement -- the ONLY entitlement write path
-- ============================================================================

-- Called by app/api/stripe/webhook and app/upgrade/success (both service
-- role, both after independently verifying payment with Stripe). Idempotent:
-- the same checkout session can be replayed any number of times and the
-- parent ends up with exactly one entitlement row and one 2-year expiry.
create or replace function public.grant_premium_entitlement(
  p_parent_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text default null,
  p_amount_minor integer default null,
  p_currency text default null,
  p_provider text default 'stripe',
  p_duration interval default interval '2 years'
)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_expires_at timestamptz := now() + p_duration;
  v_max_expiry timestamptz;
begin
  if p_parent_id is null then
    raise exception 'grant_premium_entitlement: parent_id is required';
  end if;

  insert into public.premium_entitlements
    (parent_id, provider, stripe_checkout_session_id, stripe_payment_intent_id,
     amount_minor, currency, purchased_at, expires_at, status)
  values
    (p_parent_id, coalesce(p_provider, 'stripe'), p_checkout_session_id, p_payment_intent_id,
     p_amount_minor, p_currency, now(), v_expires_at, 'active')
  on conflict (stripe_checkout_session_id) do nothing;

  -- The account's effective expiry is the furthest-out ACTIVE entitlement.
  -- (Stacking a second purchase while still active therefore extends rather
  -- than overwrites.) Only upgrade the parent when that expiry is real and
  -- still in the future -- so a replayed checkout.session.completed that
  -- arrives after a refund cannot silently re-grant Premium.
  select max(e.expires_at) into v_max_expiry
  from public.premium_entitlements e
  where e.parent_id = p_parent_id and e.status = 'active';

  if v_max_expiry is not null and v_max_expiry > now() then
    update public.parents
    set premium_status = 'premium',
        premium_expires_at = v_max_expiry
    where id = p_parent_id;
  end if;

  return v_max_expiry;
end;
$$;

revoke all on function public.grant_premium_entitlement(uuid, text, text, integer, text, text, interval)
  from public, anon, authenticated;
grant execute on function public.grant_premium_entitlement(uuid, text, text, integer, text, text, interval)
  to service_role;

-- Refund handling (Stripe charge.refunded). Marks the matching entitlement
-- refunded and re-derives the account's Premium state from whatever active
-- entitlements remain.
create or replace function public.revoke_premium_entitlement(p_payment_intent_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_parent_id uuid;
  v_max_expiry timestamptz;
  v_has_active boolean;
begin
  update public.premium_entitlements
  set status = 'refunded'
  where stripe_payment_intent_id = p_payment_intent_id
  returning parent_id into v_parent_id;

  if v_parent_id is null then
    return; -- nothing matched; no-op
  end if;

  select max(e.expires_at), bool_or(e.expires_at > now())
  into v_max_expiry, v_has_active
  from public.premium_entitlements e
  where e.parent_id = v_parent_id and e.status = 'active';

  update public.parents
  set premium_status = case when coalesce(v_has_active, false) then 'premium' else 'free' end,
      premium_expires_at = v_max_expiry
  where id = v_parent_id;
end;
$$;

revoke all on function public.revoke_premium_entitlement(text) from public, anon, authenticated;
grant execute on function public.revoke_premium_entitlement(text) to service_role;

-- Re-derives parents.premium_status / premium_expires_at from the parent's
-- entitlement rows. Used by the "Refresh Premium" action on the account
-- screen to recover a stale cache flag (e.g. a webhook that updated the
-- entitlement row but not the parents row). Legacy-safe: a parent with NO
-- entitlement rows at all is left completely untouched, so a grandfathered
-- "forever" grant (premium_status='premium', premium_expires_at NULL, no
-- rows) is never downgraded.
create or replace function public.sync_premium_from_entitlements(p_parent_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_row_count int;
  v_max_expiry timestamptz;
  v_has_active boolean;
begin
  select count(*) into v_row_count
  from public.premium_entitlements where parent_id = p_parent_id;

  if v_row_count = 0 then
    return (select premium_expires_at from public.parents where id = p_parent_id);
  end if;

  select max(e.expires_at) filter (where e.status = 'active'),
         bool_or(e.status = 'active' and e.expires_at > now())
  into v_max_expiry, v_has_active
  from public.premium_entitlements e
  where e.parent_id = p_parent_id;

  update public.parents
  set premium_status = case when coalesce(v_has_active, false) then 'premium' else 'free' end,
      premium_expires_at = v_max_expiry
  where id = p_parent_id;

  return v_max_expiry;
end;
$$;

revoke all on function public.sync_premium_from_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.sync_premium_from_entitlements(uuid) to service_role;

-- ============================================================================
-- 5. Re-create the existing Premium-gated RPCs to use parent_is_premium()
--    (bodies otherwise identical to 0015 / 0019).
-- ============================================================================

-- mark_lesson_complete -- body identical to 0015_zone_based_free_lessons.sql
-- except the Premium check.
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
  v_is_premium boolean;
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
    select public.parent_is_premium(p.id) into v_is_premium
    from children c
    join parents p on p.id = c.parent_id
    where c.id = p_child_id;

    if not coalesce(v_is_premium, false) then
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

-- check_free_game_eligibility -- body identical to 0019 except the Premium check.
create or replace function public.check_free_game_eligibility(p_child_id uuid, p_game_type text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_premium boolean;
  v_count int;
begin
  select public.parent_is_premium(pr.id) into v_is_premium
  from children c join parents pr on pr.id = c.parent_id
  where c.id = p_child_id;

  if coalesce(v_is_premium, false) then
    return true;
  end if;

  select count(*) into v_count from free_game_usage
  where child_id = p_child_id and game_type = p_game_type
    and started_at > clock_timestamp() - interval '24 hours';

  return v_count < 2;
end;
$$;

-- consume_free_game_credit -- body identical to 0019 except the Premium check.
create or replace function public.consume_free_game_credit(p_child_id uuid, p_game_type text)
returns table(allowed boolean, remaining int, next_available_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_premium boolean;
  v_count int;
  v_oldest timestamptz;
begin
  select public.parent_is_premium(pr.id) into v_is_premium
  from children c join parents pr on pr.id = c.parent_id
  where c.id = p_child_id;

  if coalesce(v_is_premium, false) then
    return query select true, null::int, null::timestamptz;
    return;
  end if;

  select count(*), min(started_at) into v_count, v_oldest
  from free_game_usage
  where child_id = p_child_id and game_type = p_game_type
    and started_at > clock_timestamp() - interval '24 hours';

  if v_count >= 2 then
    return query select false, 0, v_oldest + interval '24 hours';
    return;
  end if;

  insert into free_game_usage (child_id, game_type) values (p_child_id, p_game_type);
  return query select true, (1 - v_count), null::timestamptz;
end;
$$;

-- get_free_game_status -- body identical to 0019 except the Premium check.
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
  v_ai_count int; v_ai_oldest timestamptz;
  v_mp_count int; v_mp_oldest timestamptz;
begin
  select exists (
    select 1 from children c join parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) into v_owns;
  if not v_owns then
    raise exception 'Not authorized for this child';
  end if;

  select public.parent_is_premium(pr.id) into v_is_premium
  from children c join parents pr on pr.id = c.parent_id
  where c.id = p_child_id;

  if coalesce(v_is_premium, false) then
    return query select true, null::int, null::timestamptz, null::int, null::timestamptz;
    return;
  end if;

  select count(*), min(started_at) into v_ai_count, v_ai_oldest
  from free_game_usage where child_id = p_child_id and game_type = 'ai'
    and started_at > clock_timestamp() - interval '24 hours';
  select count(*), min(started_at) into v_mp_count, v_mp_oldest
  from free_game_usage where child_id = p_child_id and game_type = 'multiplayer'
    and started_at > clock_timestamp() - interval '24 hours';

  return query select
    false,
    greatest(0, 2 - v_ai_count),
    case when v_ai_count >= 2 then v_ai_oldest + interval '24 hours' else null end,
    greatest(0, 2 - v_mp_count),
    case when v_mp_count >= 2 then v_mp_oldest + interval '24 hours' else null end;
end;
$$;

grant execute on function public.get_free_game_status(uuid) to authenticated;
