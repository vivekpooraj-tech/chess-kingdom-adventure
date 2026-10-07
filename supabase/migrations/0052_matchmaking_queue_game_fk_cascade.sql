-- matchmaking_queue.matched_game_id referenced online_games(id) with the default
-- NO ACTION (0008_matchmaking.sql). Deleting an Auth user cascades
-- auth.users -> parents -> children -> online_games, but another player's
-- stale matchmaking_queue row still pointing at one of those games aborted the
-- whole cascade ("Database error deleting user"). A queue row has no meaning
-- once its game is gone, so it should go with it.
ALTER TABLE public.matchmaking_queue
  DROP CONSTRAINT matchmaking_queue_matched_game_id_fkey,
  ADD CONSTRAINT matchmaking_queue_matched_game_id_fkey
    FOREIGN KEY (matched_game_id)
    REFERENCES public.online_games(id)
    ON DELETE CASCADE;
