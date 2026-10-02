-- Phase 7B: Game Review analysis persistence/caching.
--
-- Problem being fixed (see Phase 7B audit): every reload of an already-
-- reviewed finished game re-ran the client-side Stockfish pass AND called
-- Claude again via /api/game-analysis/explain, AND re-inserted a
-- child_game_reviews row (plain .insert(), no identity), AND re-bumped
-- child_skill_signals.weak_count for every flagged skill — unbounded on
-- every reload/reopen of the same game. This migration is ADDITIVE: it
-- only adds nullable columns + one partial index to the existing
-- child_game_reviews table (0033) and one new narrow RPC. Nothing existing
-- is altered, dropped, or backfilled.
--
-- Design note (Phase 7B-1 -> 7B-2 revision): the originally-designed write
-- path used a PostgREST client-side .upsert({ onConflict: "..." }) against
-- a PARTIAL unique index. That does not work — PostgREST's on_conflict
-- parameter only ever emits a bare `ON CONFLICT (columns)`, with no way to
-- attach the `WHERE game_ref IS NOT NULL` predicate a partial index
-- requires as its arbiter (confirmed against PostgREST issue #2123 before
-- writing this migration; verified empirically that DDL against the live
-- project needs explicit user approval, which this migration is). The
-- partial index itself is unchanged from the approved design — only the
-- write mechanism moved from a client-side upsert call to this one
-- SECURITY DEFINER RPC, which issues the exact
-- `INSERT ... ON CONFLICT (child_id, source, game_ref) WHERE game_ref IS
-- NOT NULL DO UPDATE ...` in raw SQL, which Postgres itself supports fine
-- — the incompatibility was PostgREST's query-building layer, not Postgres.

-- --------------------------------------------------------------------------
-- 1. New columns on child_game_reviews (additive, all nullable)
-- --------------------------------------------------------------------------
alter table public.child_game_reviews
  add column if not exists game_ref text,
  add column if not exists free_analysis jsonb,
  add column if not exists premium_analysis jsonb;

comment on column public.child_game_reviews.game_ref is
  'Stable per-game identifier: online_games.id for source=''online'', a client-generated UUID (crypto.randomUUID(), assigned once when the game starts) for source=''free_play''. NULL on every row created before Phase 7B and never backfilled — historical rows are intentionally excluded from the uniqueness boundary below.';

comment on column public.child_game_reviews.free_analysis is
  'Free-tier explanation snapshot: exactly the shape returned to a Free client by /api/game-analysis/explain (one biggest-moment mistake explanation + biggestLesson, empty goodMoves/insights). Populated on every generation, Free or Premium, so a later Premium->Free downgrade never needs a fresh Claude call. Written ONLY via upsert_child_game_review_analysis() below — never write this column with a raw client-side update.';

comment on column public.child_game_reviews.premium_analysis is
  'Full Premium explanation snapshot: every mistake explanation, goodMoves, insights, biggestLesson — exactly the shape returned to a Premium client. NULL until the first Premium-resolved review of this game. A Free-resolved server code path must NEVER select this column (see app/api/game-analysis/explain/route.ts) — entitlement is resolved exclusively via resolvePremiumState(), never from this column''s mere presence. Written ONLY via upsert_child_game_review_analysis() below.';

-- --------------------------------------------------------------------------
-- 2. Partial unique index — (child_id, source, game_ref), historical NULL
--    game_ref rows excluded entirely and can coexist in any number.
-- --------------------------------------------------------------------------
create unique index if not exists child_game_reviews_child_source_game_ref_uniq
  on public.child_game_reviews (child_id, source, game_ref)
  where game_ref is not null;

