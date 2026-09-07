-- Take generate_friend_code() away from the browser — without breaking the
-- trigger that legitimately needs it.
--
-- THE FINDING
--
-- 0034 ends with:
--     revoke execute on function public.generate_friend_code() from authenticated;
--
-- but never revokes it from PUBLIC, and Postgres grants EXECUTE to PUBLIC on
-- every function at creation. So the revoke has no effect: anon and
-- authenticated both still reach it. Measured, not inferred:
--
--     anon          ALLOWED -> 8 chars
--     authenticated ALLOWED -> 8 chars
--
-- Low severity on its own. The function is SECURITY INVOKER, writes nothing,
-- and returns a random string that is never compared against data the caller
-- can see — so it cannot be used to enumerate or guess anyone's code. But it is
-- an unintended public surface, and the migration that meant to close it did
-- not.
--
-- WHY THE OBVIOUS ONE-LINE FIX IS WRONG
--
-- `revoke execute ... from public` on its own BREAKS ADDING A CHILD.
--
-- The chain, verified end to end against production:
--
--   1. A parent adds a child in the dashboard. createChild() (queries.ts:114)
--      inserts through lib/supabase/client — the BROWSER client, so the insert
--      runs as `authenticated`.
--   2. The BEFORE INSERT trigger children_set_friend_code fires. Postgres does
--      not check EXECUTE on a trigger function, so it runs.
--   3. set_friend_code() is SECURITY INVOKER, so it executes AS `authenticated`
--      and calls generate_friend_code() — an ordinary function call, which DOES
--      require EXECUTE for the current role.
--   4. 0034 revoked that from `authenticated`. The only remaining source of the
--      privilege is the PUBLIC grant.
--
-- Remove PUBLIC and step 3 fails with "permission denied for function
-- generate_friend_code", and onboarding stops working. Confirmed that the flow
-- currently succeeds and the trigger does populate the column:
--
--     child creation as authenticated: SUCCEEDED
--     trigger populated friend_code: yes (8 chars)
--
-- THE FIX
--
-- Make the TRIGGER function SECURITY DEFINER. It then runs as its owner, and
-- calls generate_friend_code() as the owner, so the caller no longer needs the
-- privilege at all — and EXECUTE can be revoked from every client role.
--
-- Note that SECURITY DEFINER on generate_friend_code() itself would NOT work:
-- that changes the privileges a function RUNS WITH, not who may CALL it. The
-- caller would still need EXECUTE. The definer boundary has to sit on the
-- trigger.
--
-- A SECOND BUG THIS FIXES
--
-- generate_friend_code()'s uniqueness loop is
--     exit when not exists (select 1 from public.children where friend_code = candidate);
--
-- Running as `authenticated` under parent-owns-child RLS, that subquery can only
-- see the caller's OWN children. Measured: 2 rows visible out of 7. So the
-- collision check has been very nearly inert — it exits on the first candidate
-- whatever else exists. Codes have not collided because the space is 29^8, and
-- the unique index would fail the insert loudly if they did, but the check was
-- not doing its job. Under the definer boundary it runs as the owner, sees every
-- row, and starts working as written.
--
-- SAFETY
--
--   * Additive. No table, column, policy or row is touched.
--   * No DROP TABLE, no DELETE, no data modification.
--   * Idempotent: create-or-replace plus revokes that are no-ops when repeated.
--   * search_path is pinned on the definer function, so it cannot be steered
--     to a look-alike `children` in another schema.
--   * Existing friend codes are untouched; the backfill in 0034 already ran and
--     is not repeated here.
--
-- ROLLBACK (restores the pre-0042 behaviour exactly):
--   create or replace function public.set_friend_code() returns trigger
--   language plpgsql as $$
--   begin
--     if new.friend_code is null then
--       new.friend_code := public.generate_friend_code();
--     end if;
--     return new;
--   end; $$;
--   grant execute on function public.generate_friend_code() to public;

-- ---------------------------------------------------------------------------
-- 1. Move the privilege boundary onto the trigger
-- ---------------------------------------------------------------------------
-- Body unchanged from 0034 apart from the security clause and search_path.

create or replace function public.set_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.generate_friend_code();
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged and still bound to this function; recreating
-- it is unnecessary and would briefly leave the table without it.

-- ---------------------------------------------------------------------------
-- 2. Now the client roles genuinely do not need it
-- ---------------------------------------------------------------------------
-- PUBLIC first — that is the grant that made 0034's revoke ineffective. anon
-- and authenticated are then named explicitly so the intent survives even if
-- someone later re-grants to PUBLIC.

revoke execute on function public.generate_friend_code() from public;
revoke execute on function public.generate_friend_code() from anon;
revoke execute on function public.generate_friend_code() from authenticated;

-- service_role is deliberately NOT revoked: the maintenance/backfill path and
-- any future admin tooling run as service_role, which never reaches a browser.

-- ---------------------------------------------------------------------------
-- VERIFICATION (read-only — run after applying)
-- ---------------------------------------------------------------------------
-- (a) No client role holds EXECUTE. EXPECT 0 ROWS.
--
-- select r.rolname as grantee
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
-- join pg_roles r on r.oid = a.grantee
-- where n.nspname = 'public' and p.proname = 'generate_friend_code'
--   and a.privilege_type = 'EXECUTE'
--   and r.rolname in ('anon', 'authenticated');
--
-- (b) PUBLIC holds no EXECUTE. EXPECT 0 ROWS.
--
-- select 1
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
-- where n.nspname = 'public' and p.proname = 'generate_friend_code'
--   and a.privilege_type = 'EXECUTE' and a.grantee = 0;
--
-- (c) The trigger function is now SECURITY DEFINER. EXPECT prosecdef = true.
--
-- select p.proname, p.prosecdef
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('set_friend_code', 'generate_friend_code')
-- order by p.proname;
--
-- (d) Every existing child still has its code, unchanged. EXPECT 0 nulls.
--
-- select count(*) filter (where friend_code is null) as missing_codes,
--        count(*) as total
-- from public.children;
--
-- (e) FUNCTIONAL: adding a child must still work and still get a code. Run
--     scripts/test-friendships.js, which exercises this as `authenticated`
--     and cleans up after itself.
