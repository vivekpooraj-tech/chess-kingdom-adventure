# Chess School V2 — Handoff

**State:** complete, verified, **uncommitted** in the working tree for review. Nothing pushed.
**Build:** `npm run build` exit 0. **Tests:** `node scripts/test-chess-school-v2.js` → 631 passed, 0 failed. **Pending-work status:** see the *PENDING WORK COMPLETION REPORT* and the *MIGRATION 0043 IS LIVE* update at the end.
**Parent Lock (`02ba1b1`):** untouched — zero diff under `lib/parentLock`, `components/parentLock`, `app/chess-time`.

---

## 1. Summary

Chess School V2 is a separate, self-paced, 30-session course whose only job is the identity change *"chess is confusing" → "I am someone who plays chess."* It shares the ChessBoard, chess.js, Supabase patterns and the design system with the rest of the app, and nothing else. It does not read `content/lessons.ts`, does not touch `child_lesson_progress` or `children.current_day`, and does not reuse Kingdom zone gating.

It lives **under `/chess-school/…`** with the live V1 course page untouched at the root. That placement is deliberate — see §11.

## 2. What was already complete before this continuation

Authored and verified in the previous session:

- `content/school/types.ts` — the full content contract (step union, drills, parent-mode beats, unlocks, progress, certificate)
- `content/school/modules.ts` — 8 modules, 4 acts, 6 piece superpowers
- `content/school/sessions.ts` — **all 30 sessions authored**, 63 positions / 85 moves chess.js-verified
- `lib/school/v2/progress.ts`, `parentSummary.ts`, `access.ts`, `moves.ts`, `queries.ts`, `storage.ts`
- `components/school/v2/Coach.tsx`, `ParentModePanel.tsx`
- `supabase/migrations/0043_chess_school_v2.sql`

## 3. What was completed in this continuation

- **Audit** — re-typechecked all prior work (clean), re-verified all positions (63/85 legal), confirmed no Kingdom Journey conflict.
- **Integration decision** — discovered Parent Lock's Chess Time allow-list maps the Chess School activity to `/chess-school` + `/lesson`; moved V2 under `/chess-school/…` so no Parent Lock file needs changing (§11).
- **Routes** — classroom, session runner, graduate, parent, modules.
- **Session runner** — `SessionRunner.tsx` + all nine step types in `steps.tsx`.
- **Parent view** — `ParentView.tsx` (client, device-merged).
- **Server context** — `lib/school/v2/server.ts` (auth → child → access → progress, one place).
- **Test suite** — `scripts/test-chess-school-v2.js`, 581 assertions.
- **Two additive edits to shared files** (§10).
- **Browser verification** of sessions 1, 2, 3, 8, 13, 24, 30 and every route (§7).
- Fixes found during verification: hint-ladder off-by-one; Parent Mode board not resetting after a wrong move; big-moment card repeating the up-next session; client progress merge not preserving server-rendered state; parent page blind to device progress.

## 4. Product experience walkthrough

**Classroom** (`/chess-school/classroom`) — Ollie welcome → one button (*Start session 1* / *Continue · Session N*) → current act + module and "up next" → *Coming up · Big moment* (always strictly ahead of the next session) → *What you can do now* as earned claims → unlocked Piece Superpowers → *For parents* entry → full course map with honest locks → Graduation as a destination with sessions-to-go.

**Session** (`/chess-school/session/[id]`, full-screen, no tab bar) — chips (module, ★ Big moment), step progress bar, then the loop: **teach** (one line at a time, optional read-only board) → **guided board** (goal; hint ladder: miss 1 → hint 1, miss 2 → hint 2, miss 3 → the move; board resets after each miss) → **puzzle drill** (2–3 puzzles, two attempts each, answer revealed on the second miss; pass bar e.g. 2/3; a miss routes to *One more time, smaller* → one easier remedial puzzle → continue regardless) → **apply** (bot match with move-count goal / parent mode / pass-and-play) → **ceremony** (headline + optional share card) → **recap** (*What you can do now* + next teaser). Progress is written once, on finishing.

