# Chess Mind — Implementation Plan (Phase 4)

Builds on `CHESS_MIND_UX_AUDIT.md`, `CHESS_MIND_COMPETITOR_RESEARCH.md`, and `CHESS_MIND_MASTER_BLUEPRINT.md`. This pass re-inspected the actual database schema, entitlement call sites, and Stripe integration directly (facts below are grounded in real files, not restated from memory).

**No code, migrations, entitlements, or data have been touched to produce this document.**

---

## FINAL PRODUCT DECISIONS — PHASE 4

Your review approved the overall architecture and implementation order. This section records the specific decisions from that review, each explicitly marked, and supersedes any place below where an earlier draft of this plan only offered a recommendation rather than a decision. Sections further down are updated in place to match; this section is the single place to read for "what was actually decided."

| # | Decision | Status |
|---|---|---|
| 1 | Chess School is the ONE structured curriculum. Kingdom Journey must not remain a second day-by-day curriculum. | **APPROVED** |
| 2 | Kingdom Journey → Chess Mind World, additive + read-only migration, zero data loss. | **APPROVED** |
| 3 | World = exploration/story/discovery, never a second School. | **APPROVED** |
| 4 | One canonical Ollie, three contextual roles (Teacher / Guide / Coach). | **APPROVED — spec below (§ Ollie Architecture)** |
| 5 | Free matrix (Learn, Train Your Mind, Puzzles) as specified. | **APPROVED** |
| 6 | Free Puzzles: 3/day, high quality, unchanged mechanism. | **APPROVED** |
| 7 | Play: fully free, no new restrictions. | **APPROVED** |
| 8 | Game Review free/premium split as specified; Play→Review→Practice→Improve loop. | **APPROVED** |
| 9 | Navigation: **Home / School / Puzzles / Play / World**, Learn + Train Your Mind surfaced (not hidden), no generic "More." | **APPROVED — supersedes this plan's earlier Home/School/Puzzles/Play/**Learn** proposal; see § Navigation Architecture** |
| 10 | Locked content must show value (what/why/unlock), never a bare "Premium Required." | **APPROVED** |
| 11 | Chess School curriculum: reuse existing architecture, remove conceptual overlap with Kingdom Journey. | **APPROVED** |
| 12 | Pricing: Free forever / School ₹199 one-time / Premium ₹50 mo or ₹349 yr. No Stripe work this phase. | **APPROVED WITH CONDITIONS — entitlement layer built subscription-ready; zero billing code touched until a separate authorized workstream** |
| 13 | Protected systems list (Parent Lock, migration 0043, auth, Stripe, existing entitlement resolvers, Puzzle Tower, Online Play, existing Game Review). | **PROTECTED / DO NOT TOUCH** |
| 14 | `lib/entitlement/` composes, never replaces or duplicates, existing resolvers. | **APPROVED** |
| 15 | Returning-user safety: no lost progress, no silent purchase loss, no child reset. | **APPROVED — see § Returning-User Safety Strategy** |
| 16 | Implementation order and after-every-stage verification discipline. | **APPROVED — unchanged, see §26** |

### Navigation Architecture (final)

**Primary tabs:**
```
🏠 Home    🎓 School    🧩 Puzzles    🎮 Play    🌍 World
```
This replaces this plan's earlier Home/School/Puzzles/Play/**Learn** proposal (§3, original text preserved below for the record). World earns the 5th slot because it is a named product differentiator, not because Learn stops mattering — Learn's actual content doesn't disappear, it changes *how* it's reached (below).

**Where Learn and Train Your Mind live instead of a tab:**
- **Not a generic "More."** Per your explicit instruction, nothing product-relevant hides behind a vague catch-all a child has no reason to tap.
- **Learn** (the Academy library — Fundamentals/Origins/Tactics/Openings/Strategy/Endgames) is surfaced two ways: (a) a persistent, clearly-labeled 📚 icon in the top bar on every screen (not a sheet buried behind a profile avatar — a named, visible icon), and (b) contextually from Home ("Want to go deeper? Explore Learn →") and from School (a session that touches an opening or endgame idea can link straight to that Learn section).
- **Train Your Mind** is surfaced from Home's practice row (already planned, §17) and from World (a zone's "brain training" corner, tying cognitive games to the exploration theme rather than making them feel bolted on) — exactly as you directed, no dedicated tab needed.
- **Parent Mode** keeps its existing discovery path (profile-adjacent, plus the "For Parents" link) — not a primary tab, consistent with the Audit's own reasoning that a child's primary chrome should never imply Parent Mode belongs to them.