-- --------------------------------------------------------------------------
-- 3. upsert_child_game_review_analysis(...)
--
-- The ONLY writer of game_ref/free_analysis/premium_analysis. Narrow,
-- single-purpose, SECURITY DEFINER + explicit ownership check — same
-- pattern as bump_skill_signal (0033). Does NOT contain any Premium
-- entitlement logic: it merges whatever free_analysis/premium_analysis the
-- caller supplies. Entitlement (which analysis the caller is even allowed
-- to generate/see) is resolved exclusively by the calling application code
-- (resolvePremiumState(), in app/api/game-analysis/explain/route.ts) BEFORE
-- this function is ever called — this function trusts its arguments only
-- for "what to persist", never for "who is allowed to see what".
--
-- Merge semantics (never overwrite an existing snapshot with NULL):
--   free_analysis    = coalesce(new value, existing value)
--   premium_analysis = coalesce(new value, existing value)
-- A caller that only just generated a Free explanation passes NULL for
-- p_premium_analysis, which coalesces to "keep whatever was already
-- there" — it can never blank out an existing Premium snapshot. Likewise
-- a Premium generation should pass BOTH the full analysis AND the
-- Free-safe subset derived from it (the calling route's responsibility),
-- so a later Premium->Free downgrade always finds free_analysis already
-- populated.
--
-- Duplicate-row prevention: the INSERT ... ON CONFLICT (child_id, source,
-- game_ref) WHERE game_ref IS NOT NULL DO UPDATE clause is a single atomic
-- statement — Postgres guarantees no duplicate row can ever be created for
-- the same (child_id, source, game_ref) even under concurrent calls; there
-- is no separate check-then-write step for this part.
--
-- is_new_row (skill-signal double-count prevention): computed via the
-- standard `(xmax = 0)` Postgres idiom in the SAME atomic RETURNING clause
-- as the insert/update itself (true only when this call's own statement
-- performed the INSERT branch, false when it went through the UPDATE
-- branch of the upsert) — not a separate SELECT before the write, so this
-- carries no race window of its own. The calling route uses this to bump
-- child_skill_signals only the first time a game is EVER reviewed by
-- anyone at any tier, never on a cache hit and never again when a later
-- tier upgrade generates additional content for an already-reviewed game.
-- --------------------------------------------------------------------------
create or replace function public.upsert_child_game_review_analysis(
  p_child_id uuid,
  p_source text,
  p_game_ref text,
  p_played_color text default null,
  p_result text default null,
  p_accuracy int default null,
  p_total_moves int default null,
  p_mistakes int default 0,
  p_blunders int default 0,
  p_inaccuracies int default 0,
  p_biggest_moment_skill text default null,
  p_biggest_moment_ply int default null,
  p_opening_name text default null,
  p_free_analysis jsonb default null,
  p_premium_analysis jsonb default null
)
returns table (
  id uuid,
  is_new_row boolean,
  has_free_analysis boolean,
  has_premium_analysis boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_is_new_row boolean;
  v_has_free boolean;
  v_has_premium boolean;
begin
  if p_game_ref is null or length(trim(p_game_ref)) = 0 then
    raise exception 'game_ref is required for upsert_child_game_review_analysis';
  end if;
  if p_source not in ('free_play', 'online') then
    raise exception 'invalid source';
  end if;

  if not exists (
    select 1 from public.children c
    join public.parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized for this child';
  end if;

  insert into public.child_game_reviews as r
    (child_id, source, game_ref, played_color, result, accuracy, total_moves,
     mistakes, blunders, inaccuracies, biggest_moment_skill, biggest_moment_ply,
     opening_name, free_analysis, premium_analysis)
  values
    (p_child_id, p_source, p_game_ref, p_played_color, p_result, p_accuracy, p_total_moves,
     coalesce(p_mistakes, 0), coalesce(p_blunders, 0), coalesce(p_inaccuracies, 0),
     p_biggest_moment_skill, p_biggest_moment_ply, p_opening_name,
     p_free_analysis, p_premium_analysis)
  on conflict (child_id, source, game_ref) where game_ref is not null
  do update set
    free_analysis = coalesce(excluded.free_analysis, r.free_analysis),
    premium_analysis = coalesce(excluded.premium_analysis, r.premium_analysis)
  returning r.id, (xmax = 0), (r.free_analysis is not null), (r.premium_analysis is not null)
    into v_id, v_is_new_row, v_has_free, v_has_premium;

  return query select v_id, v_is_new_row, v_has_free, v_has_premium;
end;
$$;

revoke all on function public.upsert_child_game_review_analysis(
  uuid, text, text, text, text, int, int, int, int, int, text, int, text, jsonb, jsonb
) from public;
grant execute on function public.upsert_child_game_review_analysis(
  uuid, text, text, text, text, int, int, int, int, int, text, int, text, jsonb, jsonb
) to authenticated;