**Parent Mode** (session 13) — hand-over screen (*Pass the phone to your grown-up*, parent text hidden) → grown-up reveals instructions (*You're Black. Move your rook from a7 to a8…*), board flips to Black, plays it → phone back, child sees only *Fork the King and the rook* on the position the grown-up created → `Nc7+` → *You did that to a REAL person.* → *Played a Real Person* share card.

**Graduation** (session 30) — *TODAY IS GRADUATION DAY* ceremony → recap montage (three skills) → pass-and-play duel, no engine, no hints → *CHESS SCHOOL GRADUATE* ceremony + share card *"Challenge me to a game!"* → `graduatedAt` set on completion **regardless of result** (there is no result input) → *See your certificate*.

**Certificate** (`/chess-school/graduate`) — locked with an honest count until earned; then name, date, "Chess School Graduate", the skills actually taught by completed sessions, and the share card.

**For parents** (`/chess-school/parent`) — "3 of 30 sessions", *Right now* / *Learning next*, up to three *"{Name} can now …"* claims, *Try this together tonight*, per-module counts, a safety note. No percentages, no scores.

## 5. Architecture

```
content/school/          pure data — types, 8 modules, 30 sessions, superpowers, unlocks
lib/school/v2/
  progress.ts            pure rules: normalise, next, unlock, complete, drill outcome, graduation
  parentSummary.ts       skill tag → plain-English claim; practice suggestions
  access.ts              premium ∪ standalone purchase → access; free tier = 3 sessions
  moves.ts               SAN/UCI-tolerant matching via chess.js
  storage.ts             per-child localStorage mirror + union merge
  queries.ts             Supabase read/write, always falling back to the device
  server.ts              one server-side context loader for all pages
components/school/v2/
  SessionRunner.tsx      step machine; writes progress once at the end
  steps.tsx              teach / guided_board / drill+exam / bot_match / pass_and_play / ceremony / recap
  ParentModePanel.tsx    two-person, one-device coaching
  SchoolHome.tsx         the classroom
  ParentView.tsx         parent progress (device-merged)
  Coach.tsx              OllieCoach, MilestoneCard, SchoolChip
```

Key decisions:

- **Everything Ollie says is content.** Three scoped lines per session (`intro/mistake/success`) plus per-step copy. No model call anywhere in the core loop; no text input exists. The test suite asserts core code never imports the AI provider or an `/api/ollie` route.
- **Progress is earned, never inflated.** `normalizeProgress` drops unknown sessions/skills/unlocks and refuses a graduation claim not backed by session 30.
- **A child is never blocked.** Only gate is "finish the one before"; a failed drill → remedial → continue.
- **Notation-tolerant matching.** `Nc7` ≡ `Nc7+` ≡ `d5c7`; any accepted move counts.
- **Parent Mode turn convention.** Child = White, grown-up = Black, derived from the FEN's side to move and asserted in tests; the grown-up's move must produce exactly the child's position (asserted).
- **Child-safe by construction.** No chat, no messaging, no second account; Parent Mode and pass-and-play are local.

## 6. Routes created

| Route | Chrome | Purpose |
|---|---|---|
| `/chess-school/classroom` | tab bar | V2 home |
| `/chess-school/session/[sessionId]` | bare (full-screen) | session runner; server-enforces paid access |
| `/chess-school/graduate` | tab bar | certificate + share card |
| `/chess-school/parent` | tab bar | parent progress |
| `/chess-school/modules` | tab bar | 8-module overview |

`/chess-school` (V1) is unchanged except for one additive entry card linking to the classroom.

## 7. Verification

**Automated** — `node scripts/test-chess-school-v2.js`: 581/0. Covers: 30 sessions / unique ids / 8 modules; every session coherent (teach + board action, short teach lines); every FEN loads and every accepted move legal (63 positions, 85 moves); drill shape + remedial presence; progress normalisation, gating, idempotency, full-course walk, graduation win-or-lose (`completeSession` has no result parameter); WOW/unlock wiring incl. session 18 is a real mate-in-one; Parent Mode invariants; parent copy contains no IQ/%/score; Ollie scoping; separation from Kingdom Journey; migration RLS shape; access tiers; offline merge; Parent Lock untouched and V2 inside its allow-list.

Neighbouring suites re-run green: V1 Chess School 61/0, Parent Lock 57/0, Premium 59/0, School Curriculum 70/0, World 177/0. `tsc --noEmit` clean. `npm run build` exit 0.

**Browser (dev server, 411×914)** on the real dev account (free tier):
- Session 1: teach → guided (wrong move shows hint 1 + onWrong; right move → success) → recap → finish → progress `[1]`.
- Session 2: promotion `a7a8=Q` accepted → *PAWN PROMOTION* ceremony → classroom shows the superpower and *Continue · Session 3*.
- Session 3: miss/miss → answer revealed; pass; miss/miss → *One more time, smaller* → easier puzzle → *1 of 3 first time · Practised again* → finish shows *Saved on this device* (see §8).
- Session 4: server redirect to classroom; paywall card *"The first 3 sessions are free. Unlock the rest for ₹199."*
- Via a temporary probe (deleted): Session 13 Parent Mode end to end incl. wrong-move nudges on both sides; Session 8 bot match (engine replies, counter, hint text); Session 24 has **no** hint button in the DOM; Session 30 full flow to share card and `graduatedAt`.
- Parent page reflects device progress ("3 of 30", three named claims).

## 8. Database / migration status

`supabase/migrations/0043_chess_school_v2.sql` (0032 was taken; 0030–0042 exist). Adds `child_school_progress` (one row per child, RLS parent-owns-child), `school_entitlements` (select-only for the owner; no client write policy), and `parent_has_school_access(uuid)` built on the existing `parent_is_premium`. Idempotent; alters nothing existing.

**Not applied to the live database** (migrations here are a backlog, not production state). Verified graceful behaviour without it: server reads return the empty state, the client falls back to the per-child localStorage mirror, saves land on the device and the finish screen says so. When 0043 is applied, the next save upserts and everything syncs; device and server copies are union-merged so nothing finished offline is lost.

## 9. Known gaps / intentionally deferred

- **Rs 199 checkout is not built.** `school_entitlements` + `parent_has_school_access` are the hook; the classroom's *Unlock Chess School* button currently links to `/upgrade` (Premium, which includes the School). `app/api/stripe/*` untouched.
- **Graduated certificate page verified by typecheck/build only** — exercising it needs a real graduated DB row (server component, no device fallback by design so a certificate can't be conjured from localStorage).
- **Bot match "win"** is celebrated when it happens but the pass condition is a move count — confidence, not results. Pass-and-play needs ≥6 plies before *We're done* appears.
- **No LQIP/animation polish on ceremonies** beyond a fade-in; no sound.
- **Sessions are equal-depth-ish**: the ten starred sessions have the most steps; non-starred are teach → one board activity → recap. All 30 are `playable`; the `preview` status exists in the schema but no session uses it.
- **V1 → V2 switch** not made: `/chess-school` root still renders V1. Flipping it is a one-file change once V1 is retired.

## 10. Files changed

**New (untracked):** `content/school/{types,modules,sessions}.ts` · `lib/school/v2/{progress,parentSummary,access,moves,storage,queries,server}.ts` · `components/school/v2/{Coach,ParentModePanel,steps,SessionRunner,SchoolHome,ParentView}.tsx` · `app/chess-school/{classroom,parent,modules,graduate}/page.tsx` · `app/chess-school/session/[sessionId]/page.tsx` · `scripts/test-chess-school-v2.js` · `supabase/migrations/0043_chess_school_v2.sql` · this file.

**Modified (tracked), both additive:**
- `components/nav/navConfig.tsx` +2 — `/chess-school/session` added to `FORCE_BARE_PREFIXES` so the runner renders full-screen like `/lesson`.
- `app/chess-school/page.tsx` +18 — one entry card at the top linking to the classroom. V1 logic untouched.

The ten other `M` files in `git status` (`puzzles/page.tsx`, `globals.css`, `ChessBoard.tsx`, …) were modified before this work and were not touched.

## 11. Integration notes

- **Why `/chess-school/…` and not `/school`.** `lib/parentLock/activities.ts` maps the Chess Time "Chess School" activity to the prefixes `/chess-school` and `/lesson`. A V2 at `/school` would be bounced to the Chess Time hub mid-session whenever Chess Time was active. Living under `/chess-school` inherits the allow-list (and the app nav chrome) with **no Parent Lock change**. Asserted in tests.
- **Access is decided server-side** in the session route; the client-side unlock check is for session *order* only. Progress may be enriched from the device; entitlement never is.
- **Board flips for the grown-up** in Parent Mode (`playableColor="b"`), which is correct — each player sees their own side.
- Dev-only `DEV TEST MODE` badge overlaps the session's ✕ in screenshots; that's the dev badge, not the product.

## 12. Parent Lock confirmation

`git diff --stat 02ba1b1 -- lib/parentLock components/parentLock app/chess-time scripts/test-parent-lock.js` is empty. `scripts/test-parent-lock.js` passes 57/0. The one shared file Parent Lock had touched (`navConfig.tsx`) received two additive lines in a different list (`FORCE_BARE_PREFIXES`, not `APP_PREFIXES`).

## 13. Recommended next steps

1. Apply migration 0043; confirm a session save upserts and the parent page syncs across devices.
2. Decide the V1 → V2 switch: point `/chess-school` at the classroom and retire the V1 framing (its 61 tests would then go with it).
3. Build the Rs 199 checkout onto `school_entitlements` (server-side insert only) and point *Unlock Chess School* at it.
4. Device pass on the Motorola/Lenovo for the session runner at 440px board.
5. Consider a short celebratory sound/haptic on the five ceremonies.


---

# PENDING WORK COMPLETION REPORT

*Second continuation. Scope: the five pending items only. Nothing else in Chess School V2 was redesigned.*

## 1. Migration 0043 status — **NOT APPLIED; verified, hardened, ready to apply by hand**

**Live probe (2026-09-12):** `child_school_progress` → `PGRST205`, `school_entitlements` → `PGRST205`, `parent_has_school_access` → `PGRST202`. Its dependency `parent_is_premium` (0031) **is** live (`200 false` for a nil parent).

**Why it could not be applied from here:** no DB password, no Supabase access token, no linked project, no Docker/local Postgres, and the project rule (memory: *supabase-migration-application*) forbids `supabase db push` because the remote migration history is empty. Production SQL is applied by hand in the SQL Editor. This was not faked.

**What was done instead:**
- Static review against the live schema: every referenced object (`parents`, `children`, `parent_is_premium`) exists; every statement is `if not exists` / `create or replace`; nothing existing is altered.
- **Hardened while still unapplied** (same file, not renamed, no duplicate): two `CHECK` constraints on progress (`completed_sessions ⊆ 1..30`; `graduated_at` requires 30 in the list); payment-provenance columns and `revoked_at` on `school_entitlements`; `grant_school_entitlement()` / `revoke_school_entitlement()` (service-role only, idempotent per checkout session); **`merge_school_progress()`** (see §2); `parent_has_school_access()` now ignores revoked rows.
- **`scripts/verify-chess-school-migration.js`** — live probe. Read-only by default; `--write` does a real round trip on the dev child (upsert, read back, both CHECKs rejected, merge is a union, delete). Run today it prints `NOT APPLIED` and exits 1.

**Exact steps to apply:**
1. Supabase Dashboard → SQL Editor → paste the whole of `supabase/migrations/0043_chess_school_v2.sql` → Run.
2. `node scripts/verify-chess-school-migration.js --write` → expect all `ok`.
3. Finish a session in the app → the completion screen no longer says *"Saved on this device"*.

## 2. Cloud progress sync status — **architecture verified; live sync blocked only by §1**

Audit of *Motorola finishes S1 → Lenovo signs in*: `saveSchoolProgress` → `merge_school_progress` (server-side **union**, runs as the parent under RLS) → Lenovo's `loadSchoolProgress` reads the row → classroom opens S2 → parent page claims the S1 skill. All of this is executed in **test section 17** against the real client code with a fake Supabase (7 assertions), including: server unreachable → honest unsynced empty state; RPC absent → upsert fallback; a stale device can never remove a server session.

**Gap found and closed:** the original plain upsert was last-write-wins on the arrays, so two devices saving close together could drop a session. `merge_school_progress` unions every array and keeps the *earlier* `graduated_at` (`least()`); the client calls it first and only falls back to upsert on `PGRST202`.

## 3. Device fallback status — **functional, verified in the browser**

Every V2 screen (classroom, session, parent, **certificate**) merges device progress with server-rendered state on mount; completion writes the device copy first. Verified today: S1 completed on the dev account with the table absent → `cm.school.v2.<childId>` written → classroom/parent reflect it after refresh.

## 4. Graduation certificate test — **PASSED at 411×914 and 768×1024**

The page was server-only; it now hydrates like every other V2 screen (`components/school/v2/CertificateView.tsx`), so a certificate earned on-device shows before §1 is applied. Tested through the **real route** with controlled device data (no probe route; localStorage seeded for the dev child, then reset). Verified: child name, *CHESS MIND · CHESS SCHOOL* branding, *CHESS SCHOOL GRADUATE*, date (*September 12, 2026*), 24 skills (two columns on tablet), share card *"Dev Test Child / Chess School Graduate / Challenge me to a game!"*, no horizontal overflow, *Play a game* CTA. Locked state (honest count) also verified. The S30 flow (ceremony → montage → duel → ceremony → `graduatedAt`) was verified in the first continuation.

## 5. ₹199 Chess School entitlement — **BUILT, integrated, verified against Stripe test mode**

Reuses the existing architecture; nothing duplicated:
- `lib/pricing/school.ts` — India **₹199** (19900 paise); other regions fixed price points in Premium's style, all below Premium in the same currency. Flag non-INR figures before going live.
- `app/api/pricing/school` — display price (informational, like `/api/pricing`).
- `app/api/stripe/checkout-school` — separate route, `mode: "payment"`, product **"Chess School — Lifetime Access"**, UPI for INR, own success/cancel URLs.
- `app/chess-school/purchase/success` — verifies product + parent + paid with Stripe, then `grant_school_entitlement`.
- `app/api/stripe/webhook` (+40 lines, additive) — `chess_school` sessions granted **before and separately from** the Premium path; refunds call `revoke_school_entitlement` (idempotent).
- `components/school/v2/UnlockSchoolButton.tsx` — *"Chess School Lifetime Access — {price}"* with *"Or get Premium — it includes Chess School, forever"*.

**The one invariant everything hangs on:** `/upgrade/success` grants two years of **Premium** to any paid session whose `metadata.parent_id` matches the buyer, with no amount or product check. A School session therefore **never carries `parent_id`** — the parent is `school_parent_id`. Verified live: a real (test-mode) School session opened on `/upgrade/success` → *"doesn't match your account"*, no grant. Asserted in tests (section 16).

**Access matrix (verified by tests):** free → sessions 1–3; School purchase → all, `source: school_purchase`; Premium → all, `source: premium`; expired Premium / revoked School → free.

## 6. Live checkout status — **works end-to-end in Stripe test mode; live needs configuration only**

`POST /api/stripe/checkout-school` from the dev account created a real Stripe session; retrieved server-side: `livemode:false, mode:payment, amount_total:1999 usd, metadata.product:chess_school, metadata.school_parent_id set, no parent_id`, correct success/cancel URLs. All three success-page guards verified with real sessions (unpaid → "hasn't completed"; Premium session on School page → "wasn't for Chess School"; School session on Premium page → refused). The three test sessions were expired afterwards. **No payment was made.**

**To go live:** (1) apply §1; (2) `STRIPE_SECRET_KEY` = live key; (3) the existing webhook endpoint already receives `checkout.session.completed` / `charge.refunded` — no new endpoint needed; (4) enable UPI on the Stripe account for INR; (5) confirm non-INR price points.

## 7. What could not be tested

- Applying 0043 and the `--write` round trip (no DB access — §1).
- A paid School purchase → grant → cross-device access (needs §1 plus a real or test payment).
- Cross-device on physical Motorola/Lenovo (needs §1; the data path is test-covered, §2).
- The S30 route on the free dev account (server-side paywall; verified via probe in the first continuation).

## 8. Commands and results

```
node scripts/test-chess-school-v2.js          → 631 passed, 0 failed
node scripts/test-chess-school.js             → 61 passed, 0 failed   (V1)
node scripts/test-parent-lock.js              → 57 passed, 0 failed
node scripts/test-premium-entitlement.js      → 59 passed, 0 failed
node scripts/test-world.js                    → 177 passed, 0 failed
node scripts/test-school-curriculum.js        → 70 passed, 0 failed
node scripts/verify-chess-school-migration.js → NOT APPLIED (PGRST205 / PGRST205), exit 1   (expected)
npx tsc --noEmit                              → clean
```

## 9. Build

`npm run build` exit 0; routes include `/chess-school/purchase/success`, `/api/stripe/checkout-school`, `/api/pricing/school`.

## 10. Files changed in this continuation

**New:** `lib/pricing/school.ts` · `app/api/pricing/school/route.ts` · `app/api/stripe/checkout-school/route.ts` · `app/chess-school/purchase/success/page.tsx` · `components/school/v2/UnlockSchoolButton.tsx` · `components/school/v2/CertificateView.tsx` · `scripts/verify-chess-school-migration.js`

**Modified (V2 files):** `supabase/migrations/0043_chess_school_v2.sql` (hardened, not renamed) · `lib/school/v2/{queries,access,server}.ts` · `components/school/v2/SchoolHome.tsx` · `app/chess-school/graduate/page.tsx` · `scripts/test-chess-school-v2.js` (+50 assertions)

**Modified (shared, additive):** `app/api/stripe/webhook/route.ts` (+40). Cumulative shared edits since `02ba1b1`: webhook +40, `app/chess-school/page.tsx` +18, `navConfig.tsx` +2 — insertions only.

**Not touched:** `app/api/stripe/checkout`, `app/api/stripe/validate-promo`, `app/upgrade/success` (its uncommitted 2-line diff is the owner's), `lib/premium/*`, all Premium pricing.

## 11. Parent Lock — untouched

`git diff 02ba1b1 -- lib/parentLock components/parentLock app/chess-time scripts/test-parent-lock.js` is empty; suite 57/0.

## 12. Chess School V1 — unchanged

`content/lessons.ts`, `/lesson/[dayId]`, `lib/school/chessSchool.ts`, `curriculum.ts`, `kingdomZones.ts`, `CourseJourney`, `GraduationPanel` all show no diff; V1 suite 61/0. `/chess-school` root still renders V1 (plus the one additive entry card from the first continuation).

---

## LAUNCH READINESS

**READY NOW**
- Chess School V2 product: 30 sessions, runner, mastery/remedial, Parent Mode, pass-and-play, Graduation, certificate, parent page — verified in browser, 631/0 tests, build green.
- Device-only progress (fully working without the migration; every screen honest about it).
- Free tier (sessions 1–3) and the paywall card with region-correct price.
- Stripe integration code for the ₹199 SKU, verified against Stripe test mode, with the Premium-redemption hole closed and tested.
- All protected systems green: Parent Lock 57/0, V1 61/0, Premium 59/0, World 177/0.

**REQUIRES MANUAL DEVICE TESTING / PRODUCTION CONFIGURATION**
- **Apply migration 0043** in the SQL Editor, then `node scripts/verify-chess-school-migration.js --write`. Until then: no cloud sync, no cross-device progress, and no purchase can be recorded.
- Switch `STRIPE_SECRET_KEY` to live; enable UPI on the Stripe account; confirm the non-INR School price points.
- One real test purchase end-to-end (checkout → success page → `school_entitlements` row → all 30 sessions open → same account on a second device).
- Physical Motorola → Lenovo progress hand-off once 0043 is live.
- Product decision, unchanged: when to flip the `/chess-school` root from V1 to the classroom.


---

# UPDATE — MIGRATION 0043 IS LIVE (2026-09-12)

The owner applied `0043_chess_school_v2.sql` in the SQL Editor. This supersedes §1–§3 and the first blocker in *Launch Readiness* above.

**`node scripts/verify-chess-school-migration.js --write` → 18 passed, 0 failed.** Both tables and every column; `parent_has_school_access`, `grant_school_entitlement`, `merge_school_progress`, `revoke_school_entitlement` all present; anon reads zero rows and cannot call the grant; upsert + read-back; both CHECK constraints reject bad data (session 99; `graduated_at` without 30); the merge is a union (`[1,2] + [1,3] → [1,2,3]`, skills and unlocks from both sides); round-trip row deleted.

**Live cloud sync, verified in the browser on the dev account:**
1. Completed Session 2 through the real runner → finish screen **no longer** says *"Saved on this device"* → the save went through `merge_school_progress`.
2. Service-role read of `child_school_progress` for the child: `completed_sessions [1,2]`, `skill_tags [board_setup, pawn_movement, pawn_promotion]`, `updated_at 08:37:28Z`.
3. **Second-device simulation:** wiped every `cm.school.v2.*` key and reloaded → classroom shows *Continue · Session 3*, the Pawn Promotion superpower and three earned claims, all sourced from the server; the device mirror was re-populated from the cloud row.
4. Parent page on the wiped device: *2 of 30 sessions*, three *"Dev Test Child can now …"* claims, module 2 current — read through the parent's own RLS session, not the service role.

**Status of the pending items after this update:**

| Item | Status |
|---|---|
| 1. Migration 0043 | **Applied and verified live (18/18)** |
| 2. Cloud progress sync | **Verified live** — save, server row, reload-from-cloud, parent read |
| 3. Device fallback | Still functional (unchanged); now a mirror rather than the only store |
| 4. Certificate | Verified (previous section) |
| 5. ₹199 entitlement | Code verified against Stripe test mode; **`school_entitlements` + grant/revoke now exist in production**, so a live purchase would be recorded |
| 6. Live checkout | Needs the live `STRIPE_SECRET_KEY`, UPI enabled on the account, non-INR prices confirmed |

**Launch readiness, revised**

READY NOW — everything in the earlier list, **plus** cloud progress and cross-device sync, and the database side of purchases.

REQUIRES MANUAL DEVICE TESTING / PRODUCTION CONFIGURATION — live Stripe key + UPI + price confirmation; one real end-to-end purchase; a physical Motorola → Lenovo hand-off (the data path is now proven live, only the hardware pass remains); the V1 → V2 root flip decision.
