-- STATE (2026-10-10): production already runs this policy (default 1200; pairwise K=64/32 function), applied from an equivalent text whose normalized body is identical to this file. Running this whole file is optional and idempotent; it only aligns the production function text with this file.
--
-- Run this file AS A WHOLE (select everything, then Run). Three statements: ALTER TABLE (the new default), CREATE OR REPLACE FUNCTION (its
-- body sits inside one dollar-quoted block that opens and closes inside that statement), then a GRANT. Running only part of it fails with 42601.
--
-- Chess Mind rating policy
--   1. New players start at 1200. This changes ONLY the default for rows inserted from now on. No existing row is touched: there is no
--      UPDATE of children.rating that is not inside apply_match_rating and keyed to one game's two players. Nobody is bulk-reset by this file.
--      (Production today: 8 children, all at 400, none with a single rated game. See 0057 for the separate, optional decision about them.)
--   2. A player is provisional for their first 10 completed rated games.
--   3. K is decided PER GAME, not per player: if EITHER player is provisional, K = 64 for BOTH players, otherwise K = 32 for BOTH. Both players
--      therefore move by the same K, so one player's gain is the other's loss (apart from rounding and the 400 floor).
--   4. Same formula as before (Elo logistic, divisor 400, rounded, never below the 400 floor). Only K changed, from a flat 32.
--   5. The number of completed rated games is DERIVED, not stored: the count of that player's rating_history rows. apply_match_rating writes
--      exactly one row per player per rated game, in the same transaction that sets rating_applied, so the count cannot drift and needs no
--      new column, no backfill and no new client permission. It is read BEFORE this game's rows are inserted, so game N uses the count N-1.
--   6. Only completed random-match games count. Unchanged guards: match_type must be random, the game must be finished with a guest, and
--      rating_applied makes a second call a no-op (duplicates cannot double-apply). Guard added in the previous revision and kept: a finished
--      game with no valid winner is never rated (before, a missing winner was silently treated as a guest win). Invite games, tournament games,
--      abandoned pre-start matches, training, puzzles and logins never move a rating or count toward the 10.
--   7. Both players' rows are locked in a fixed order (by id) before their ratings and counts are read, so two different games finishing for
--      the same player at the same moment cannot read a stale rating or a stale game count.
--
-- Lichess ratings are a different rating on a different site and are not read, converted or written anywhere in this migration.
--
-- Deployed base (read from production on 2026-10-09): the live function is exactly migration 0026 (flat K = 32, floor 400), and
-- children.rating defaults to 400. This file changes that function by: the per-game K, the games count, the row locks and the winner guard.
--
-- NUMBERING: 0053, 0054 and 0055 are already used by the Train Your Mind migrations, so this is 0056.
--
-- DEPLOY ORDER: apply this migration before (or together with) the app release that changes the matchmaking copy. The copy quotes the rating
-- the player actually has, so it is truthful either way, but the 1200 start only exists once this runs.
--
-- ROLLBACK: re-run apply_match_rating from 0026 and set the default back (alter table public.children alter column rating set default 400).
-- Ratings already changed by games played under this version stay as they are (there is nothing to undo in the schema).

alter table public.children
  alter column rating set default 1200;

create or replace function public.apply_match_rating(p_game_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  g record;
  host_rating int;
  guest_rating int;
  host_score numeric;
  guest_score numeric;
  host_new int;
  guest_new int;
  host_result text;
  guest_result text;
  host_games int;
  guest_games int;
  game_k int;
  k_provisional constant int := 64;
  k_established constant int := 32;
  provisional_games constant int := 10;
  rating_floor constant int := 400;
begin
  select * into g from online_games where id = p_game_id for update;
  if g.id is null then return; end if;
  if g.match_type <> 'random' then return; end if;
  if g.rating_applied then return; end if;
  if g.status <> 'finished' or g.guest_child_id is null then return; end if;
  if g.winner is null or g.winner not in ('w', 'b', 'draw') then return; end if;

  -- Lock both players in a fixed order so a concurrent game for the same player waits and then reads the updated rating and count.
  perform 1 from children where id in (g.host_child_id, g.guest_child_id) order by id for update;

  select rating into host_rating from children where id = g.host_child_id;
  select rating into guest_rating from children where id = g.guest_child_id;

  -- Completed rated games BEFORE this one: one rating_history row per player per rated game.
  select count(*) into host_games from rating_history where child_id = g.host_child_id;
  select count(*) into guest_games from rating_history where child_id = g.guest_child_id;
  -- One K for the whole game: provisional if EITHER player is still provisional, so both players move by the same amount.
  game_k := case when host_games < provisional_games or guest_games < provisional_games then k_provisional else k_established end;

  if g.winner = 'draw' then
    host_score := 0.5; guest_score := 0.5;
    host_result := 'draw'; guest_result := 'draw';
  elsif g.winner = g.host_color then
    host_score := 1; guest_score := 0;
    host_result := 'win'; guest_result := 'loss';
  else
    host_score := 0; guest_score := 1;
    host_result := 'loss'; guest_result := 'win';
  end if;

  -- Floor at 400: a rating can never be driven below it, no matter how long a losing streak runs.
  host_new := greatest(rating_floor, round(host_rating + game_k * (host_score - 1.0 / (1 + power(10, (guest_rating - host_rating) / 400.0)))));
  guest_new := greatest(rating_floor, round(guest_rating + game_k * (guest_score - 1.0 / (1 + power(10, (host_rating - guest_rating) / 400.0)))));

  update children set rating = host_new where id = g.host_child_id;
  update children set rating = guest_new where id = g.guest_child_id;

  update online_games
  set rating_applied = true,
      host_rating_before = host_rating,
      host_rating_after = host_new,
      guest_rating_before = guest_rating,
      guest_rating_after = guest_new
  where id = p_game_id;

  insert into rating_history (child_id, game_id, old_rating, rating_change, new_rating, result, opponent_child_id)
  values
    (g.host_child_id, p_game_id, host_rating, host_new - host_rating, host_new, host_result, g.guest_child_id),
    (g.guest_child_id, p_game_id, guest_rating, guest_new - guest_rating, guest_new, guest_result, g.host_child_id);
end;
$function$;

grant execute on function public.apply_match_rating(uuid) to authenticated;

-- RISKS for the reviewer (not executed):
--   * An ESTABLISHED player who meets a provisional opponent also moves at K = 64 for that game. That is the cost of "same K for both":
--     established ratings swing twice as hard against newcomers, but the pool stays zero-sum. The 400 floor can still make a game
--     slightly positive-sum for the loser's side (a player cannot drop below 400).
--   * With a 1200 default, get_daily_challenge (0030) would add one difficulty step to EVERY new player's first Daily Challenge, because its
--     rating nudge tests children.rating >= 600. 0058 fixes that by basing the nudge on rated-game history. Apply 0058 before or together with
--     this file so no new player ever sees the unintended step.
