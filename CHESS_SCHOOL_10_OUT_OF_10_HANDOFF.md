# Chess School V2 — 10/10 Polish Pass Handoff

**State:** uncommitted in the working tree. Nothing pushed. Migration 0043 untouched (last modified 13:58, before this pass began).
**Gates:** V2 suite **846 passed, 0 failed** (up from 631) · V1 61/0 · Parent Lock 57/0 · Premium 59/0 · World 177/0 · curriculum 70/0 · move validation 40/0 · migration verifier 10/0 (read-only) · `tsc` clean · `npm run build` exit 0.

---

## 1. Executive summary

This pass did not add features. It fixed the ways a child could get stuck or confused, made every session earn its place, gave Ollie a voice that doesn't repeat itself, and made the parent page say exactly what the brief asked for. Two real bugs were found by the chaos test that no type check would have caught. Everything was verified in the browser at 411×914 and 768×1024, on the live cloud-synced dev account.

The single most important change: **a refresh, a sleeping tablet, or a stray tap no longer sends a child back to step one.** That was the most likely reason a seven-year-old would give up mid-lesson, and it is gone.

## 2. Product improvements made

| Area | Change | Why it matters to a child |
|---|---|---|
| Resume | Step bookmarked on the device; restored on reopen with *"You were in the middle of … Picking up right there."*; cleared on finish | "It made me start again" is how young children quit |
| Next action | Finish screen offers **Next: {title}** directly, with minutes; classroom is secondary | One clear next thing, not a menu |
| Mistakes | Illegal taps get a nudge (*"That piece can't go there…"*); wrong moves rotate through four lines; success recognises *how* it was solved (first try / second look / "learning out loud") | Mistakes feel safe and specific, never scolding |
| Revealed answers | The solution is now **shown on the board**, not only named (*"It was exd5 — it's on the board now"*) | A child who can't read notation still sees the idea |
| Whose turn | Bot games show **Your move / Opponent is thinking…** at all times | The #1 way a game "gets stuck" |
| Session depth | Eight thin sessions gained real practice (§4) | No "10 great lessons + 20 filler lessons" |
| WOW moments | First full game gets a ceremony; starred sessions get a gold header wash; sharper lines at Fork Master and First Checkmate (§6) | These must *look* different before a word is read |
| Parent page | **CAN NOW / CURRENTLY LEARNING / NEXT**, full skill list (§7) | Readable in seconds by a non-chess parent |
| Paywall | States what the purchase includes; no pressure language (§10) | Understand what, why, how much |
| Tablet | Board 440 → 520, still width-clamped on phones (§8) | Tablets stop showing a phone board in a wide column |

## 3. Child Chaos Test findings

Performed against the real dev account with cloud sync live.

| Behaviour | Result | Action |
|---|---|---|
| Refresh mid-session (step 3 of 5) | **Was:** back to step 1. **Now:** resumes at step 3 with an Ollie line | Fixed — `lib/school/v2/resume.ts` |
| Two consecutive guided boards | **BUG FOUND:** React reused the component instance, so board 2 opened already "solved" with a Continue button | Fixed — every step keyed by `step.id` in the runner; asserted in tests |
| Illegal tap (rook through a pawn) | **Was:** silent. **Now:** *"That piece can't go there. Tap it again and look at where it lights up."* | Fixed — `onIllegalAttempt` wired on guided boards and puzzles |
| Four wrong moves in a row | Four different lines, hint ladder climbs 1→2→3, board resets each time | Verified |
| Second miss on a puzzle | Answer shown on the board, counted as a miss, drill continues | Verified |
| Double-tap Finish | `completeSession` is idempotent; one completion, one unlock | Already true; tested |
| Browser back mid-session | Returns to classroom; bookmark keeps the step | Verified |
| Open a future session by URL | *"Not yet — finish session N first"* with one button | Already true |
| Free account opens session 4 | Server redirect to classroom → unlock card | Already true |
| Pass-and-play: whose turn | White/Black pills; bot: Your move/Opponent thinking | Verified |
| Leave halfway, switch device | Session restarts on the other device (bookmarks are per-device by design); cloud record untouched | By design, documented |

