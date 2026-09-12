-- Chess School V2 — durable progress, and the hook for its own entitlement.
--
-- NUMBERING. The build brief asked for 0032. That number is taken
-- (0032_grant_child_experience_update.sql) and so is everything up to 0042,
-- so this is 0043. Renumbering an applied migration would be far worse than
-- deviating from the brief on a filename.
--
-- ADDITIVE AND IDEMPOTENT. Nothing existing is altered: not children, not
-- child_lesson_progress (the Kingdom Journey's storage, which Chess School V2
-- never reads or writes), not parents, not premium_entitlements, not any
-- existing policy. Two new tables and four new functions, all guarded with
-- `if not exists` / `create or replace`.
--
-- WHY A SINGLE ROW PER CHILD RATHER THAN AN EVENT LOG. Every screen in the
-- course asks the same question — where is this child, what have they earned —
-- and an event log makes that a fold over history on every page load. The
-- arrays here ARE the answer. Nothing in the product needs to know the order
-- sessions were completed in, only which ones were.
--
-- WHY THE ARRAYS ARE UNCONSTRAINED TEXT/INT. The session numbers, skill tags
-- and unlock ids are defined in application content (content/school/*), not in
-- the database, exactly as puzzle_id in puzzle_library_solves (0029) and
-- module_id in child_chess_mind_stats (0011) already are. The app drops
-- anything it does not recognise on read (lib/school/v2/progress.ts
-- normalizeProgress), so a stale row can never inflate a child's progress or
-- award a milestone that no longer exists.

-- --------------------------------------------------------------------------
-- 1. child_school_progress -- one row per child, the whole Chess School record
-- --------------------------------------------------------------------------
create table if not exists public.child_school_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,

  -- Session numbers (1-30) the child has finished. Unordered set; the app
  -- sorts and de-duplicates on read.
  completed_sessions int[] not null default '{}',

  -- SchoolSkillTag values earned. A claim the app is willing to make to a
  -- parent in plain English ("your child can now capture with pawns"), so it
  -- is only ever written when the session that teaches it is completed.
  skill_tags text[] not null default '{}',

  -- Share-card ids (fork_master, first_checkmate, graduate, ...).
  unlocks text[] not null default '{}',

  -- Set the moment session 30 is finished -- win or lose the Graduation Duel.
  -- Losing the final game is not a reason to withhold a certificate from a
  -- child who completed a thirty-session course.
  graduated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per child. Writers upsert with `on conflict (child_id)`.
  unique (child_id),

  -- The two invariants lib/school/v2/progress.ts enforces on read, enforced
  -- on write as well: a session number outside the course is not progress,
  -- and graduation is only a claim if session 30 is actually in the list.
  constraint child_school_progress_sessions_in_range
    check (completed_sessions <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]),
  constraint child_school_progress_graduation_backed
    check (graduated_at is null or 30 = any (completed_sessions))
);

create index if not exists child_school_progress_child_idx
  on public.child_school_progress (child_id);

alter table public.child_school_progress enable row level security;

-- Same ownership model as child_game_reviews (0033) and puzzle_library_solves
-- (0029): the authenticated parent reaches a row only through their own
-- children. No anon access, no service role required by the app.
drop policy if exists "parent can manage own child's school progress"
  on public.child_school_progress;
create policy "parent can manage own child's school progress"
  on public.child_school_progress for all
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 2. school_entitlements -- Chess School sold on its own
-- --------------------------------------------------------------------------
-- The pricing intent is a one-off Chess School purchase (Rs 199) that sits
-- ALONGSIDE Premium rather than inside it: Premium includes the School
-- permanently, and the School can also be bought by itself by someone who
-- does not want everything else.
--
-- This table is the record of the second case. It is written ONLY by
-- grant_school_entitlement / revoke_school_entitlement below (service role,
-- from the Stripe webhook and the purchase success page after verifying the
-- payment with Stripe) -- never from a browser. A 'grant' row can be inserted
-- by hand for support or testing without inventing a schema under pressure.
create table if not exists public.school_entitlements (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,

  -- How this entitlement came to exist. 'purchase' is the Rs 199 sale;
  -- 'grant' covers support, testing and goodwill.
  source text not null default 'purchase' check (source in ('purchase', 'grant')),

  -- NULL means lifetime, which is the intended shape of the Rs 199 sale.
  expires_at timestamptz,

  -- Payment provenance, same columns premium_entitlements (0031) keeps:
  -- enough to make the grant idempotent per checkout and to find the row
  -- again when Stripe reports a refund.
  provider text not null default 'stripe',
  checkout_session_id text,
  payment_intent_id text,
  amount_minor integer,
  currency text,
  revoked_at timestamptz,

  granted_at timestamptz not null default now(),

  unique (parent_id),
  unique (checkout_session_id)
);

create index if not exists school_entitlements_payment_intent_idx
  on public.school_entitlements (payment_intent_id);

alter table public.school_entitlements enable row level security;

-- Read-only to the owning parent. Writes are server-side only (no policy for
-- insert/update by `authenticated`), because a row here is a claim about
-- money changing hands and a client must never be able to assert one.
drop policy if exists "parent can read own school entitlement"
  on public.school_entitlements;
create policy "parent can read own school entitlement"
  on public.school_entitlements for select
  using (
    parent_id in (
      select p.id from public.parents p where p.auth_user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 3. parent_has_school_access(parent) -- the single access question
-- --------------------------------------------------------------------------
-- Premium implies School access; a standalone School entitlement also grants
-- it. Expiry-aware on both sides, mirroring parent_is_premium() (0031) rather
-- than re-implementing the expiry rule with a second opinion about it.
create or replace function public.parent_has_school_access(p_parent_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    public.parent_is_premium(p_parent_id)
    or coalesce(
      (
        select se.revoked_at is null
           and (se.expires_at is null or se.expires_at > now())
        from public.school_entitlements se
        where se.parent_id = p_parent_id
      ),
      false
    );
$$;

revoke all on function public.parent_has_school_access(uuid) from public, anon;
grant execute on function public.parent_has_school_access(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 4. grant / revoke -- the ONLY write paths for school_entitlements
-- --------------------------------------------------------------------------
-- Same shape and same rules as grant_premium_entitlement (0031): callable
-- only by the service role (the Stripe webhook and the purchase success
-- page, both of which verify the payment against Stripe first), idempotent
-- per checkout session because Stripe delivers events at least once and the
-- success page may fire for the same session, and never callable by a
-- browser. A row here is a claim that money changed hands.
create or replace function public.grant_school_entitlement(
  p_parent_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text default null,
  p_amount_minor integer default null,
  p_currency text default null,
  p_provider text default 'stripe'
)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_granted timestamptz;
begin
  -- Idempotent on the checkout session: a second delivery is a no-op.
  if exists (
    select 1 from public.school_entitlements
    where checkout_session_id = p_checkout_session_id
  ) then
    select granted_at into v_granted
    from public.school_entitlements
    where checkout_session_id = p_checkout_session_id;
    return v_granted;
  end if;

  insert into public.school_entitlements
    (parent_id, source, expires_at, provider, checkout_session_id,
     payment_intent_id, amount_minor, currency)
  values
    (p_parent_id, 'purchase', null, p_provider, p_checkout_session_id,
     p_payment_intent_id, p_amount_minor, p_currency)
  on conflict (parent_id) do update
    set source = 'purchase',
        expires_at = null,
        revoked_at = null,
        provider = excluded.provider,
        checkout_session_id = excluded.checkout_session_id,
        payment_intent_id = excluded.payment_intent_id,
        amount_minor = excluded.amount_minor,
        currency = excluded.currency,
        granted_at = now()
  returning granted_at into v_granted;

  return v_granted;
end;
$$;

revoke all on function public.grant_school_entitlement(uuid, text, text, integer, text, text)
  from public, anon, authenticated;

create or replace function public.revoke_school_entitlement(p_payment_intent_id text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  update public.school_entitlements
     set revoked_at = now()
   where payment_intent_id = p_payment_intent_id
     and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.revoke_school_entitlement(text)
  from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- 5. merge_school_progress -- the write path for progress, a UNION not a PUT
-- --------------------------------------------------------------------------
-- A plain upsert is last-write-wins on the arrays: a phone that loaded before
-- a tablet saved would, on its own next save, silently drop whatever the
-- tablet added. Progress is a set of things that happened, so the server
-- merges rather than replaces -- the same rule lib/school/v2/storage.ts
-- applies between the device and the server, applied once more between
-- devices. Nothing a client sends can ever REMOVE a completed session.
--
-- SECURITY INVOKER (the default): runs as the signed-in parent, so the RLS
-- policy on child_school_progress still decides which child rows are
-- reachable. The service role is not involved and not required.
create or replace function public.merge_school_progress(
  p_child_id uuid,
  p_completed_sessions int[],
  p_skill_tags text[],
  p_unlocks text[],
  p_graduated_at timestamptz default null
)
returns public.child_school_progress
language plpgsql
set search_path = public
as $$
declare
  v_row public.child_school_progress;
begin
  insert into public.child_school_progress
    (child_id, completed_sessions, skill_tags, unlocks, graduated_at)
  values
    (p_child_id,
     coalesce(p_completed_sessions, '{}'),
     coalesce(p_skill_tags, '{}'),
     coalesce(p_unlocks, '{}'),
     p_graduated_at)
  on conflict (child_id) do update
    set completed_sessions = (
          select coalesce(array_agg(distinct s order by s), '{}')
          from unnest(public.child_school_progress.completed_sessions || excluded.completed_sessions) as s
        ),
        skill_tags = (
          select coalesce(array_agg(distinct t), '{}')
          from unnest(public.child_school_progress.skill_tags || excluded.skill_tags) as t
        ),
        unlocks = (
          select coalesce(array_agg(distinct u), '{}')
          from unnest(public.child_school_progress.unlocks || excluded.unlocks) as u
        ),
        -- The EARLIER graduation stands; a later device cannot move it.
        graduated_at = least(public.child_school_progress.graduated_at, excluded.graduated_at)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.merge_school_progress(uuid, int[], text[], text[], timestamptz) from public, anon;
grant execute on function public.merge_school_progress(uuid, int[], text[], text[], timestamptz) to authenticated;

-- --------------------------------------------------------------------------
-- 6. updated_at maintenance
-- --------------------------------------------------------------------------
create or replace function public.touch_child_school_progress()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists child_school_progress_touch on public.child_school_progress;
create trigger child_school_progress_touch
  before update on public.child_school_progress
  for each row execute function public.touch_child_school_progress();
