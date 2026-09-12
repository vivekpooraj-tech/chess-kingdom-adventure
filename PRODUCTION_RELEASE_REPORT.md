# Production Release Report

## 1. Release date

2026-09-12

## 2. Commit hash

`ff320eedb6d090848c877c75f838cf6e0007f40e`

## 3. Branch deployed

`master` (pushed directly — `02ba1b1..ff320ee`, fast-forward, no force-push, no rebase)

## 4. Features included

- **Chess School V2** — the 30-session self-paced classroom, additive alongside the existing Kingdom Journey (`/lesson/[dayId]`), with its own progress/entitlement model, a standalone Stripe checkout (`app/api/stripe/checkout-school`), a webhook branch that grants/revokes the School entitlement independently of Premium, and a graduation flow with a certificate. Migration `0043_chess_school_v2.sql` — **already applied and verified live prior to this release**, not re-applied here.
- **Puzzle Tower** — the new `/puzzles` hero screen: five Easy→Master floors driven by the child's real lifetime solved-puzzle count, a progress panel, and a one-time unlock celebration. Purely a visual progression layer over the unchanged puzzle-selection/economy/stats systems.
- **Parent Lock / Chess Time** — already live in commit `02ba1b1`; nothing new to ship. Included in this release only as a verified, still-passing regression suite (57/0), confirming this release does not regress it.

## 5. Files committed (27 paths, 44 files changed)

Modified:
- `app/(tabs)/puzzles/page.tsx`
- `app/api/stripe/webhook/route.ts`
- `app/chess-school/page.tsx`
- `components/nav/navConfig.tsx`
- `components/puzzles/TacticsTrainer.tsx`

Added:
- `app/api/pricing/school/route.ts`
- `app/api/stripe/checkout-school/route.ts`
- `app/chess-school/classroom/page.tsx`
- `app/chess-school/graduate/page.tsx`
- `app/chess-school/modules/page.tsx`
- `app/chess-school/parent/page.tsx`
- `app/chess-school/purchase/success/page.tsx`
- `app/chess-school/session/[sessionId]/page.tsx`
- `components/puzzles/PuzzleTower.tsx`
- `components/school/v2/` (8 files: CertificateView, Coach, ParentModePanel, ParentView, SchoolHome, SessionRunner, UnlockSchoolButton, steps)
- `content/school/` (modules.ts, sessions.ts, types.ts)
- `lib/pricing/school.ts`
- `lib/puzzles/puzzleLevels.ts`
- `lib/school/v2/` (9 files: access, moves, ollieLines, parentSummary, progress, queries, resume, server, storage)
- `scripts/test-chess-school-v2.js`
- `scripts/test-puzzle-levels.js`
- `scripts/verify-chess-school-migration.js`
- `supabase/migrations/0043_chess_school_v2.sql`
- `CHESS_SCHOOL_10_OUT_OF_10_HANDOFF.md`, `CHESS_SCHOOL_11_OUT_OF_10_HANDOFF.md`, `CHESS_SCHOOL_V2_HANDOFF.md`, `PUZZLE_TOWER_HANDOFF.md`

## 6. Files deliberately excluded (left uncommitted in the working tree)

Unrelated, unfinished work from a separate effort, not part of this release:
- `app/globals.css`, `components/board/ChessBoard.tsx` — an in-progress piece-slide-animation rewrite. (Note: the prior Parent Lock deployment explicitly excluded this exact same `globals.css` change for the same reason — this is a persistent, long-standing WIP, not new.)
- `app/minigame-demo/page.tsx`, `app/onboarding/avatar/page.tsx`, `app/onboarding/buddy/page.tsx`, `app/upgrade/success/page.tsx`, `components/chessMind/RevealChallenge.tsx`, `components/game/GameEndOpeningSummary.tsx` — redundant `tone="adventure"` added to `<Button>` calls; `Button`'s own default is already `"adventure"`, so these are no-op edits from an abandoned pass.
- `APPLY_PHASE2_SQL.sql` — an unrelated manual matchmaking-database fix guide (0040/0041), already applied per the file's own header; unconnected to this release.