Not fixed, by decision: a child can end pass-and-play after six plies. It is a game between two humans in the room; the app is not the referee.

## 4. Session quality improvements

Audit result before: sessions 1, 2, 5, 6, 7, 9, 19, 23, 26 were *teach → one guided move → recap*. Every session now has **at least two board activities** (a drill counts its puzzles; a game counts two), enforced by test:

| Session | Added |
|---|---|
| 1 Welcome | Second guided board (*Black answers — now you again*, teaching turn-taking) + *YOU MADE YOUR FIRST CHESS MOVE* ceremony |
| 2 Pawn | 3-puzzle drill: two squares first, one after, promotion |
| 5 Bishop | 3-puzzle drill incl. a trick position (queen on a straight line — "Bishops don't do straight lines") |
| 6 Rook | 3-puzzle drill incl. a trick (own King blocks the rail) |
| 7 Queen & King | 3-puzzle drill: Queen as Bishop, Queen as Rook, King captures |
| 9 Check | 3-puzzle drill: check with Queen, Knight, Bishop |
| 10 First game | **Ceremony** (WOW 1 had none) |
| 19 Castling | 3-puzzle drill: short, long, one side blocked |
| 23 King safety | 3-puzzle drill from real opening positions |
| 26 Endgame | 3-puzzle drill: pawn behind King, promotion, Queen check |

All new positions chess.js-verified (**82 positions / 133 moves** now under test). One authored position was illegal (black queen giving check made every bishop move illegal) — caught by the suite, fixed.

## 5. Ollie improvements

New `lib/school/v2/ollieLines.ts`: curated lines for the moments content can't know in advance, chosen by **count, not random** (deterministic, testable). Success lines rotate (*"You didn't guess. You spotted it." → "Again. That's not luck…" → "Three for three…"*); miss lines rotate and never say "wrong"; perseverance is recognised separately from first-try success; game endings distinguish win / draw / loss and hints / no hints (*"You won it with nobody helping"*). The teach step no longer echoes the previous card in the coach bubble. Tested: four successes → four distinct lines; misses never contain "wrong/bad/incorrect".

## 6. WOW moment improvements

1. **First full game (S10)** — now has a ceremony: *YOU PLAYED A WHOLE GAME OF CHESS*. Turn indicator and progress lines during the game.
2. **Fork Festival (S12)** — gold header wash; ceremony line now *"This is the trick grown-ups fall for. Who gets it first — Papa, Mama, or a friend at school?"*
3. **First Checkmate (S18)** — ceremony now says it out loud: *"Check says: careful. Checkmate says: it's over. You just told him it was over."* Revealed answers show the mating position on the board.
4. **Win Without Hints (S24)** — no hint button in the DOM (already); win line now names independence; progress lines never hint.
5. **Graduation (S30)** — unchanged; verified again. Win or lose, graduates.

All five carry a ceremony (asserted). Starred sessions get the header wash.

## 7. Parent UX improvements

Parent page now reads, in order: **{NAME} CAN NOW** (every earned skill, capitalised phrases) → **CURRENTLY LEARNING** (skill phrase · session) → **NEXT** (the session after) → *Try this together tonight* → module counts → safety note. Verified with 11 sessions done: 12 skills, *Play a fork…* current, *Try Your Fork on a Real Person* next. No percentages, no scores (asserted).

## 8. Mobile / tablet improvements

- Board request 440 → **520**; the board clamps itself, so 768×1024 shows 520px (was 440 in a 576 column) and 411×914 stays 379px. No horizontal overflow at either size (measured).
- Parent Mode board uses the same size.
- Session runner: starred header wash is inside the runner's stacking context (`relative isolate`), so it cannot paint over anything.

