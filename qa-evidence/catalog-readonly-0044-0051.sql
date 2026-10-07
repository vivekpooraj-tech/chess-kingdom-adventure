-- READ-ONLY catalog verification. No DDL/DML.
SELECT json_build_object(
  'record_train_your_mind_use', (
    SELECT json_agg(json_build_object(
      'oid', p.oid,
      'identity', pg_get_function_identity_arguments(p.oid),
      'has_cap_lt_2', position('activities_completed < 2' in p.prosrc) > 0,
      'has_cap_lt_3', position('activities_completed < 3' in p.prosrc) > 0,
      'has_remaining_2', position('2 - v_count' in p.prosrc) > 0,
      'has_remaining_3', position('3 - v_count' in p.prosrc) > 0,
      'prosrc' , p.prosrc
    ))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_train_your_mind_use'
  ),
  'find_or_create_match', (
    SELECT json_agg(json_build_object(
      'oid', p.oid,
      'identity', pg_get_function_identity_arguments(p.oid),
      'has_expire_call', position('expire_abandoned_matched_games' in p.prosrc) > 0,
      'has_v_open_game', position('v_open_game' in p.prosrc) > 0,
      'has_window_cap_400', position('else 400' in p.prosrc) > 0,
      'has_keep_waiting_row', position('Keep the caller' in p.prosrc) > 0
        OR position('set rating = v_rating' in p.prosrc) > 0,
      'has_insert_matched', position('''matched''' in p.prosrc) > 0,
      'has_insert_active_literal', position('''active''' in p.prosrc) > 0,
      'has_last_move_null', position('v_tc, null' in p.prosrc) > 0,
      'prosrc', p.prosrc
    ))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'find_or_create_match'
  ),
  'matchmaking_queue_replident', (
    SELECT json_build_object(
      'relname', c.relname,
      'relreplident', c.relreplident,
      'meaning', CASE c.relreplident
        WHEN 'd' THEN 'DEFAULT (primary key)'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL'
        WHEN 'i' THEN 'INDEX'
        ELSE c.relreplident::text
      END
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'matchmaking_queue'
  ),
  'publication_matchmaking_queue', (
    SELECT json_agg(json_build_object(
      'pubname', pubname,
      'schemaname', schemaname,
      'tablename', tablename
    ))
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'matchmaking_queue'
  ),
  'indexes', (
    SELECT json_agg(json_build_object(
      'schemaname', schemaname,
      'tablename', tablename,
      'indexname', indexname,
      'indexdef', indexdef
    ))
    FROM pg_indexes
    WHERE indexname IN (
      'child_game_reviews_child_source_game_ref_uniq',
      'online_games_abandoned_matched_idx'
    )
  ),
  'policies_0044', (
    SELECT json_agg(json_build_object(
      'schemaname', schemaname,
      'tablename', tablename,
      'policyname', policyname,
      'permissive', permissive,
      'roles', roles,
      'cmd', cmd,
      'qual', qual,
      'with_check', with_check
    ))
    FROM pg_policies
    WHERE tablename = 'child_train_your_mind_activity'
  ),
  'table_privs_0044', (
    SELECT json_agg(json_build_object(
      'grantee', grantee,
      'privilege_type', privilege_type,
      'is_grantable', is_grantable
    ))
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'child_train_your_mind_activity'
      AND grantee IN ('authenticated', 'anon', 'public', 'service_role')
  ),
  'col_grants_0046', (
    SELECT json_agg(json_build_object(
      'grantee', grantee,
      'column_name', column_name,
      'privilege_type', privilege_type
    ))
    FROM information_schema.role_column_grants
    WHERE table_schema = 'public'
      AND table_name = 'children'
      AND column_name = 'has_seen_opening_video'
      AND grantee IN ('authenticated', 'anon', 'public', 'service_role')
  ),
  'col_grants_0044_writes', (
    SELECT json_agg(json_build_object(
      'grantee', grantee,
      'column_name', column_name,
      'privilege_type', privilege_type
    ))
    FROM information_schema.role_column_grants
    WHERE table_schema = 'public'
      AND table_name = 'child_train_your_mind_activity'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
      AND grantee IN ('authenticated', 'anon', 'public')
  )
) AS catalog;