Mobile Hardening / Device Validation artifacts (a separate, undocumented-as-complete effort):
- `DEVICE_VALIDATION_LOCAL_DEV.md`, `DEVICE_VALIDATION_REPORT.md`, `MOBILE_HARDENING_REPORT.md`
- `device-validation/`, `tablet-test-screenshots/` (screenshots and raw test artifacts)

Planning / historical documentation, not application code:
- `docs/CHESS_SCHOOL_BUILD_PROMPT.txt` (the original build brief)
- `PARENT_LOCK_DEPLOYMENT_REPORT.md` (documents the already-committed `02ba1b1` release, not this one)

Correctly gitignored throughout, never at risk: `.next/`, `node_modules/`, `.env*`.

No secrets were found in, or committed with, any file in this release.

## 7. Test results

```
node scripts/test-chess-school-v2.js       → 892 passed, 0 failed
node scripts/test-parent-lock.js           → 57 passed, 0 failed
node scripts/test-puzzle-levels.js         → 103 passed, 0 failed
node scripts/test-puzzle-economy.js        → 24 passed, 0 failed
node scripts/test-puzzle-encouragement.js  → 49 passed, 0 failed
node scripts/test-puzzle-stats.js          → 35 passed, 0 failed
node scripts/test-puzzle-themes.js         → 43 passed, 0 failed
node scripts/test-chess-school.js          → 61 passed, 0 failed
node scripts/test-premium-entitlement.js   → 59 passed, 0 failed
node scripts/test-world.js                 → 177 passed, 0 failed
node scripts/test-school-curriculum.js     → 70 passed, 0 failed
node scripts/test-move-validation.js       → 40 passed, 0 failed
```
**Total: 1,610 checks, 0 failures.**

## 8. TypeScript result

`npx tsc --noEmit` → clean, no errors.

## 9. Production build result

`npm run build` → succeeded. All 98 static/dynamic routes generated, including every new Chess School V2 route and the updated `/puzzles` and `/puzzles/tactics`. No build warnings beyond Next.js's routine output.

## 10. Supabase compatibility check

- Migration `0043_chess_school_v2.sql` was **not** reapplied, modified, or pushed via `supabase db push` — per instruction and standing project practice (migrations here are a backlog, not a command to replay). It was confirmed already applied and verified live prior to this session (via `scripts/verify-chess-school-migration.js`, run in an earlier session — 10/10 checks passed).
- `test-premium-entitlement.js` (run again in this session) independently confirms the schema the application expects is live: `daily_challenge_puzzles` still has its expected 1000 rows and `puzzle_library_solves` (the table both puzzle trainers write to, and the one Puzzle Tower reads for its lifetime count) is intact.
- No new migration was created. No genuine production blocker was discovered that would have required one.

## 11. Production URL

https://chess-kingdom-adventure-opal.vercel.app

Deployment triggered automatically by the `git push` to `master` (existing Vercel Git integration — nothing manually configured or modified). Confirmed via GitHub's commit-status API: the Vercel check on commit `ff320ee` moved from `pending` ("Vercel is deploying your app") to `success` ("Deployment has completed") within roughly 30 seconds of the push.

## 12. Production verification results

Checked against the live URL after deployment completed:

| Check | Result |
|---|---|
| Home page loads | ✅ HTTP 200, `<title>Chess Mind</title>` |
| `/sign-in` loads | ✅ HTTP 200 |
| `/puzzles`, `/puzzles/tactics` resolve | ✅ Route exists — 307 to `/sign-in?next=...` (auth-gated, expected) |
| `/chess-school`, `/chess-school/classroom`, `/graduate`, `/modules`, `/parent`, `/session/[id]` resolve | ✅ All exist — 307 to sign-in (auth-gated, expected) |
| `/api/pricing/school`, `/api/stripe/checkout-school` resolve | ✅ Exist — 307 to sign-in, **identical behavior to the pre-existing `/api/pricing` and `/api/stripe/checkout`** (confirmed side-by-side), so this is the app's standing middleware behavior, not a regression |
| No 404s or 500s on any route checked | ✅ |
| No obvious build/deploy errors | ✅ Vercel status API reports a clean `success` deployment |