Not done: no separate two-column tablet layout. The single column at 576px with a 520px board reads well and a redesign was out of scope.

## 9. Cloud sync verification

Live, on the dev account: session finished → cloud row updated → local keys wiped → classroom/parent restored from the server. Temporary test data (a `source='grant'` entitlement and progress 1–11 for the dev child) was inserted to reach premium-only sessions and **removed afterwards**: entitlement rows 0, dev child back to `[1,2]`.

## 10. Paywall status

UX audited and improved: the unlock card now lists what you get (all 30 sessions, Ollie, Parent Mode + pass-and-play, Graduation certificate), region-correct price, *One payment. Yours forever.*, and *Or get Premium — it includes Chess School, forever*. No pressure language (asserted). Premium/School owners never see it. **Live checkout still needs the live Stripe key, UPI enabled, and non-INR price confirmation** — unchanged from the previous handoff; nothing was faked.

## 11. Files changed

**New:** `lib/school/v2/ollieLines.ts` · `lib/school/v2/resume.ts` · this file
**Modified:** `components/school/v2/{SessionRunner,steps,ParentModePanel,ParentView,UnlockSchoolButton}.tsx` · `lib/school/v2/parentSummary.ts` · `content/school/sessions.ts` · `scripts/test-chess-school-v2.js` (+84 assertions)

## 12. Files deliberately NOT changed

`supabase/migrations/0043_chess_school_v2.sql` · `lib/parentLock/*` · `components/parentLock/*` · `app/chess-time/*` · `content/lessons.ts` · `app/lesson/*` · `lib/school/chessSchool.ts` · `app/api/stripe/*` · `lib/premium/*` · `lib/school/v2/{progress,queries,storage,access,server,moves}.ts` (progress architecture untouched) · V1 `/chess-school` root.

## 13. Test results

```
node scripts/test-chess-school-v2.js          → 846 passed, 0 failed
node scripts/test-chess-school.js             → 61 passed, 0 failed
node scripts/test-parent-lock.js              → 57 passed, 0 failed
node scripts/test-premium-entitlement.js      → 59 passed, 0 failed
node scripts/test-world.js                    → 177 passed, 0 failed
node scripts/test-school-curriculum.js        → 70 passed, 0 failed
node scripts/test-move-validation.js          → 40 passed, 0 failed
node scripts/verify-chess-school-migration.js → 10 passed, 0 failed (live DB)
npx tsc --noEmit                              → clean
npm run build                                 → exit 0
git diff 02ba1b1 -- <protected paths>         → empty
```

## 14. Remaining launch blockers

- **Stripe live configuration** (key, UPI, non-INR prices) and one real purchase — the only thing between "verified in test mode" and "selling".
- **Physical device pass** on the Motorola and Lenovo. Everything here was verified at those viewports in the browser; hardware (safe-area insets, real touch) is not yet exercised for Chess School.
- **V1 → V2 root flip** — a product decision, not a blocker.

## 15. Honest final rating

**TECHNICAL QUALITY: 9/10** — 846 assertions, every position verified, cloud sync live and union-merged, resume and idempotency covered. Off one for the absence of a real component test harness (behaviour was verified by driving the browser, which is slower to repeat).

**CHILD EXPERIENCE: 9/10** — nothing traps a child; every session now does something; Ollie sounds like one voice; the five moments look and feel different. Not a 10 because the ceremonies are still static cards — no sound, no motion beyond a fade — and pass-and-play cannot tell when a real game is over.

**PARENT EXPERIENCE: 9/10** — exactly the brief's three blocks, honest counts, one actionable suggestion. Parent Mode instructions need no chess knowledge. Off one because the parent page is only reachable from the classroom, not from the Parent Dashboard.

**LAUNCH READINESS: 8/10** — the product and the database are ready; the paywall is a configuration away; the hardware pass has not been done. Nothing was faked to reach this number.
