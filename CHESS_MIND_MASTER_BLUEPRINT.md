# Chess Mind — Master Product Blueprint (Phase 3)

Built on `CHESS_MIND_UX_AUDIT.md` (Phase 1) and `CHESS_MIND_COMPETITOR_RESEARCH.md` (Phase 2), and incorporating the **Free Experience Principle** below as a governing rule over every section that follows.

**No code has been changed to produce this document.** This is the plan to review before Phase 4 approval and phased implementation.

---

## 0. The Free Experience Principle (governs everything below)

> **Limit quantity and depth — never quality.**

A free user gets the same UI polish, the same Ollie, the same animations, real chess, real progress, real achievements, a real (if smaller) World, and a genuinely useful Parent view. Premium adds *more of the same good thing* — more content, unlimited usage, deeper analysis, more worlds, more customization — never a better-looking version of what free users get. Locks appear only after a real win has already been felt, and every locked door is described by what it leads to, never just "🔒 Locked."

This document applies that rule as a literal test to every limit proposed below:
1. Does the user still have something meaningful to do after hitting the limit? If no, redesign it.
2. Does the limit protect *quantity*, not *quality*? If it degrades quality, redesign it.
3. Would a free child still recommend Chess Mind to a friend after hitting every limit in one day? If no, redesign it.

Two decisions from the Audit remain **explicitly open** and are flagged inline wherever they matter (§9, §13) rather than silently resolved — they need your sign-off before Phase 4 implementation begins.

---

## 1. Information Architecture

Five child-facing *jobs*, each answering exactly one question, plus one adult-facing job:

| Section | The one question it answers | Today's reality (Audit) |
|---|---|---|
| 🏠 **Home** | "What should I do right now?" | Currently ~10 competing CTAs |
| 🎓 **Chess School** | "Teach me chess, step by step." | Already built (Chess School V2); needs primary visibility |
| 📚 **Learn** | "Let me explore a specific topic." | Currently an index over Academy + Train Your Mind, undifferentiated from School |
| 🧩 **Puzzles** | "Give me something fast to solve." | Already matches this model closely |
| 🎮 **Play** | "Let me actually play a game." | Already clean |
| 🌍 **World** *(elevated)* | "Let me explore and show off what I know." | Currently buried inside Play |
| 👨‍👩‍👧 **Parent** | "Is my child actually learning?" | Already rich; needs a free/premium split |

**Train Your Mind** is *not* promoted to a top-level job — it's cognitive cross-training, correctly positioned as a Learn sub-section (confirmed by the existing `content/chessMindCategories.ts` already treating one of its categories, Tactical Thinking, as Academy content). Promoting it to a 6th primary tab would recreate exactly the "too many top-level things" problem this whole Blueprint exists to fix.

---

## 2. Navigation Proposal

**Primary bottom nav / sidebar (5 items — unchanged count, re-pointed):**

```
🏠 Home    🎓 School    🧩 Puzzles    🎮 Play    📚 Learn
```

- **Home** — `/kingdom-map` (route kept; content rebuilt, §4).
- **School** — `/chess-school` promoted from a Home card to a primary tab. This is the single highest-leverage navigation change in this Blueprint: Chess School is the flagship paid product and currently has no persistent presence in the chrome at all.
- **Puzzles** — unchanged, already correct.
- **Play** — unchanged, already correct.
- **Learn** — unchanged route, but now unambiguously "the library" (Academy sections + Train Your Mind), never confused with School because School is now its own tab, not a Home card living one scroll away from Learn's own content.

**"More" is retired as a primary tab.** Its contents move to a persistent icon in the top bar (already present on tablet/desktop via `AppTopBar`; added for phone) so Profile, Appearance, and Parent access are always one tap away without occupying a primary slot:

```
[top bar, all breakpoints]  🦉 Chess Mind          👤  ⚙
```
`👤` → Profile/Appearance. `⚙` (or the existing avatar tap target) → a small sheet with **World** and **Parent Mode**, both promoted out of "buried in Play" / "text link at the bottom of Home."