**What I could not verify directly on production, and why:** every in-app screen this release actually changes — the Puzzle Tower's rendering and real-data progression, the full-screen puzzle board hiding/restoring the bottom nav, the Chess School classroom content, Parent Lock's screens — sits behind this app's sign-in gate. I do not have production sign-in credentials, and creating or entering account credentials is outside what I'll do without you present to authorize and complete it (entering passwords/credentials is something I don't do on your behalf).

In place of that, this release's authenticated behavior was verified **against the identical, just-committed code**, run in genuine production mode (`next start` against the same `npm run build` output that shipped), in the browser, immediately before pushing:
- `/puzzles` → Puzzle Tower renders with real solved-count data, correct current-floor highlighting, correct "N more to unlock" math, at 375×812, 411×914, 768×1024, and desktop, with zero horizontal overflow at any size.
- "Solve a Puzzle" → opens the existing full-screen board with the bottom nav hidden; Exit → returns to `/kingdom-map` with the bottom nav restored. Confirmed on both `/puzzles` and `/puzzles/tactics`.
- `/chess-school` and `/chess-school/classroom` → render correctly with real per-child progress ("Continue · Session 3").
- `/parent-dashboard/parent-lock` → renders correctly, no overflow.

If you'd like a true live-production pass on the authenticated screens, the direct way is for you to sign in on https://chess-kingdom-adventure-opal.vercel.app and check `/puzzles`, a puzzle solve, and `/chess-school/classroom` yourself — that closes the one gap this report has.

## 13. Known limitations (carried from the underlying feature handoffs)

- Chess School's non-India regional prices (`lib/pricing/school.ts`: $19.99 / £16.99 / €18.99 / CA$26.99 / AU$29.99) are explicitly flagged in the code itself as placeholders "in the same sense the Premium ones are" — flagged for review before relying on them outside India. This does not block deployment of the feature; India pricing (₹199) is the requested, deliberate price point.
- Puzzle Tower's "✨ LEVEL UNLOCKED!" celebration is tracked per-device (`localStorage`), not per-child — on a shared device with multiple child profiles it could show or miss a celebration banner. It never affects real progress data, only whether a one-time banner is shown. (See `PUZZLE_TOWER_HANDOFF.md` §12.)
- Puzzle Tower's unlock-celebration crossing logic is unit-tested (`scripts/test-puzzle-levels.js`) but was not exercised end-to-end by actually solving 11+ puzzles in one sitting, since the test account is on the free tier's 3-puzzles/day cap.
- Chess School V2's checkmate-freeze mechanic (Session 18) is generic to any guided-board checkmate, not scoped specifically to that session — a documented, low-probability edge case (see `CHESS_SCHOOL_11_OUT_OF_10_HANDOFF.md` §12).

## 14. Features intentionally not included

- **The unrelated ChessBoard/globals.css piece-slide-animation rewrite** and its five downstream `Button` no-op edits — not one of the three named features for this release, not requested, and (for the `Button` edits) not even a functional change. Left in the working tree, untouched, for separate review.
- **The Mobile Hardening / Device Validation effort** (its own reports and screenshots) — a distinct, separately-scoped body of work with no explicit completion signal for this release; left out entirely.
- **The Phase 2 matchmaking reliability fix** (`APPLY_PHASE2_SQL.sql`) — unrelated to Chess School V2, Parent Lock, or Puzzle Tower; its own migrations (0040/0041) are already committed and, per the file's own notes, already applied — this file is a leftover manual-apply guide, not new work, and was left uncommitted.

---

**Deployment status: SUCCESSFUL.** Commit succeeded, push succeeded, Vercel deployment reached `success`, and production was verified to the extent possible without authenticated access (see §12 for the exact boundary of what was and wasn't checked live).
