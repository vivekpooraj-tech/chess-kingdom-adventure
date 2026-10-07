# Chess Mind — handoff

Next.js 14 (App Router) + Supabase + Capacitor Android wrapper. Production: www.chessmind.club (Vercel project `chess-kingdom-adventure`, team `vivyam`). **One Supabase project is shared by dev and prod** — treat every write as production.
Branch: `release/worlds-integration` (production is deployed from it).

## What this session did
Three "worlds" (Enchanted Kingdom `html[data-mode="kids"]`, Master Training Atelier `data-mode="adult"`, Classic Pro = no attribute) were integrated across the product, then:
- World-aware shell, Home, Play, Academy, Train Your Mind, Profile, Discover, World, Customize.
- Onboarding: companion picker (4 characters) and a single-guide screen ("Meet Ollie").
- **Chess play is free for everyone**: removed the multiplayer "2 free games" UI/paywall; computer chess is free too. Premium = extra learning/features only (Tactics lessons etc.). Server side: migration `0047_remove_free_game_daily_limits.sql` (live).
- Online game **move review** (Prev / Next / Return to Live, read-only while reviewing).
- **Mobile bottom nav**: Play button above `Home | School | Puzzles | Watch | Profile`. Watch is a disabled "Soon" placeholder; World is no longer a bottom tab (route `/world` and desktop sidebar unchanged).

## Status
Finished, committed, pushed and deployed (latest feature commit `7fe32c6`): everything above.
The world-aware redesign of Academy, Train Your Mind and Profile (earlier "Stage 1–4" work: `WorldScope`/`WorldBranch` plus `app/world-*.css`) is **already in `7fe32c6`** (see `10b8ba7`); it is not pending anywhere.
Half-done / not done:
- **Watch** is a stub only (disabled button, no route).
- Dormant constants `aiGamesPer24h` / `multiplayerGamesPer24h` in `lib/premium/capabilities.ts` are unused; developer comments in `lib/supabase/queries.ts` still mention "2 free multiplayer games".
- `components/upgrade/GameLimitPaywall.tsx` is a safety-net Premium prompt; the server never denies a computer game now.
- `supabase/migrations/0052_matchmaking_queue_game_fk_cascade.sql` is committed but **not verified as applied**. Probe the DB before assuming; never `supabase db push` (repo migrations are a backlog, not production state).
Known quirks (pre-existing):
- In Atelier and Classic, `/puzzles` is a full-screen drill and the bottom bar is hidden on purpose.
- Vercel CLI sometimes returns "Not authorized" once (no deployment created); an identical retry works.
- `next build` can fail once on `next/font` after `rm -rf .next`; retry once.
- `ChessFocusLayout` parses `--bottom-nav-h` with `parseFloat` (reads rem as px in one fallback path); bar is now 7rem.
- Production signed-in smoke was not done for the nav/multiplayer changes (needs a login); browser QA ran on local dev only.

## Next steps (priority order)
1. Signed-in production smoke on a phone: bottom bar + Play, online game move review, matchmaking has no "free games" text.
2. Decide whether `0052` should be applied; verify with a read-only probe first.
3. Clean stale copy: the dormant constants/comments listed above.
4. Decide Watch's real destination, or keep it as a placeholder.
5. Android: rebuild/sync (`npm run cap:sync`), re-validate on device (see `DEVICE_VALIDATION_REPORT.md`).

## Structure
- `app/` routes: `(tabs)/home|learn|more|play|puzzles`, `academy`, `chess-school`, `chess-mind`, `profile`, `discover`, `world`, `free-play`, `matchmaking`, `online/[gameId]`, `onboarding/*`, `api/*` (Stripe, AI). Per-world CSS: `app/world-shell.css`, `worlds.css`, `world-*.css` (all imported in `app/layout.tsx`).
- `components/nav/` — `AppShell` (persistent frame), `PrimaryNav` (phone/tablet bottom bar), `SideNav` (desktop), `navConfig.tsx` (`NAV_ITEMS` desktop, `PHONE_NAV_ITEMS` phone).
- `components/chess/` (`ChessBoard`, `ChessFocusLayout` board-sizing contract), `components/upgrade/` (paywalls, `UpgradeButton`), `components/multiplayer/`, `components/onboarding/`.
- `lib/supabase/` queries + clients (cookie sessions via `@supabase/ssr`), `lib/premium/` entitlements, `lib/parentLock/` Chess Time / Parent Lock, `content/` static data (puzzles, buddies, lessons).
- `supabase/migrations/` SQL backlog; `android/` Capacitor project (remote-URL WebView); `scripts/` tests and tooling.
- Product rules: playing chess is free; don't change pricing, auth, age/Parent Gate, or gameplay without an explicit ask.

## Commands
```bash
npm install            # also copies Stockfish into public/stockfish
npm run dev            # http://localhost:3000
npx tsc --noEmit
npm run build          # do not run while the dev server is running
npm run lint
npm run cap:sync       # Android sync (cap:sync:dev for the dev URL)
# tests (plain node scripts; "browser" ones need `npm run dev` on :3000, Chrome, and the dev-test account)
node scripts/test-premium-entitlement.js
node scripts/test-phase4-entitlement-gating.js
node scripts/test-entitlement.js
node scripts/test-navigation-home.js
node scripts/test-chess-focus-fit.js
node scripts/test-mobile-nav-browser.js
node scripts/test-online-review-browser.js
node scripts/test-world-shell-browser.js
node scripts/verify-puzzles.js --pool     # after editing content/puzzles.ts
```
Deploy: from a clean git worktree, `npx vercel@latest deploy --prod --yes --cwd <worktree>` (needs the `.vercel` link copied in).

## Environment variables (names only; see `.env.local.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`.
Also read in code: `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OLLIE_AI_PROVIDER`, `CRON_SECRET`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_LOCAL_TEST_MODE`.
Test scripts: `DEV_TEST_USER_EMAIL`, `DEV_TEST_USER_PASSWORD`, `DEV_TEST_CHILD_ID`, `CHROME_PATH`, `PLAY_BASE`.
Real values live only in the gitignored `.env`, `.env.local`, `.env.production.local` — never commit them.

## Not in git (local only)
(`android/gradle.properties` IS tracked; its committed version is the canonical one — don't commit machine-specific JDK paths into it.) `.a3-deploy/`, `.a4-release/`, `.a5-candidate/` (full repo copies with their own `.git`/`.vercel`), `device-validation/` (APKs, screenshots), `qa-evidence/`, `tablet-test-screenshots/`, `android/.idea/`.