**Why this survives scrutiny where the earlier Home/Learn/Puzzles/Play/Progress candidate didn't**: that candidate silently dropped School's primary visibility, which the Audit identified as the single biggest problem. This candidate keeps School's primary slot and instead re-homes Learn — a real change, but one accompanied by an explicit, visible replacement path (the persistent Learn icon), not a demotion into an undiscoverable catch-all.

### Ollie Architecture — One Character, Three Contexts (final spec)

**Canonical identity** (fixed, never varies by context): a wise young owl, warm, endlessly patient, never sarcastic, never shaming a mistake, celebrates *thinking* over *winning*. Same name, same visual design (existing 🦉 avatar/art), same core values in every surface. This is documented once, here, as the source every context-specific voice must trace back to — future features write new *lines*, never a new *personality*.

| Context | Role | Register | Job | Examples |
|---|---|---|---|---|
| 🎓 Chess School | **Teacher** | Patient, instructional, explains before asking | Teach a concept, then ask a short question to check understanding | *"Interesting idea! But look again — is your knight safe?"* (existing, scripted, model-free — kept exactly as built) |
| 🌍 Chess Mind World | **Guide** | Adventurous, curious, narrates discovery | Invite exploration, react to what's found, never quizzes | *"What do you think is waiting behind the Knight Kingdom's gate?"* |
| 🧠 Train Your Mind | **Coach** | Concise, energetic, challenge-framed | Set up a timed/skill challenge, celebrate effort fast | *"10 seconds. Ready? Go!"* |

