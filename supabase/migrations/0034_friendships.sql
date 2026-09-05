-- Friends, designed for a product with children on it.
--
-- The central constraint is that Chess Mind must not have a browsable directory
-- of children. `children` carries a parent-owns-child RLS policy (0001), and
-- opening that up so players could search each other would be the single most
-- damaging change this codebase could make. It is also why there is no global
-- leaderboard.
--
-- So friending works by CODE, not by search. Each child gets a short code they
-- share out of band (in person, or a parent passes it on). A code can only be
-- redeemed through the SECURITY DEFINER function below, which resolves it to a
-- child id server-side and never returns the identity of a child whose code you
-- do not already have. There is no endpoint that lists or enumerates players.
--
-- Duplicate and reversed-duplicate requests are impossible by construction:
-- rows are stored in canonical order (child_a < child_b) with a unique
-- constraint over the pair, so "A befriends B" and "B befriends A" are the same
-- row. A separate requested_by column records who asked, which is what the
-- accept/decline flow needs.
--
-- Nothing here enables messaging. Friendship allows exactly two things:
-- challenging each other to a game, and seeing each other's public profile
-- summary. Free-text communication between children is deliberately absent.

-- 1. Friend codes -----------------------------------------------------------

alter table public.children
  add column if not exists friend_code text;

-- Codes avoid characters that are easily confused when read aloud or copied by
-- a child: no O/0, I/1/L, U/V. Eight characters from a 28-symbol alphabet is
-- ~4e11 combinations, so guessing one is not a practical attack, and the unique
-- index means a collision fails loudly rather than silently sharing an account.
create unique index if not exists children_friend_code_key
  on public.children (friend_code)
  where friend_code is not null;

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.children where friend_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Backfill existing children, then default new ones.
update public.children set friend_code = public.generate_friend_code() where friend_code is null;

create or replace function public.set_friend_code()
returns trigger
language plpgsql
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.generate_friend_code();
  end if;
  return new;
end;
$$;

drop trigger if exists children_set_friend_code on public.children;
create trigger children_set_friend_code
  before insert on public.children
  for each row execute function public.set_friend_code();

-- A child's own code is readable through the existing parent-owns-child policy.
-- Clients must never be able to WRITE it: a chosen code would let someone
-- squat a code they expect a specific child to be given.
revoke update (friend_code) on public.children from authenticated;

-- 2. Friendships ------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  child_a uuid not null references public.children(id) on delete cascade,
  child_b uuid not null references public.children(id) on delete cascade,
  -- Who sent the request. Always one of child_a / child_b.
  requested_by uuid not null references public.children(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  -- Canonical ordering makes a reversed duplicate the same row.
  constraint friendship_distinct check (child_a <> child_b),
  constraint friendship_ordered check (child_a < child_b),
  constraint friendship_requester_is_party check (requested_by in (child_a, child_b)),
  unique (child_a, child_b)
);

create index if not exists friendships_child_a_idx on public.friendships (child_a, status);
create index if not exists friendships_child_b_idx on public.friendships (child_b, status);

alter table public.friendships enable row level security;

-- A parent can see friendships involving their own children, and nothing else.
drop policy if exists "parent can view own children's friendships" on public.friendships;
create policy "parent can view own children's friendships"
  on public.friendships for select
  using (
    child_a in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
    or child_b in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- All writes go through the SECURITY DEFINER functions below, which enforce
-- ownership and state transitions. No direct client insert/update/delete: a
-- client that could write this table directly could accept a friendship on
-- someone else's behalf.
revoke insert, update, delete on public.friendships from authenticated;

-- 3. Sending a request by code ----------------------------------------------

create or replace function public.send_friend_request(p_child_id uuid, p_friend_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_a uuid;
  v_b uuid;
  v_existing public.friendships%rowtype;
begin
  -- The caller must own the child they are acting as.
  if not exists (
    select 1 from public.children c
    join public.parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) then
    return 'not_authorized';
  end if;

  select id into v_target
  from public.children
  where friend_code = upper(trim(p_friend_code));

  -- Deliberately the same answer for "no such code" and any other miss: a
  -- different message would turn this into a code-existence oracle.
  if v_target is null then
    return 'not_found';
  end if;

  if v_target = p_child_id then
    return 'self';
  end if;

  v_a := least(p_child_id, v_target);
  v_b := greatest(p_child_id, v_target);

  select * into v_existing from public.friendships where child_a = v_a and child_b = v_b;

  if found then
    if v_existing.status = 'accepted' then
      return 'already_friends';
    elsif v_existing.status = 'blocked' then
      -- Never reveal that a block exists.
      return 'pending';
    elsif v_existing.status = 'pending' then
      -- If the OTHER side already asked, treat this as acceptance.
      if v_existing.requested_by = v_target then
        update public.friendships
          set status = 'accepted', responded_at = now()
          where id = v_existing.id;
        return 'accepted';
      end if;
      return 'pending';
    else
      -- A previously declined request may be sent again.
      update public.friendships
        set status = 'pending', requested_by = p_child_id, created_at = now(), responded_at = null
        where id = v_existing.id;
      return 'pending';
    end if;
  end if;

  insert into public.friendships (child_a, child_b, requested_by, status)
  values (v_a, v_b, p_child_id, 'pending');
  return 'pending';
end;
$$;

-- 4. Responding to a request ------------------------------------------------

create or replace function public.respond_to_friend_request(
  p_child_id uuid,
  p_friendship_id uuid,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.friendships%rowtype;
begin
  if p_action not in ('accept', 'decline', 'remove', 'block') then
    return 'invalid_action';
  end if;

  if not exists (
    select 1 from public.children c
    join public.parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) then
    return 'not_authorized';
  end if;

  select * into v_row from public.friendships where id = p_friendship_id for update;
  if not found then
    return 'not_found';
  end if;

  -- The acting child must be part of this friendship.
  if p_child_id not in (v_row.child_a, v_row.child_b) then
    return 'not_authorized';
  end if;

  if p_action = 'accept' then
    -- Only the RECIPIENT may accept. Without this a requester could accept
    -- their own request and add anyone whose code they guessed.
    if v_row.requested_by = p_child_id then
      return 'not_authorized';
    end if;
    if v_row.status <> 'pending' then
      return 'invalid_state';
    end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = v_row.id;
    return 'accepted';
  end if;

  if p_action = 'decline' then
    update public.friendships set status = 'declined', responded_at = now() where id = v_row.id;
    return 'declined';
  end if;

  if p_action = 'block' then
    update public.friendships set status = 'blocked', responded_at = now() where id = v_row.id;
    return 'blocked';
  end if;

  -- remove: either side may end an accepted friendship.
  delete from public.friendships where id = v_row.id;
  return 'removed';
end;
$$;

grant execute on function public.send_friend_request(uuid, text) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, uuid, text) to authenticated;
revoke execute on function public.generate_friend_code() from authenticated;
