-- Follow-up to 0021 (and the retroactively-applied 0017/0018/0020 REVOKEs
-- inside it): after applying those column-level REVOKEs, I directly
-- verified against the live database whether they actually took effect —
-- they did NOT. `information_schema.column_privileges` still showed
-- parents.premium_status, children.rating, and online_games.status (etc.)
-- as UPDATE-able by `authenticated` even after the REVOKE ran without
-- error.
--
-- Root cause: `authenticated` also holds a broad TABLE-LEVEL
-- `GRANT UPDATE` on each of these tables (Supabase's default grant, issued
-- when the table was first created/RLS-enabled, predating all of these
-- migrations). In Postgres, a column-level REVOKE only removes a
-- column-level grant — it cannot narrow a separate, still-standing
-- table-level grant, which continues to authorize UPDATE on every column
-- regardless. This means the equivalent REVOKE lines already committed as
-- part of 0017/0018/0020 likely never worked as intended even when this
-- app was first built, not just in this retroactive application.
--
-- The actual fix: REVOKE the table-level UPDATE grant entirely, then GRANT
-- UPDATE back for only the specific columns real client code legitimately
-- writes directly (found by grepping the codebase for every
-- `.from(table).update(...)` call — not guessed):
--   parents:      screen_time_weekday_minutes, screen_time_weekend_minutes
--                 (app/parent-dashboard/ScreenTimeSettings.tsx) — NOT
--                 premium_status, which only app/api/stripe/webhook and
--                 app/upgrade/success write, both via the service-role
--                 admin client (lib/supabase/admin.ts), unaffected by any
--                 of this.
--   children:     avatar_id, buddy_id, board_skin_id, piece_set_id
--                 (lib/supabase/queries.ts's updateChild* functions) — NOT
--                 rating (apply_match_rating only) or current_day
--                 (mark_lesson_complete RPC only).
--   online_games: host_reaction, guest_reaction (sendReaction()) — NOT
--                 status/winner/fen/moves/current_turn/the clock columns/
--                 guest_child_id/match_type/rating_applied, or the new
--                 tournament_id/round_number/tournament_pairing_id columns
--                 0023 adds — all of those go through RPCs exclusively.

revoke update on public.parents from authenticated;
grant update (screen_time_weekday_minutes, screen_time_weekend_minutes)
  on public.parents to authenticated;

revoke update on public.children from authenticated;
grant update (avatar_id, buddy_id, board_skin_id, piece_set_id)
  on public.children to authenticated;

revoke update on public.online_games from authenticated;
grant update (host_reaction, guest_reaction)
  on public.online_games to authenticated;