**Delivery mechanism stays deliberately different per context, and that's a documented decision, not fragmentation**: School's Ollie stays fully scripted and model-free (Chess School V2's explicit, tested design guarantee — never routed through an AI provider). World's Ollie is the existing AI-backed `lib/ollie/*` chat, because exploration/conversation is what that system was actually built for. Coach-context Ollie (Train Your Mind) is new, short, scripted lines — no chat needed for a timed drill. **What must be unified is tone and values, not the underlying tech** — a documented voice spec (new: `content/ollie/voice.ts` or similar, listing the personality constants and one example line per role) is the deliverable that prevents these three from drifting into unrelated characters, and is the artifact a future contributor checks before writing any new Ollie line anywhere in the app.

### Returning-User Safety Strategy (final)

Before any implementation touches a user-facing surface, the plan requires (as a concrete pre-flight step, not just a principle) identifying, in the live database, real counts of: children with `current_day > 1` (active Kingdom Journey users), children with any `child_school_progress` row (active Chess School users), parents with a non-expired Premium entitlement, and parents with a completed Chess School purchase. This is a **read-only reporting query**, run before Phase 7 (Kingdom Journey → World) specifically, so the migration's read-mapping function can be validated against the *actual* distribution of real `current_day` values in production, not just synthetic test values. No such query has been run yet — it's scoped as the first concrete action of Phase 7, not assumed away.

Guarantee restated precisely: the migration reads `current_day`/`child_lesson_progress`/`child_school_progress`/premium & school entitlement columns and **never writes to any of them**. All new state (World unlocks, entitlement-layer computations) lands in new, additive tables/columns only.

---

## 1. Current architecture (grounded facts, this pass)

- **`children.current_day`** (a column on the core `children` table itself, `supabase/migrations/0001_init.sql`) plus **`child_lesson_progress`** (`child_id, day_number, status, completed_at`) are Kingdom Journey's entire storage. `current_day` is read directly in `lib/supabase/queries.ts`, `app/(tabs)/kingdom-map/page.tsx`, `app/chess-school/page.tsx` (the pre-existing V1 landing, distinct from `/chess-school/classroom`), `app/parent-dashboard/page.tsx`, and `app/parent-dashboard/ManageChildren.tsx`. **This is a core column on the child record, not an isolated add-on table** — it cannot be dropped without touching every one of those files, and it is the field that decides which Kingdom zone a child is shown as being "in."
- **No dedicated achievements table exists.** Achievements (`content/achievements.ts`, `app/(tabs)/kingdom-map/achievementsData.ts`) are computed client/server-side from real underlying data (lesson completions, opening encounters, puzzle solves) — there is nothing to migrate here, only recompute-from-source logic to keep or adapt.
- **Entitlement checks are genuinely scattered**, confirmed by direct grep: `resolvePremiumState` is called independently at 11 separate call sites (`kingdom-map`, `puzzles`, `academy/origins`, `academy/tactics` ×2, `api/premium/refresh`, `api/premium/status`, `chess-school`, `lesson/[dayId]`, `parent-dashboard`, plus its own definition) — each page fetches `PARENT_PREMIUM_COLUMNS` and calls the resolver itself rather than asking one shared "does this user have access to X" function. `resolveSchoolAccess` (Chess School's own entitlement) is comparatively well-contained, called only from within `lib/school/v2/`.
- **No subscription billing exists anywhere.** Confirmed directly in both Stripe routes: `app/api/stripe/checkout/route.ts` (Premium) and `app/api/stripe/checkout-school/route.ts` (Chess School) both use `mode: "payment"` — a one-time charge. There is no `mode: "subscription"` anywhere in the codebase. Premium today is a one-time ₹299 purchase granting 2 years (`PREMIUM_ENTITLEMENT_YEARS = 2`), not a recurring plan.
- **Daily limits are three independent hardcoded constants**, not a shared system: `DAILY_PREVIEW_LIMIT = 3` (`content/lessons.ts`, shared by Kingdom Journey preview *and* Puzzles), `FREE_SESSION_LIMIT = 3` (Chess School sessions), and **no limit constant exists at all** for Train Your Mind.
- **44 migrations exist** (0001→0043, non-sequential numbering from historical superseded/dropped ones); the schema is mature and has real production data behind it (confirmed by this session's own prior work verifying migration 0043 against a live database).

## 2. Proposed architecture

One entitlement *resolution layer* sitting above the existing, unmodified Premium and Chess School systems — not a replacement for either:

```
                    ┌─────────────────────────────┐
                    │   lib/entitlement/index.ts   │   NEW — thin composition layer
                    │   resolveCapabilities(child)  │
                    └──────────────┬───────────────┘
                 ┌─────────────────┼─────────────────┐
                 ▼                 ▼                 ▼
     lib/premium/entitlement.ts   lib/school/v2/access.ts   lib/entitlement/dailyLimits.ts (NEW)
        (UNCHANGED)                  (UNCHANGED)              puzzles/mind-training counters,
                                                               consolidating today's 3 separate
                                                               constants into one registry
```

Every page currently calling `resolvePremiumState` directly keeps working exactly as-is during migration (nothing breaks on day one) — call sites are moved to the new composed resolver **one at a time**, in the phases below, never in one big-bang rewrite.

## 3. Current → Proposed navigation

> **Superseded by your Phase 4 review** — see "Navigation Architecture (final)" above for the approved Home/School/Puzzles/Play/**World** structure. The analysis below is preserved as the record of what was considered and why the *first* alternative (Progress as a tab) was rejected; that reasoning still holds. The second alternative below (keeping Learn as the 5th tab) has since been superseded by the final decision to use World instead — kept here, not deleted, so the reasoning trail stays intact.

**Current**: Home / Puzzles / Play / Learn / More (5 tabs), with Chess School and World reachable only via Home/Play cards.

**Your candidate this round** (Home / Learn / Puzzles / Play / Progress) vs. **the Blueprint's original proposal** (Home / **School** / Puzzles / Play / Learn) — evaluated honestly, not defended reflexively, per your instruction not to blindly reuse the prior answer:

| Candidate | What it fixes | What it reintroduces |
|---|---|---|
| Home / Learn / Puzzles / Play / **Progress** | Gives "how am I doing" a stable home | Chess School — the flagship ₹199 paid product — is back to having **zero primary nav presence**, the single most-flagged problem in the Audit. A parent who paid ₹199 would again need to remember a Home card exists. |
| Home / **School** / Puzzles / Play / Learn | Fixes the flagship-product-invisible problem directly | "Progress" has no single tab, but progress is not itself an *activity* — it's a lens on other activities (puzzle streaks, school sessions, game stats), and research (ChessKid's Report Card, Duolingo) shows progress works best as a *summary surfaced inside* Home/Parent, not a destination a child deliberately navigates to. |

**Recommendation: keep School promoted, fold Progress into Home + Parent Mode rather than giving it a 6th/replacement slot.** A child doesn't wake up wanting to "go look at progress" the way they want to "go do puzzles" — progress is satisfying as a byproduct shown *after* an activity (exactly how Puzzle Tower and Chess School's own session-end screens already work), not as a destination. Final proposal:

```
🏠 Home    🎓 School    🧩 Puzzles    🎮 Play    📚 Learn
```
Top bar (all breakpoints): profile/appearance icon + a sheet containing **World**, **Train Your Mind**, and **Parent Mode** — none of which need full tab slots, all of which currently suffer from *zero or buried* nav presence today, per the Audit.

~~This is unchanged from the Blueprint's §2 after re-evaluating your alternative~~ — **superseded**: your Phase 4 review directed World into the 5th slot instead of Learn, for the explicit reason that World is a named differentiator. See "Navigation Architecture (final)" above for the current, approved structure and how Learn is surfaced without a dedicated tab.

## 4. Current → Proposed learning structure

| | Current | Proposed |
|---|---|---|
| Curricula | 2 parallel (Kingdom Journey + Chess School V2) | **1** — Chess School is the only structured curriculum |
| Kingdom Journey | A second 30-day lesson sequence | Repositioned into Chess Mind World (§6) — its *content* survives, its *curriculum framing* does not |
| Learn / Academy | Library, partially gated | Same shape, gating extended per Blueprint §6 |
| Train Your Mind | Ungated | Gated, 2/category/day |

## 5. Chess School strategy

No change to the Blueprint's §5 recommendation: the existing 30-session, 8-module, 4-act architecture already implements the requested SHOW→EXPLAIN→TRY→PRACTICE→PLAY→REFLECT→CELEBRATE loop (the step-type system — `teach`, `guided_board`, `puzzle_drill`, `bot_match`, `parent_mode`, `pass_and_play`, `exam`, `ceremony`, `recap` — is literally built around this loop already). Work here is **relabeling into your 6 named phases + a content pacing review**, not a rebuild. `resolveSchoolAccess`, migration 0043, `child_school_progress`, and all of `lib/school/v2/` and `components/school/v2/` are reused untouched.

## 6. Kingdom Journey retirement/repositioning strategy — the critical decision, now resolved

**Decision: reposition, do not delete. Kingdom Journey becomes the content backbone of the expanded Chess Mind World.**

**What survives and how:**
- The 6 existing zones (Pawn Village, Knight Forest, Bishop Temple, Rook Fortress, Queen's Court, King's Castle — `content/kingdomZones.ts`) become **World zones**, renamed only where needed to match your suggested naming (e.g. Knight Forest → Knight Kingdom is a copy change, not a data change).
- Each zone's existing lesson content (`content/lessons.ts` — story beat, piece puzzle, mini-match) is **decoupled from its day-number/sequence framing** and repurposed as that zone's pool of **mini-challenges** — the exact shape your brief asks World challenges to have ("chess-themed locations," "mini challenges"), and content that is already written, tested, and translated into working step components. This is content *reuse*, the opposite of "rebuild something that already works."
- `children.current_day` and `child_lesson_progress` are **never dropped or rewritten**. They become the historical record of *how far a child got in the old sequential framing*, read once to compute "which zones/challenges this child has already effectively unlocked" (e.g., a child at `current_day = 14` has already narratively passed through Pawn Village through the start of Bishop Temple, so those zones' challenges open immediately rather than needing to be re-earned) — a one-time, read-only migration mapping, not a schema change.
- **A new, additive column is the only schema work required**: something like `children.world_progress` (jsonb) or a new `child_world_progress` table (mirroring the existing `child_chess_mind_stats` shape) to track *new* World activity going forward (visited zones, challenges completed, achievements) — additive, RLS-scoped identically to every existing child-data table, no existing column touched.
- **The 7-step ritual retires as a mandatory daily sequence** but its component parts (`StoryStep`, `PieceIntroStep`, `MinigameStep`, `PuzzleStep`, `BuddyChat`, `MiniMatchStep`, `RewardStep`) are reusable building blocks for World's mini-challenges — again reuse, not rebuild.
- The AI-backed Ollie chat (`ai_chat` step, `lib/ollie/*`) — currently used only inside the Kingdom Journey ritual — moves into World as Ollie's **Guide** role (see "Ollie Architecture" above) — a documented, intentional third of the one-character/three-context spec, not an accidental inconsistency.

**UX requirement, explicit per your review — old day numbers are never shown as if they're still a curriculum**: a returning child who was "Day 14" never sees "Day 14" anywhere in the new World UI. What they see instead is the *outcome* framed as a World event — e.g. **"🏰 Knight Kingdom Unlocked!"** — computed once from their old `current_day` but never surfaced as a day number, a lesson title, or anything implying a second sequential curriculum still exists. The read-mapping function's output type is a **set of unlocked zone/challenge ids**, not a day number — this is a data-shape decision, not just a copy decision, specifically so no future screen can accidentally leak "Day N" back into the UI by reading the wrong field.

**What a child understands afterward, exactly as your brief specifies:**
- Chess School: *"I am learning chess."*
- Chess Mind World: *"I am exploring the Chess Mind universe."*

**Migration safety**: every currently-in-progress Kingdom Journey user keeps their exact `current_day`/`child_lesson_progress` state, silently reinterpreted as World-zone-unlock state on next login — no progress bar resets to zero, no lost streaks, no support-ticket-generating surprise. This needs a one-time server-side read-mapping function (new, small, pure, testable in isolation) run at World's launch, not a destructive migration.

## 7. Chess Mind World strategy

Builds directly on §6. Free: default zone + 1 unlockable zone (Blueprint §11), reconciled with the existing `kingdomUnlocks.ts` spotlight mechanism rather than creating a second unlock system. Premium: all zones. The existing World philosophy ("two locations, both real, both finished, no wall of locked coming-soon cards") is the standard every newly-repositioned zone must meet before shipping — a zone converted from Kingdom Journey content doesn't ship until it's genuinely finished, even if that means shipping zones incrementally rather than all six at once.

## 8. Learn Chess structure

Fundamentals/Origins/Strategy full; Tactics first-5 (already built, reuse the exact mechanism); Openings first-4 and Endgames first-2 as **new** gating. **Confirmed in your Phase 4 review** ("Keep the approved Free matrix," explicitly re-listing Openings-4/Endgames-2) — this is a deliberate, approved trade even though it's a new restriction versus today's apparently-ungated state, not an oversight. The unlock moment must show value per your gating-UX decision (§10 of your review — "what the child will learn, why it matters, a clear unlock action"), never a bare "Premium Required."

## 9. Puzzle strategy

No architecture change. `DAILY_PREVIEW_LIMIT`, the mate-puzzle API, and Puzzle Tower are reused exactly as-is. Only the "limit reached" copy changes (Blueprint §7). This becomes the **reference implementation** the new central `lib/entitlement/dailyLimits.ts` registry wraps first, since it's already correct.

## 10. Train Your Mind strategy

New gating, no existing behavior to regress (there is none today). 2/category/day, presented per-category with sideways-redirecting copy on exhaustion (Blueprint §8's reasoning stands). This is the **second** system migrated onto the new `dailyLimits` registry, immediately after Puzzles, specifically because it has zero existing behavior to risk breaking.

## 11. Play strategy

No changes. Confirmed no gating exists today at the Play index; none is proposed.

## 12. Game Review strategy

Confirmed via this pass's re-check of `components/game/analysis/*`: `PostGameAnalysis.tsx` already orchestrates `pickBiggestMoment`, move classification, and `recommendPractice`. Free tier = render only `BiggestMomentCard` + one `MistakeCard` + the practice recommendation; Premium = render the full existing stack (all mistake/good-move cards, `MistakeReviewStepper`, `MoveNavigator`). **This is a rendering-gate change in the orchestrator, not new analysis engineering.**

**On "missed opportunities becoming interactive puzzles"**: `SkillPracticeSet.tsx` already exists and already uses engine-free verification (`moveWasFork`, `moveWasHanging`) to turn a detected weakness into practice — this capability effectively already exists in embryonic form. Extending it to generate a puzzle *from the child's own missed position* (rather than a generic themed puzzle) is the one genuinely new piece of engineering implied by your brief, and should be scoped as its own small phase after the free/premium card split ships, not bundled into it.

## 13. Parent strategy

No existing free/premium split (confirmed, Audit §12) — this pass reconfirms every parent-dashboard section renders unconditionally today except the one `PremiumStatusCard`. Blueprint §14's split stands: today's sections (This Week, Skills Snapshot, Learning Progress, Chess Mind Activity, Achievements) become the **free tier** almost as-is; weekly/monthly trend computation and weakness-pattern detection are the genuinely new premium work.

## 14. Free / Chess School / Premium entitlement matrix

Unchanged from Blueprint §13's table — reproduced here as the authoritative version for implementation:

| | 🆓 Free | 🎓 Chess School (₹199 one-time) | 👑 Premium (₹50/mo or ₹349/yr) |
|---|---|---|---|
| Chess School | Sessions 1–3 | All 30, graduation, certificate | Included |
| Learn Chess | Fundamentals/Origins/Strategy full; Tactics 5, Openings 4, Endgames 2 | Same as Free | Everything, unlimited |
| Puzzles | 3/day | Same as Free | Unlimited |
| Train Your Mind | 2/category/day | Same as Free | Unlimited |
| Play | Full | Same as Free | Same |
| Game Review | Best Moment + 1 Lesson + Practice Next | Same as Free | Full stack, trends |
| World | Default + 1 zone | Same as Free | All zones |
| Appearance | 1 default (+ 1 achievement-unlockable, per your addendum) | Same as Free | All themes |
| Parent | Report-Card-style basics | Same as Free + School learning visibility | Full intelligence, reports |

**Chess School and Premium remain independent entitlements**, exactly as the live code already implements them (confirmed: separate columns, separate Stripe products, separate webhook branches) — a School buyer does not get Puzzle/Train-Your-Mind/World limits lifted, only Premium does. This is a genuine product decision this plan is making explicit for the first time, not an accident to fix.

## 15. Daily-limit architecture

New module, `lib/entitlement/dailyLimits.ts`: one typed registry —

```ts
type DailyLimitKey = "puzzles" | "trainYourMind:<category>";
interface DailyLimit { key: DailyLimitKey; freeLimit: number; }
```

— replacing the three scattered constants (`DAILY_PREVIEW_LIMIT`, the *absence* of a Train Your Mind constant, and Chess School's separate `FREE_SESSION_LIMIT`, which stays separate deliberately since it's a lifetime session count, not a daily reset, and conflating the two would be a real bug). Each feature asks the registry "am I under my limit today," the registry reads/writes the *existing* per-feature usage tables (`puzzle_preview_usage`, a **new** small `child_daily_activity` table for Train Your Mind mirroring that same shape) — no existing usage-tracking table is restructured.

## 16. First-time onboarding

Unchanged from Blueprint §3: keep the existing server-enforced sequence (Experience/Age → Avatar → Buddy → Board/Pieces), extend `shouldSkipWelcome` to also fast-path complete beginners into a real first move within the first couple of minutes, and land a first-time beginner directly inside Chess School Session 1 rather than the standard Home. Ask only Experience level (Never played / Know the basics / Already play) as the one meaningful branching question, per your instruction not to add a long questionnaire — a "name" prompt already exists implicitly via avatar/buddy naming flow and doesn't need a separate step.

## 17. Home screen strategy

Unchanged from Blueprint §4: one primary "Your Next Move" CTA, a three-item "Today's Practice" row (Puzzles/Train Your Mind/Play, each showing live remaining-count), and one simple progress summary. Everything else currently on Home is relocated to the section it actually belongs to, not deleted.

## 18. Migration strategy

Three independent migration concerns, sequenced by risk:

1. **Entitlement layer** (§2) — purely additive new module; zero migration risk, old call sites keep working untouched until moved.
2. **Daily limits for Train Your Mind** — new table, new logic, no existing data to migrate (nothing tracked today).
3. **Kingdom Journey → World** (§6) — the one real data-migration concern. Strategy: **read-mapping, not data-mutation**. `current_day`/`child_lesson_progress` are read once per child at first World visit post-launch to compute initial zone-unlock state, written into the *new* `child_world_progress` table. The old columns/table are left completely intact afterward — they become dormant historical data, not deleted, so any bug in the new mapping is trivially recoverable by re-running it (idempotent by construction: always derives from the same unchanged source).

## 19. Existing-user progress preservation

Direct consequence of §18: no child ever sees a reset counter, lost streak, or "start over" prompt. A child who was "Day 14" the day before World launches sees, the day after, that several zones are already unlocked because of the exact progress they already had — reframed, never erased.

## 20. Database changes

**New (additive only):**
- `child_world_progress` (or a `world_progress jsonb` column on `children`) — zones visited/unlocked, challenges completed.
- `child_daily_activity` — mirrors `puzzle_preview_usage`'s shape for Train Your Mind's new daily counters.
- Possibly a thin `entitlement_capability_cache` view/function if the composed resolver needs a single efficient query later — deferred until the entitlement layer's real usage pattern is known, not built speculatively now.

**Changed:** none. **Dropped:** none. Every existing table listed in the Audit (`children`, `child_lesson_progress`, `child_school_progress`, `puzzle_library_solves`, `puzzle_preview_usage`, `child_chess_mind_stats`, `child_opening_encounters`, premium entitlement columns) stays exactly as-is.

## 21. Stripe/subscription work required later (explicitly NOT done now, per instruction)

Scoped for a future, separate, controlled workstream: add `mode: "subscription"` Stripe Checkout support, a recurring-price object for ₹50/mo and ₹349/yr, webhook handling for `invoice.paid`/`customer.subscription.deleted` (events the current one-time-only webhook has no branches for at all), and a decision on what happens to existing ₹299/2-year Premium holders when subscription billing goes live (grandfather them, or run both models in parallel — a business decision, not a technical one, and explicitly out of scope for this plan).

## 22. Files likely to change (by phase, not exhaustive line-level detail)

- **Navigation**: `components/nav/navConfig.tsx`, `PrimaryNav.tsx`, `SideNav.tsx`, `AppTopBar.tsx` (all three title-mapping lists reconciled together, per Audit Risk #4; School and World promoted, Learn re-pointed to a persistent top-bar icon rather than a tab).
- **Ollie voice spec**: new `content/ollie/voice.ts` (or equivalent) documenting the one-character/three-context spec — read by whoever writes School/World/Train-Your-Mind Ollie lines from this point forward.
- **Home**: `app/(tabs)/kingdom-map/page.tsx`, `KingdomMapCards.tsx` (simplified, not deleted wholesale — some sub-components relocate rather than vanish).
- **Entitlement**: new `lib/entitlement/` directory; existing `lib/premium/entitlement.ts` and `lib/school/v2/access.ts` gain zero new logic, only new callers.
- **Learn gating**: `app/academy/openings/page.tsx`, `app/academy/endgames/page.tsx` (new gating, mirroring `app/academy/tactics/page.tsx`'s existing pattern).
- **Train Your Mind**: all seven `app/chess-mind/*/page.tsx` files gain a limit check; new `lib/entitlement/dailyLimits.ts`.
- **Game Review**: `components/game/analysis/PostGameAnalysis.tsx` (rendering gate added).
- **Parent**: `app/parent-dashboard/page.tsx` (section-level gating added).
- **World**: `app/world/page.tsx`, `lib/world/locations.ts`, new zone content adapted from `content/lessons.ts`/`content/kingdomZones.ts`.
- **Chess School**: `components/school/v2/SchoolHome.tsx` (phase relabeling only).

## 23. Files that must remain untouched

`supabase/migrations/0043_chess_school_v2.sql` and every other existing migration; `lib/parentLock/**`; `lib/premium/entitlement.ts`'s internal logic (only new callers, zero edits); `app/api/stripe/**` (no billing work this phase); `lib/chess-engine/**` and move-validation logic; `app/online/**`; `lib/supabase/**` (auth); `content/school/**` and `lib/school/v2/**` (Chess School V2 core); `components/puzzles/PuzzleTower.tsx` and `lib/puzzles/puzzleLevels.ts` (already correct, per Blueprint §7).

## 24. Testing strategy

- New Jest-style Node scripts (matching the existing `scripts/test-*.js` convention) for: `lib/entitlement/` (unit tests, no DB — a pure composition function is trivial to test exhaustively), `dailyLimits.ts` (boundary tests at 0/1/2/3, mirroring `test-puzzle-levels.js`'s own boundary-testing discipline), and the Kingdom-Journey-to-World read-mapping function (property test: for every possible `current_day` 1–30, the resulting unlock set is monotonically non-decreasing and never empty).
- Every existing suite from Audit §16 re-run after every phase, unchanged in scope — this plan adds tests, it does not remove or weaken any existing one.
- A new `test-world-migration.js` specifically asserting no existing child's `current_day`/`child_lesson_progress` row is ever written to by the new read-mapping (read-only enforcement, tested directly).

## 25. Browser/device testing strategy

Unchanged process from every prior phase this project: 375×812, 411×914 (Motorola), 768×1024 (tablet), desktop — verified live in-browser (not just build-checked) for the new Home, the promoted School tab, and World's zone screens specifically, since those are the three genuinely new/changed surfaces; Puzzles/Play/Learn's existing responsive behavior is already verified and only re-checked as part of the full regression pass, not re-verified from scratch.

## 26. Implementation phases (risk-ordered, matches Blueprint §G with the entitlement work made explicit as its own first phase)

1. **Entitlement layer** — build `lib/entitlement/` composing existing resolvers; migrate Puzzles (already-correct reference) to call through it first, as a proof it changes nothing observable.
2. **Navigation** — promote School, retire More into the top-bar sheet, reconcile the three title lists.
3. **Home rebuild** — simplify to one CTA + practice row + progress summary.
4. **Train Your Mind limits** — new `dailyLimits` entries, per-category UI.
5. **Learn Chess gating** — Openings/Endgames, after explicit confirmation the trade-off (§8) is wanted.
6. **Game Review free/premium split** — rendering gate only.
7. **Parent Mode free/premium split** — reclassify existing sections, add new premium trend features.
8. **Kingdom Journey → World migration** — the read-mapping function, new `child_world_progress` table, first repositioned zone shipped end-to-end and verified before the remaining zones follow.
9. **Chess School phase relabeling** — lowest technical risk, sequenced after Home so it links correctly into the new labels.
10. **Final polish and full cross-device regression pass.**

## 27. Risks

1. **Kingdom Journey repositioning is still the largest single risk in this plan**, even with a read-only migration strategy — it changes what "Day 14" *means* to a returning family, even though no data is lost. Recommend a soft, communicated rollout (e.g., an in-app "Your Kingdom is becoming your World!" moment) rather than a silent overnight change, even though technically nothing breaks.
2. **Entitlement-layer adoption must be gradual.** Moving all 11 `resolvePremiumState` call sites to the new composed resolver in one PR would be exactly the "optimize for fewest files changed" anti-pattern the brief warns against — each call site should move in the phase that already touches that page for another reason, not in a dedicated mass-refactor PR.
3. ~~Learn Chess's Openings/Endgames gating is a net-new restriction needing confirmation~~ — **resolved**: explicitly reconfirmed in your Phase 4 review as an approved, deliberate trade. Residual risk is narrower: implement the value-forward unlock copy (§10 of your review) faithfully, so the *new* restriction doesn't read as a regression in practice even though it's an approved one in principle.
4. ~~Two Ollie voices now becomes three~~ — **resolved by decision, not just flagged**: your review approved the one-character/three-context spec ("Ollie Architecture" above). The residual implementation risk is narrower now — someone writing a new line for the Coach or Guide role without checking the spec's shared personality constants first — mitigated by actually creating `content/ollie/voice.ts` (or equivalent) as a real, reviewable artifact in Phase 2 (Navigation) or earlier, not left as a someday-review.
5. **Premium billing mismatch remains unresolved and is explicitly out of scope this phase** — the entitlement layer is designed to be subscription-ready (a `tier` + `expiresAt` shape rather than a hardcoded 2-year constant baked into call sites) specifically so that when the Stripe subscription workstream (§21) does happen, it's a billing change under an unchanged entitlement API, not another full re-plumbing.

## 28. Rollback strategy

- **Entitlement layer**: trivially reversible — it's additive; deleting `lib/entitlement/` and reverting call sites to direct `resolvePremiumState` calls (one file at a time, matching how they were migrated in) fully restores today's behavior.
- **Navigation/Home**: config and component changes with no data dependency — revert via git, no data cleanup needed.
- **Daily limits (Train Your Mind)**: new table can be truncated/dropped with zero impact on any other system (nothing else reads it).
- **Kingdom Journey → World**: the read-mapping never mutates `current_day`/`child_lesson_progress`, so rollback is "stop reading the new `child_world_progress` table and show Kingdom Journey's old UI again" — the source data was never at risk, making this the one migration in this whole plan with a genuinely trivial rollback despite being the highest-perceived-risk item.
- **Game Review / Parent Mode splits**: rendering-gate changes only; rollback is showing all cards to everyone again, exactly as today, no data implication either direction.

---

## Final quality test (per your instruction, run honestly before presenting)

- **Child**: opens the app → sees Ollie + one primary CTA (School continue, or a first-move prompt for a brand-new child) → yes, knows what to do within seconds.
- **Parent**: opens Parent Mode → sees real activity, real streaks, real basic strengths, for free → yes, understands what's happening without paying, and sees a clear, specific reason to consider Premium (trend reports, weakness detection) rather than a vague "unlock everything" pitch.
- **Free user**: full Play, 3 real puzzles a day with a real Puzzle Tower, 2 real Train-Your-Mind challenges per category, 3 free Fundamentals/Origins/Strategy sections in full, a real (if smaller) World, a real basic Game Review — every single one of these is a genuine, complete experience in miniature, not a crippled preview. Passes.
- **Premium user**: unlimited everything they were already enjoying, plus features that don't exist at all for free (trend reports, weakness detection, full move-by-move review, all World zones) — a clear "more of what I already love," not "the version where things finally work." Passes.

---

*Per your instruction: no application code, migrations, entitlements, Stripe configuration, or production data have been touched. Stopping here for your review and approval of this plan before any implementation phase begins.*
