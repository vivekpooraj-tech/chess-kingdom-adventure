-- READ-ONLY post-history-repair schema check. No DDL/DML.
SELECT json_build_object(
  'tym_cap', (
    SELECT json_build_object(
      'has_cap_lt_2', position('activities_completed < 2' in p.prosrc) > 0,
      'has_cap_lt_3', position('activities_completed < 3' in p.prosrc) > 0,
      'has_remaining_3', position('3 - v_count' in p.prosrc) > 0
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_train_your_mind_use'
    LIMIT 1
  ),
  'find_or_create_match', (
    SELECT json_build_object(
      'has_expire_call', position('expire_abandoned_matched_games' in p.prosrc) > 0,
      'has_v_open_game', position('v_open_game' in p.prosrc) > 0,
      'has_window_cap_400', position('else 400' in p.prosrc) > 0,
      'has_keep_waiting_row', position('set rating = v_rating' in p.prosrc) > 0,
      'has_insert_matched', position('''matched''' in p.prosrc) > 0,
      'has_last_move_null', position('v_tc, null' in p.prosrc) > 0
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'find_or_create_match'
    LIMIT 1
  ),
  'matchmaking_queue_replident', (
    SELECT CASE c.relreplident
      WHEN 'f' THEN 'FULL'
      WHEN 'd' THEN 'DEFAULT'
      ELSE c.relreplident::text
    END
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'matchmaking_queue'
  ),
  'publication', (
    SELECT json_agg(json_build_object('pubname', pubname, 'tablename', tablename))
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matchmaking_queue'
  ),
  'indexes', (
    SELECT json_agg(indexname)
    FROM pg_indexes
    WHERE indexname IN (
      'child_game_reviews_child_source_game_ref_uniq',
      'online_games_abandoned_matched_idx'
    )
  )
) AS catalog;
