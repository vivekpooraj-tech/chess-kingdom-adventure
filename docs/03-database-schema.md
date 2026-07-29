# Database Schema (Supabase Postgres) — v1

All tables use `uuid` PKs and RLS policies scoping rows to the owning family
(`parent_id` chain). Timestamps (`created_at`, `updated_at`) omitted below for
brevity but present on every table.

```sql
-- Identity
parents (
  id uuid pk,
  auth_user_id uuid references auth.users,
  email text,
  stripe_customer_id text,
  premium_status text check (premium_status in ('free','premium')),
  screen_time_weekday_minutes int default 60,
  screen_time_weekend_minutes int default 180
)

children (
  id uuid pk,
  parent_id uuid references parents(id),
  display_name text,
  birth_year int,              -- age band only, not full DOB where avoidable
  avatar_id uuid references avatars(id),
  buddy_id uuid references ai_buddies(id),
  current_day int default 1,
  timezone text
)

avatars ( id uuid pk, name text, asset_url text, unlock_condition text )

ai_buddies (
  id uuid pk, name text, personality_prompt text,
  voice_id text, unlock_condition text
)

-- Curriculum
crystals ( id uuid pk, piece text, name text, sort_order int )

lessons (
  id uuid pk,
  day_number int,
  crystal_id uuid references crystals(id),
  title text,
  story_beat text,
  skill_tags text[]           -- e.g. {'knight_movement','fork_pattern'}
)

lesson_steps (
  id uuid pk,
  lesson_id uuid references lessons(id),
  step_type text check (step_type in
    ('story','minigame','puzzle','ai_chat','mini_match','reward')),
  sort_order int,
  config jsonb                -- per-step-type parameters
)

minigame_mechanics (
  id uuid pk, key text unique,   -- e.g. 'drag_to_target', 'timed_reaction'
  engine_component text
)

minigame_variants (
  id uuid pk,
  mechanic_id uuid references minigame_mechanics(id),
  name text,                     -- e.g. 'Knight Jump', 'Bishop Laser'
  skill_tags text[],
  difficulty int
)

-- Progress
child_lesson_progress (
  id uuid pk,
  child_id uuid references children(id),
  lesson_id uuid references lessons(id),
  status text check (status in ('locked','in_progress','completed')),
  completed_at timestamptz
)

child_skill_mastery (
  id uuid pk,
  child_id uuid references children(id),
  skill_tag text,
  mastery_score numeric,        -- 0.0–1.0, updated by scoring engine
  attempts int,
  last_practiced_at timestamptz
)

puzzle_attempts (
  id uuid pk,
  child_id uuid references children(id),
  puzzle_id uuid,
  fen text,
  correct boolean,
  time_taken_seconds int,
  hint_used boolean
)

game_replays (
  id uuid pk,
  child_id uuid references children(id),
  pgn text,
  opponent_type text check (opponent_type in ('bot','boss','friend')),
  result text
)

-- Economy
child_currency (
  child_id uuid references children(id) primary key,
  coins int default 0, stars int default 0, diamonds int default 0
)

inventory_items (
  id uuid pk, key text unique, category text, -- skin/pet/decoration
  rarity text, purchasable_with_money boolean default false
)

child_inventory (
  id uuid pk,
  child_id uuid references children(id),
  item_id uuid references inventory_items(id),
  acquired_at timestamptz
)

achievements ( id uuid pk, key text unique, title text, description text,
  icon_url text )

child_achievements (
  child_id uuid references children(id),
  achievement_id uuid references achievements(id),
  earned_at timestamptz,
  primary key (child_id, achievement_id)
)

-- Social (v1.2+, structure reserved now)
friend_links (
  id uuid pk,
  child_id_a uuid references children(id),
  child_id_b uuid references children(id),
  status text check (status in ('pending_parent_approval','approved')),
  approved_by_parent_id uuid references parents(id)
)

-- Screen time / safety
screen_time_sessions (
  id uuid pk,
  child_id uuid references children(id),
  started_at timestamptz,
  ended_at timestamptz
)

ai_chat_logs (
  id uuid pk,
  child_id uuid references children(id),
  role text check (role in ('child','buddy')),
  content_summary text,   -- store summary, not raw transcript, by default
  flagged boolean default false
)
```

## Notes
- `child_skill_mastery` is the backbone of the Adaptive Learning Engine —
  everything the AI Coach references about "what this child struggles with"
  reads from here, not from ad hoc LLM memory.
- `ai_chat_logs` stores summaries by default rather than raw transcripts, with a
  `flagged` boolean for anything the content filter catches — minimizes retained
  sensitive data on minors while still giving parents a real audit trail.
- RLS: every child-scoped table policy checks `auth.uid() = parents.auth_user_id`
  via the `children.parent_id` join — a parent can only ever read their own
  children's rows; children's own session token (if they have one) is scoped
  even further to read-only on their own progress.
