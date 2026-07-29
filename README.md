# Chess Kingdom Adventure — v1 Slice (4-day build)

This is the working, buildable slice of Chess Kingdom Adventure scoped for a
4-day build: one AI buddy (Ollie the Owl), one full lesson day (Day 1, the
Pawn Crystal), a real chess-rules board, one reusable mini-game engine, and an
AI chat wired to Claude (with a mock fallback so it runs with zero setup).

**Verified:** `npm install && npm run build` completes with a clean TypeScript
compile and no errors — this is real, running code, not a mockup.

## Set up Supabase (required — auth is real now)
1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the SQL Editor, paste and run `supabase/migrations/0001_init.sql`. This
   creates `parents`/`children`/`child_lesson_progress` with RLS enabled, plus
   a trigger that auto-creates a parent row on signup.
3. In **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` to the Redirect URLs allow-list (and
   your production URL once deployed).
4. In **Authentication → Providers**, confirm Email is enabled (it is by
   default) — that's all v1 needs. Google/Apple OAuth use the same
   `supabase.auth.signInWithOAuth()` call but need an OAuth app registered
   with each provider first; that's an account-setup task for whoever owns
   those developer accounts, not a code change.
5. Copy `.env.local.example` to `.env.local` and fill in your project's URL +
   anon key (Project Settings → API).

## Run it locally
```bash
npm install
npm run dev
# open http://localhost:3000
```

Sign-in uses a magic link — enter an email, check your inbox, click the link.
Supabase's local dev/test setup can also route magic links to the [Inbucket
inbox](https://supabase.com/docs/guides/local-development) if you're using the
Supabase CLI instead of a hosted project.

No `ANTHROPIC_API_KEY` is required to try it — the AI buddy chat falls back to
friendly mock replies if it's unset.

## What's actually implemented
- Splash → **real magic-link sign-in** → **parent gate** (math challenge) →
  Avatar picker → Buddy picker (5 of 6 buddies shown as "coming soon" — only
  Ollie the Owl is fully built, per the v1 scope call)
- **Every choice persists to Postgres**, not `localStorage`: avatar, buddy,
  and lesson completion all write through `lib/supabase/queries.ts`, scoped
  by Row Level Security so a parent can only ever read/write their own
  child's row.
- Kingdom Map hub — now a Server Component reading real progress; Day 1
  shows 💎 once actually completed, Day 2 unlocks automatically.
- Full Day 1 lesson loop: Story → Mini-game (Pawn Race, on the reusable
  `DragToTarget` engine) → Puzzle (real chess.js board) → AI chat with Ollie →
  Mini Match (3-move duel) → Reward — and finishing it now calls
  `markLessonComplete()`, which both records the completion and advances
  `children.current_day`.
- A real, rules-correct chess board (`components/board/ChessBoard.tsx`) using
  `chess.js` — legal-move highlighting, check/checkmate detection, click-to-move
  interaction (chosen over drag-and-drop for touch reliability on small hands).
- 50-entry mini-game catalog (`content/minigame-catalog.ts`) mapped onto 6
  reusable mechanic engines — only `DragToTarget` has a built component so far.

## What's intentionally stubbed (by design, not oversight)
- **Multiple children per parent:** this slice supports exactly one child
  profile per account (`getOrCreateChild` always returns/creates a single
  row). The DB schema already supports many children per parent — add a
  profile switcher UI when that's actually needed.
- **Payments:** no Stripe integration yet — Day 11+ paywall is Phase 2.
- **Parent dashboard / screen time enforcement:** the `screen_time_*` columns
  exist on `parents` but nothing reads/enforces them yet.
- **Stockfish / real bot opponent:** the Mini Match step counts moves rather
  than playing against an engine.
- **`MemoryFlip` and `TimedReaction` engines:** referenced in the mini-game
  catalog, not yet built as components — only `DragToTarget` runs today.

## Next steps to extend past Day 4
1. Build the `MemoryFlip` and `TimedReaction` mini-game engine components.
2. Add the Stockfish Web Worker for real bot play in Mini Match.
3. Build Days 2–10 as additional entries in `content/lessons.ts`.
4. Parent dashboard reading `child_lesson_progress` + screen-time enforcement.
5. Deploy: `vercel deploy`, plus set the same env vars in the Vercel project
   and add the production callback URL to Supabase's redirect allow-list.

## Project structure
See `docs/06-folder-structure.md` for the intended full structure; this slice
implements the `app/`, `components/`, `content/`, and `lib/types.ts` portions
of it directly (skipping the monorepo/`packages/` split until there's a second
app that needs to share code).