**World** gets a visible, single-tap home from that sheet (not a 6th bottom tab — the Audit's "no primary nav presence at all" finding is fixed without inflating the tab count, matching Rule 2 of the brief: never overwhelm with choices).

This reuses `navConfig.tsx`'s existing `NAV_ITEMS`/`APP_PREFIXES`/`FORCE_BARE_PREFIXES` mechanism exactly — it's a data change (which routes are primary vs. secondary), not a new navigation system. The Audit's flagged risk (three independently-maintained title lists) gets fixed as a byproduct: `AppTopBar`'s `SECTION_TITLES` and `navConfig`'s `NAV_ITEMS` are updated together in the same PR, every time, from now on.

---

## 3. First-Time Onboarding

Keeps the existing, server-enforced sequence (Audit §14) — it already asks the right *questions*, it just doesn't yet *act* on the answers. The fix is almost entirely about what happens **after** the last onboarding screen, not the screens themselves.

1. **Welcome** (new, brief) — full-bleed Ollie moment, no form fields: *"Hey! I'm Ollie. Let's discover how powerful your chess mind can become!"* One tap to continue.
2. **Experience question** (existing screen, kept) — Never played / Know the basics / Already play — reframed as personalization, not a form: large tappable cards, not a dropdown.
3. Avatar → Buddy → Board skin → Piece set (existing, kept — already fast, already fun).
4. **Skip the intro video for self-identified beginners too, not just "adult/experienced."** Today `shouldSkipWelcome` only skips for experienced users; a young complete-beginner benefits *more* from getting to a real first success in under 2 minutes than from watching a history-of-chess video first. Recommend: the video becomes an optional "🎬 Want to hear a quick chess story first?" card reachable later from Learn → Origins, not a mandatory gate for anyone.
5. **Land somewhere personalized, not the standard Home**: a complete beginner's first landing is a single full-screen card — *"Let's play your first move together"* — straight into Chess School Session 1, bypassing the standard multi-card Home entirely for this one first visit. A self-identified experienced player lands on Home as normal, since they don't need the guided on-ramp.

This directly implements Duolingo's strongest finding (Research §7): the first *real activity* happens immediately, before the user is asked to absorb the full app's structure.

---

## 4. Home Screen

**First-time (beginner path, per §3.5): skipped — they're already inside Chess School Session 1.**

**Returning user — the entire screen, top to bottom:**

```
🦉 Welcome back, {name}

  YOUR NEXT MOVE
  ┌─────────────────────────────────┐
  │  [ large primary CTA card ]     │
  │  Continue Chess School          │
  │  Day 7 — The Knight's Secret    │
  └─────────────────────────────────┘

  TODAY'S PRACTICE
  🧩 3 Puzzles   🧠 Brain Training   🎮 Play a Game

  YOUR PROGRESS
  [ one simple visual: streak + current Chess School floor/day ]
```

That's the whole screen. Everything else currently on Home (Audit §1: Daily Quests, the 4-card Recommended grid, the Your Stats row, the full Kingdom Journey list, Achievements, the For-Parents link) either **moves into the section it actually belongs to** (Stats → Learn/Progress, Achievements → Parent Mode + a small badge on Progress, For Parents → the top-bar sheet from §2) or **is retired as a Home-level concept** (the 4-card Recommended grid duplicates what the 5 nav destinations already say once School and World have proper homes).

"Today's Practice" is three taps, not ten — Puzzles, Train Your Mind, Play — each showing its own live counter inline (e.g., "3 Puzzles" becomes "2 Puzzles left" after one solve), so Home always answers "what's left today" without a child needing to open each section to find out.

---

## 5. Chess School 🎓

**Positioning, per your original brief, kept exactly**: *"Your personal chess teacher."* ₹199 lifetime. Promoted to a primary nav tab (§2).

**Free tier**: sessions 1–3 remain free (existing `FREE_SESSION_LIMIT`, unchanged — no code risk). This is enough for a child to fully experience the teaching *loop* (Show → Explain → Try → Practice) before any lock appears, satisfying the Free Experience Principle's "real win before monetization" rule.

**The lock, when reached, is a promise, not a wall** — replacing whatever currently renders at session 4 for a non-owner with:

> 🎓 **Chess School is your complete guided journey from beginner to confident chess player.**
> You've finished the first 3 sessions — Ollie says you're ready for the Knight's world.
> **30 sessions. 6 chapters. One coach. Lifetime access. ₹199.**
> [ See what's next → ]

"See what's next" previews the *chapter titles* (§ below), not raw content — curiosity, not a paywall.

### The good news from the Audit (§4 there): the existing 30-session curriculum already matches your 6-phase philosophy almost exactly

Mapping the **real, currently-live session list** onto your requested phases:

| Phase | Days | Existing sessions (unchanged) | Alignment |
|---|---|---|---|
| 1 — Enter the Board | 1–3 | Welcome to Chess School · Meet the Pawn · Pawn Captures | ✅ Strong. **Recommendation**: confirm session 1–3 already end on an interactive win (a tiny playable challenge), not just "meet the pawn" — this is a content review, not a rebuild, since the step-type system (`teach`/`guided_board`/`puzzle_drill`) already supports it. |
| 2 — Build Your Army | 4–8 | Meet the Knight · Meet the Bishop · Meet the Rook · Meet the Queen and King · **Boss Battle: Your First Mini Game** | ✅ Excellent — arguably *better* than the brief's own day split, since the first real "win" (session 8) lands right after the full army is assembled, which is more satisfying than winning before you have all your pieces. |
| 3 — Play Real Chess | 9–12 | What is Check? · Your First Guided Game · Hanging Pieces · Fork Festival | ✅ Strong match to "turns, capture, check, protect, simple threats." |
| 4 — Think Like a Chess Player | 13–18 | Real Opponent (Parent Mode) · Pins and Skewers · Back-Rank Ideas · **Boss Battle: Tactics Check** · Escape from Check · **Your First Checkmate** | ✅ Strong — Session 18 (First Checkmate) is already a built WOW moment (freeze/explain/replay sequence, shipped this project). |
| 5 — Build a Plan | 19–24 | Castling · Don't Hang Your Pieces · Play a Full Game · Opening Ideas · Keep Your King Safe · **Win Without Hints** | ✅ Strong — Session 24 is already a built WOW moment (no-hints framing, shipped this project). |
| 6 — Become a Complete Player | 25–29 | Planning Your Moves · Endgame King Power · Pass-and-Play Practice · Teach a Friend · Graduation Prep | ✅ Strong — combines tactics, endgame, real-opponent practice, and reflection exactly as requested. |
| **Day 30 — Graduation** | 30 | **Graduation Duel** | ✅ Already fully built this project: arrival ceremony, 5-skill montage, no-hints duel (win or lose graduates), closing ceremony, printable certificate. |

**Recommendation: do not rewrite the curriculum.** Add the six phase names as a new presentational layer in `SchoolHome.tsx` (they already have 8 "modules" grouped into 4 "acts" internally — renaming/regrouping that existing structure into your 6 named phases is a content/labeling change, not a new architecture) and do a content *review* pass on sessions 1–3 and 19–24 specifically to confirm the "SHOW→EXPLAIN→TRY→PRACTICE→PLAY→REFLECT→REWARD" loop and the session-length pacing (15/30/45/60 min) are followed session-by-session — most of the scaffolding for this already exists in the step-type system.

**Ollie inside Chess School**: keep the existing scripted, model-free voice exactly as built — do not route it through the AI provider (Audit Risk #5). It already teaches the short, conversational, question-asking style your new principle asks for ("Interesting idea! But look again...") because it was built to that exact spec.

**Pause/resume/save**: already exists (`lib/school/v2/resume.ts` — per-device step bookmarking). No new work needed; just make sure the UI surfaces "Continue where you left off" prominently (it already does, on the Home card — this simply moves with the card into the new School tab's own landing).

---

## 6. Learn Chess 📚

Unambiguous now that School has its own tab: Learn is **the library** — "choose something you want to explore," never "follow my journey."

| Section | Free access | Why |
|---|---|---|
| ♟ Chess Fundamentals | ✅ Full | Confirmed already ungated (Audit §5) |
| 📜 Chess Origins | ✅ Full | Low-stakes, story-driven, a great free hook |
| ⚔️ Tactics | 🆓 First 5 | Confirmed already the one hard-gated section — keep the mechanism, restyle the lock (below) |
| 📖 Chess Openings | 🆓 First 4 | New explicit limit — not currently gated (Audit); needs new gating logic |
| 🧠 Strategy | ✅ Full | Matches brief |
| 👑 Endgames | 🆓 First 2 | New explicit limit — not currently gated; needs new gating logic |

**The unlock moment, everywhere in Learn**, uses one shared component (new: reuse the *pattern*, not necessarily new code, from Puzzle Tower's honest "N more to unlock" style) — never a bare 🔒:

> 🌟 You've mastered the foundations here. Ready to take your chess mind further?
> [ See what Tactics has for you → ]

This is a genuine gap vs. today (Openings and Endgames currently have **no** gating at all per the Audit, meaning today they're *already* fully free) — implementing the "first 4 / first 2" limits is a **new restriction being added**, not a relaxation. Flagged explicitly: confirm this trade is intended (moving from "fully free today" to "partially free") before implementation, since it's the one place in this Blueprint where a currently-more-generous free experience would become less generous. If preserving current generosity matters more than matching the brief's table exactly, Openings/Endgames can stay fully free with no code change at all.

---

## 7. Puzzles 🧩

Already the closest thing in the app to this Blueprint's target state (Audit, Puzzle Tower section). Two copy changes, zero architecture changes:

- Replace any "limit reached" framing with: **"🎉 Today's Puzzle Quest Complete! You solved all 3 puzzles available today. Come back tomorrow for your next challenge."** — this is a copy-only change to the existing `limitReached` branch in `app/(tabs)/puzzles/page.tsx`.
- The Puzzle Tower's existing real-solved-count progression, honest locked-floor messaging, and full-screen solve flow are kept exactly as built.

Premium: unlimited (already true).

---

## 8. Train Your Mind 🧠

**This is the one section with genuinely no existing gating (Audit §7) — a decision is needed, not a preservation.**

**Researched recommendation: 2 free challenges per category per day, presented per-category, never as one shared global counter.**

Why not a single shared daily pool (e.g., "5 Brain Training challenges, any category")? Because a shared pool empties the *entire tab* the moment a child spends it on their favorite category — precisely the failure mode your brief warns against ("a child can accidentally exhaust every activity immediately and then feel the entire Train tab is useless"). Per-category limits are structurally the right shape for avoiding that: even after using up Tactical Thinking's 2 for the day, all 7 other categories are still completely fresh.

The refinement is in the **presentation**, not the rule: show the two-dot indicator (`● ● ○`, exactly as your own brief example shows) on each category *card*, never a single number for the whole tab — and when one category is spent, that card's own copy points sideways rather than dead-ending:

> ✅ Great practice today! Come back tomorrow, or try a different skill →

Total daily ceiling across 8 categories is 16 attempts, which is generous enough that "healthy daily practice" reads as true (your own success criterion) rather than as a technicality.

Premium: unlimited, per category.

---

## 9. Play 🎮

**No changes.** Already fully free, already correct per both your original brief and the Free Experience Principle ("Play is the heart of Chess Mind... do not cripple the actual chess-playing experience"). Computer, Online, Friends, Pass & Play all stay unrestricted for everyone.

---

## 10. Game Review 🔍

Builds on real, already-shipped infrastructure (Audit §10) — this is an extension, not new invention.

**Free tier** (per your new addendum, more specific than the original brief):
- ⭐ **Your Best Moment** — one strong move, already computable via the existing `pickBiggestMoment`/`BiggestMomentCard` pattern.
- ⚠️ **One Important Lesson** — one meaningful mistake, already computable via the existing `MistakeCard`/move-classification pipeline.
- 🎯 **What To Practice Next** — one concrete recommendation ("You missed a fork — try Tactical Thinking tomorrow"), already computable via the existing `recommendPractice` skill-mapping logic.

All three already exist as capabilities in `PostGameAnalysis.tsx`'s pipeline — the free tier is a matter of **which cards render**, not new analysis engineering. This is the cleanest "limit depth, not quality" case in the whole Blueprint: the same real engine output, fewer cards shown.

**Premium tier**: full move-by-move review, accuracy, all mistake/good-move cards (not just one of each), opening insights, multi-game trend data. All already exist in the current `components/game/analysis/*` stack per the Audit — Premium is "show every card the engine already produces," free is "show the three that matter most."

**Never show a raw evaluation bar or engine centipawn score to a child at the free tier** (Research §5, Dr. Wolf's explicit design choice) — Chess Mind already avoids this by design (`PerformanceSummary` speaks in move-quality words, not numbers); keep it that way at every tier.

---

## 11. Chess Mind World 🌍

Elevated to a real, single-tap destination (§2) without inflating its actual content beyond what's honest — World's own existing documentation already refuses "a row of locked coming-soon cards," and this Blueprint keeps that discipline.

**Free**: the existing default world, **plus one genuinely unlockable location** (new — today the Audit found "two locations, both real, both finished," so this may already effectively be true; confirm which of the two is the "default" and treat the second as the free unlock target).

**Premium**: all locations, more stories/interactions, premium-only locations.

**Reconcile, don't duplicate, the existing bonus mechanism**: `kingdomUnlocks.ts` already grants a Home "spotlight" banner from Train Your Mind solve-counts. Recommendation: that becomes the actual unlock mechanism for World's free second location (e.g., 10 Pattern Recognition puzzles → unlocks the second World location, with the banner now linking into World directly instead of just a Home callout) — one unlock system, not two.

---

## 12. Appearance 🎨

Per your addendum (more generous than the original brief's "1 appearance"): **free = 1 default + 1 unlockable appearance; Premium = all themes/board styles.** Small, low-risk change to whatever currently gates `board-skin`/`piece-set` selection — the default must not look like a placeholder (existing default skins/pieces already carry the app's premium visual language, per design-system conventions used throughout).

---

## 13. Free vs. Chess School vs. Premium

| | 🆓 Free | 🎓 Chess School — ₹199 lifetime | 👑 Premium |
|---|---|---|---|
| Chess School | Sessions 1–3 | **All 30 sessions**, graduation, certificate | Included |
| Learn Chess | Fundamentals + Origins + Strategy full; Tactics/Openings/Endgames partial | Same as Free | Everything, unlimited |
| Puzzles | 3/day | Same as Free | Unlimited |
| Train Your Mind | 2/category/day | Same as Free | Unlimited |
| Play | Full | Same as Free | Same |
| Game Review | Best Moment + 1 Lesson + 1 Recommendation | Same as Free | Full move-by-move, trends |
| World | Default + 1 unlock | Same as Free | All locations |
| Appearance | 1 default + 1 unlock | Same as Free | All themes |
| Parent Mode | Progress, activity, streaks, achievements, basic strengths, basic recs (§14) | Same as Free + School-specific learning visibility | Full intelligence, weekly/monthly reports |

**⚠️ Open decision, carried from the Audit, still unresolved**: this table assumes Premium is a distinct, ongoing entitlement layered *on top of* whatever Chess School unlocks — matching the live code's existing independent-entitlement design. Your original brief priced Premium at ₹50/month or ₹349/year (a subscription); the live app has no subscription billing and instead grants Premium as a ₹299 **one-time, 2-year** entitlement. **This Blueprint does not resolve that mismatch** — it's a billing-infrastructure decision, not a UX one, and needs your explicit call before Phase 4: keep the existing one-time model (fastest, zero Stripe risk) or scope real subscription billing as its own workstream (bigger, touches `lib/premium/entitlement.ts` and the Stripe integration directly).

---

## 14. Parent Mode 👨‍👩‍👧

The Audit found **no existing free/premium split** here at all — every parent sees everything today. This Blueprint introduces one, using ChessKid's Report Card (Research §3) as the template:

**Free** — genuinely useful, never a demo:
- Child profile, current activity, sessions/puzzles/games completed, streak, achievements, basic strengths, basic recommendations ("Practice pins next").

**Premium**:
- Weekly/monthly trend reports, detailed strengths *and* weaknesses, game-insight patterns (common mistakes, tactical weaknesses), personalized training recommendations tied to actual weakness data, advanced Chess Time scheduling controls, downloadable/emailed reports.

Almost the entire *free* list already exists on the current Parent Dashboard (Audit §12: This Week, Skills Snapshot, Learning Progress, Chess Mind Activity, Achievements) — this section is mostly **reclassification of what already renders**, plus building the genuinely-new premium layer (trend reports, weakness-pattern detection) as additive features gated by the existing `resolvePremiumState`.

---

## 15. Upgrade UX

Every upgrade moment happens **after** a positive beat, never as an interruption (Rule 9 / Free Experience Principle):

- After a Puzzle Quest completes (not mid-puzzle).
- After a Learn section's free content is finished ("You've mastered the foundations...").
- After Chess School's free sessions 1–3 (a promise, not a wall — §5).
- Never on app launch, never mid-lesson, never mid-game, never as a popup interrupting anything in progress.

Copy always names what's gained ("🚀 more possibilities"), never what's being removed. This matches both your addendum and the paywall research finding (Research §8): soft, value-first, moment-of-natural-curiosity placement converts better *and* preserves trust — the two goals aren't in tension here.

---

## 16. Progress System

One consistent shape reused everywhere progress is shown (Home's simplified summary, Chess School's own progress, Puzzle Tower, Parent Mode's free view): **current position + one real number + one honest "what's next."** No new progress-tracking infrastructure is proposed — `lib/school/v2/progress.ts`, `lib/puzzles/puzzleLevels.ts`, and `lib/stats/playerStats.ts` already each do this correctly for their own domain; the change is presentational consistency across them, not a new unified data model (which would be exactly the kind of destructive, high-risk rebuild the brief says to avoid).

---

## 17. Responsive Strategy

No new strategy needed — every system this Blueprint touches (Chess School, Puzzle Tower, Parent Dashboard) already has verified, working responsive behavior at 375×812, 411×914, 768×1024, and desktop from prior work this project. The one net-new responsive surface is the simplified Home screen (§4), which is *less* dense than today's Home and therefore lower-risk to verify than what it replaces.

---

## A. What currently confuses users (from Audit §2, carried forward)

Two parallel 30-day curricula on the same Home screen; a "Learn" umbrella that fans into 13 destinations from one tab while the flagship product (Chess School) isn't in the nav at all; ten competing CTAs on first paint; World demoted inside Play; no visible line between "paid for School" and "paid for Premium"; two Ollies with different rules.

## B. Proposed new structure

Five clear jobs (§1), five-tab nav with School promoted and More retired into a top-bar sheet (§2), a Home screen with one primary CTA and one three-item practice row (§4), one 30-day curriculum (the existing one, relabeled into your 6 phases, §5), Learn as an honest library with soft locks (§6), gating added consistently to Train Your Mind and select Learn sections (§8, §6), Game Review's free tier made explicit (§10), World elevated (§11), Parent Mode split into free/premium for the first time (§14).

## C. Before → After

| | Before | After |
|---|---|---|
| Primary nav | Home / Puzzles / Play / Learn / More | Home / **School** / Puzzles / Play / Learn (More → top-bar sheet) |
| 30-day curricula | 2 (Kingdom Journey + Chess School V2) | 1 — see open decision below |
| Home CTAs | ~10 | 1 primary + 3 practice items |
| Train Your Mind limits | None | 2/category/day, framed positively |
| Learn Openings/Endgames | Fully open (unconfirmed gating) | Partially gated (first 4 / first 2) — **flagged, §6** |
| Parent Mode tiers | None (everyone sees everything) | Free (Report-Card style) / Premium (trends, weaknesses) |
| World | Inside Play | Elevated, top-bar sheet destination |
| Game Review | Full analysis for everyone (implicit) | Free = 3 cards / Premium = full stack |

## D. The 30-day Chess School curriculum

See §5's table in full — the existing 30 sessions, remapped into your six named phases, with the specific recommendation to relabel (not rewrite) and to content-review sessions 1–3 and 19–24 against the SHOW→EXPLAIN→TRY→PRACTICE loop.

## E. Free vs. Chess School vs. Premium

See §13's full table.

## F. Navigation proposal

See §2 in full.

## G. Implementation order (maps to your suggested Phase A–J, sequenced by risk — lowest first)

1. **Phase A** — Navigation data change (promote School, retire More into a sheet) + reconcile the three title-mapping lists. Lowest risk: config/data change to an existing, working mechanism.
2. **Phase B** — Home rebuild (simplify to primary CTA + practice row). Medium risk: touches the most-viewed screen; needs careful before/after user-testing feel, not just a build check.
3. **Phase F** — Learn Chess gating (Openings first-4, Endgames first-2) + soft-lock copy pattern reused from Puzzle Tower. Low-medium risk: additive gating logic, existing pattern to copy.
4. **Phase G** — Train Your Mind limits (2/category/day, per-category presentation). Low-medium risk: new logic, but no existing behavior to regress since none exists today.
5. **Phase H** — Game Review free/premium card split. Low risk: gating which existing cards render, not building new analysis.
6. **Phase I** — Parent Mode free/premium split. Low-medium risk: mostly reclassifying existing sections; new premium features (trend reports) are additive.
7. **Phase D (World)** — elevate World, reconcile the unlock mechanism with `kingdomUnlocks.ts`. Medium risk: touches two existing systems' interaction.
8. **Phase C (Chess School curriculum relabeling)** — lowest technical risk, but should follow B so the new Home correctly links into the newly-labeled phases.
9. **Kingdom Journey decision** — sequenced *last*, deliberately, because it is the one genuinely destructive item in this whole plan and needs your explicit, separate approval (see Risk below) — not bundled into any of the phases above.
10. **Phase J** — final polish, cross-device pass, full regression suite re-run.

After every phase: `tsc --noEmit`, the relevant existing test suites (per Audit §16), `npm run build`, and a mobile/tablet/desktop check — exactly as your process already specifies.

## H. Which existing systems can be reused

Puzzle Tower's gating pattern (as the template for Learn/Train Your Mind locks); Chess School V2's entire step-type/progress/entitlement architecture (relabel, don't rebuild); the Game Review analysis pipeline (gate which cards render); Parent Dashboard's existing sections (reclassify as the new free tier); `navConfig.tsx`'s existing primary/secondary mechanism; World's existing "small and honest" content.

## I. Which systems must NOT be touched

Parent Lock / Chess Time internals; Supabase migration 0043; the Premium entitlement *logic* (`resolvePremiumState`, fails-open design) — only its *pricing/billing model* is an open question, not its code; Stripe checkout routing; existing move validation; Online Play; existing auth.

## J. Risks (carried and expanded from Audit §6)

1. **Premium pricing/billing mismatch** — still open, still blocks a fully honest §13 table. Needs your decision before Phase 4.
2. **Kingdom Journey's fate** — still open. This Blueprint deliberately does not assume retirement, folding, or repositioning; it sequences that decision last and separately (§G.9) specifically so it isn't accidentally bundled into lower-risk work.
3. Learn Chess's Openings/Endgames gating is a **new restriction** relative to today's actual (apparently ungated) behavior — confirm this trade before implementing (§6).
4. Train Your Mind gating is entirely new logic with no existing tests — a fresh test suite is needed alongside the feature, not after.
5. Two-Ollie unification is **not** proposed as code work in this Blueprint — only a tone/voice-consistency review is recommended, specifically to avoid Audit Risk #5 (accidentally routing Chess School's scripted lines through the AI provider).

---

*Per your instruction, this Blueprint stops here. No code changes have been made. Awaiting your review — in particular, the two open decisions in §5/§13 (Premium billing model) and §11 (Kingdom Journey's fate) — before any Phase 4 implementation begins.*
