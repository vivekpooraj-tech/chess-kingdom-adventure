# Chess Mind — Competitor & UX Research (Phase 2)

Web research conducted September 2026. Sources listed per section. This document extracts **principles**, not UI to copy — no competitor layout, art, or copy is reproduced here.

---

## 1. Chess.com

**What it does well**
- The single largest content and puzzle library in chess (500,000+ puzzles, thousands of video lessons), so a paying adult never runs out of material.
- **Dr. Wolf** (see §5) is Chess.com's own answer to "AI coach as a character" — validating that a friendly, patient coach persona for real-time feedback is a proven pattern, not a novelty.
- Diamond membership bundles everything (lessons, puzzles, analysis, no ads) into one clear top tier, and a Friends & Family plan spreads the cost across a household — relevant since Chess Mind is also a household/parent-purchase product.

**What it does poorly**
- Its own users describe the core problem in one sentence: *"the challenge is navigation: knowing which lesson to take next among thousands of options."* Chess.com's scale becomes a liability for a beginner — total content ≠ a learning path.
- Lessons, Puzzles, and Play exist as three large, independently-browsable libraries with no single mandatory sequence connecting them for a beginner. An adult self-directs; a child cannot.
- Pricing is comparatively high for a child-focused buyer (~$120/year for Diamond, ~$12–20/month) — reasonable for a serious adult player, not calibrated for "one parent buying one kid's course."

**Best pattern to take**: a named AI coach character (Dr. Wolf) that gives short, personality-driven, real-time feedback during and after a game, calibrated for beginners specifically (not full engine output).

**What Chess Mind should NOT copy**: the "everything is a browsable library" structure. A library is the right shape for **Learn Chess** (see Blueprint), never for the first-time path.

Sources: [Best Chess Lesson Platforms Compared 2026](https://oldschoolchess.com/compare/best-chess-learning-websites), [Chess Learning for Different Skill Levels](https://circlechess.com/blog/chess-learning-for-different-skill-levels-beginner-to-master-progression), [Diamond Membership: Explained](https://www.chess.com/blog/therealneevan/diamond-membership-explained), [What does each level of premium membership get me?](https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me)

---

## 2. Lichess

**What it does well**
- Radical simplicity: no ads, no paywall, no forced registration to play a single game. The single biggest lesson from Lichess is **zero friction to the first meaningful action** — you can be moving a piece within seconds of landing on the site.
- Everything free means Lichess never has to design a paywall at all — an extreme end of the spectrum, useful as a reminder that *every* lock Chess Mind adds has a real cost in trust.

**What it does poorly (for our audience)**
- Built for players who already know chess and want a fast, clean interface — it has essentially no structured beginner curriculum, no character/mascot, and no child-safety layer. It is not a competitor for the "teach a child chess" job; it's a competitor for the "play chess" job only.

**Best pattern to take**: minimize the number of steps between "I opened the app" and "I am doing the core activity." Applies directly to Chess Mind's Play and Puzzles sections, less to Chess School (which is deliberately guided, not instant).

**What Chess Mind should NOT copy**: Lichess's total absence of guidance is wrong for a first-time child user — a child needs more scaffolding, not less.

Sources: [Lichess — Wikipedia](https://en.wikipedia.org/wiki/Lichess), [Lichess UI/UX discussion — Hacker News](https://news.ycombinator.com/item?id=31223505)

---

## 3. ChessKid

**What it does well**
- Extremely clear four-part activity model on its own marketing site: **Play Kids / Play Bots / Watch Lessons / Puzzles** — four verbs, not four nouns. A child immediately knows these are four different *things to do*, not four different content libraries to browse.
- Hard safety boundaries baked into the product, not bolted on: no free chat, auto-generated usernames, activity restricted to approved contacts. This is table stakes for a children's product and something Chess Mind's existing Parent Lock already addresses architecturally.
- **Report Cards** are the single best parent-facing pattern found in this research: one screen listing Fast Chess, Slow Chess, Puzzles, Lessons, Computer Workouts, Videos, and Articles attempted/completed, a Level + progress bar, and last-login recency — all without requiring payment to view. This directly validates the brief's "never lock basic parental visibility" rule; ChessKid already proves it works commercially.
- 150+ short interactive lessons "tailored to skill level and pace," translated into 30+ languages — bite-sized over long-form, matching the "no huge paragraphs" rule.

**What it does poorly**
- A single "Gold" tier with no clearly-communicated free-tier value proposition beyond "some free games" — the free/paid line is fuzzier here than Chess.com's, which can read as a soft paywall dressed as a full product.
- ChessKid Adventure (§4) — a *separate app* for the more gamified/story experience — was discontinued. Splitting the "fun world" experience into a second app the user has to separately discover and install is a structural mistake Chess Mind avoids by design (World/Puzzles/School are routes inside one app, not separate installs).

**Best pattern to take**: the four-verb activity split, and the Report Card as the template for Chess Mind's free Parent Mode.

Sources: [ChessKid.com](https://www.chesskid.com/), [Complete Guide to ChessKid Features](https://www.chesskid.com/learn/articles/complete-guide-to-chesskid), [How can I see my kid's progress?](https://support.chesskid.com/en/articles/8863301-how-can-i-see-my-kid-s-progress), [Top 3 Ways To Use Report Cards](https://www.chesskid.com/learn/articles/5-ways-to-use-report-cards), [Best Chess App for Kids 2026 — World Chess Shop](https://shop.worldchess.com/blogs/news/best-chess-app-for-kids)

---

## 4. ChessKid Adventure (and Magnus' Kingdom of Chess)

**What it did well**
- ChessKid Adventure: a bounded, countable structure — *6 quests, 200+ mini-challenges, 40+ characters across 15 difficulty levels* — proves that a gamified "world" layer works best when it has a visible finite shape (a child can see there are 6 quests, not an infinite map), and rewards (coins → costume unlocks) tied to genuine chess actions.
- Magnus' Kingdom of Chess (now *DragonBox Learn Chess*) has arguably the single cleverest mechanic found in this research: **the player's own on-screen character is a chess piece, and it can only move around the adventure world the way that piece moves in real chess.** Learning is encoded directly into world traversal, not bolted on as a separate quiz layer. No ads, no IAP — a premium one-time product for ages 5+.

**What they did poorly / risk to flag**
- **ChessKid Adventure is discontinued** ("no longer supported"). The most direct lesson: a gamified world spun off as its own separate app is a business and product risk — it can be quietly sunset without the core product being affected, which also means it was never load-bearing for retention of the *core* product. Chess Mind World must stay a mode inside Chess Mind, exactly as currently built, not a spinoff.
- Both products lean on "unlock costumes/coins" reward loops that are cosmetic-only — motivating short-term, but disconnected from actual chess skill signal. Chess Mind's own Puzzle Tower (real solved-count driving real levels) is already a stronger pattern than pure cosmetic collection.

**Best pattern to take**: a *finite, nameable* world shape (N zones, not an open map), and mechanics where movement/progression is literally made of chess logic, not generic game skin over arbitrary progress.

**What Chess Mind should NOT copy**: don't build World as a separate installable app; don't make its rewards purely cosmetic with no tie back to real skill.

Sources: [New ChessKid Adventure App Released](https://www.chess.com/news/view/new-chesskid-adventure-app-released), [What is unique about ChessKid Adventure?](https://support.chesskid.com/en/articles/8887479-what-is-unique-about-chesskid-adventure), ['Magnus' Kingdom' Turns Chess Into an Adventure Game](https://geekdad.com/2018/07/magnus-kingdom-turns-chess-into-an-adventure-game/), [Magnus' Kingdom of Chess for Kids Ages 5+](https://www.learnamic.com/learning-resources/magnus-kingdom-of-chess)

---

## 5. Dr. Wolf (Chess.com's AI coach)

**What it does well**
- The core pitch is *"the world's best virtual chess coach"* delivering **real-time commentary during games** — pointing out tactical ideas, flagging mistakes, suggesting alternatives — calibrated specifically for beginner-to-intermediate players (roughly up to 1300–1500), deliberately **not** showing raw engine-level analysis to that audience.
- Four distinct coach *personalities* to choose from, each with its own voice and teaching style — evidence that a single well-defined character voice (Chess Mind already has this in Ollie) is a legitimate, provenapproach rather than needing a generic "AI assistant."
- Reported outcome: over 80% of users say their confidence increased — the design goal is explicitly *confidence*, not just correctness.

**What it does poorly**
- It's a bolt-on coaching layer over Chess.com's existing games, not a structured curriculum — it teaches "in the moment" but doesn't replace a 30-day structured course. Directly informs why Chess Mind needs *both* Ollie-the-coach-in-the-moment AND Chess School as a separate structured product — they answer different questions.

**Best pattern to take (directly maps to the Game Review section of the Blueprint)**: after/during a game, short, personality-voiced, non-intimidating commentary — "look again, is your knight safe?" — instead of a scary evaluation graph. This is precisely the tone the brief already specifies for Ollie, and Dr. Wolf is proof that tone converts into real user confidence gains.

Sources: [Dr. Wolf, Personalized Chess Coaching App, Joins Chess.com](https://www.chess.com/news/view/dr-wolf-joins-chess-com), [Learn Chess with Dr. Wolf — App Store](https://apps.apple.com/us/app/learn-chess-with-dr-wolf/id1353041020), [Dr. Wolf — TrendingChess.com](https://trendingchess.com/dr-wolf)

---

## 6. Magnus Trainer / Play Magnus

**What it does well**
- Explicitly described by reviewers as *"a Duolingo-style progression of short lessons and mini-games"* — 250+ lessons authored by GMs and learning experts, structured as bite-sized units with dozens of levels and thousands of puzzles reinforcing each one immediately after it's taught. This is strong independent validation of the brief's SHOW → EXPLAIN → TRY → PRACTICE → PLAY loop: a well-funded, GM-backed product converged on the same structure.
- Works for ages 5 and up with the same core content, adaptively — one product, not a separate "kids version" and "adult version."

**What it does poorly**
- Now in maintenance mode after Chess.com's 2022 acquisition of Play Magnus Group — a caution that even GM-quality content doesn't guarantee product longevity if it's not tied into a bigger platform's core loop. Reinforces keeping Chess School integrated into Chess Mind's single app/account/progress system rather than siloed.

**Best pattern to take**: immediately following every taught concept with a mini-game/puzzle that uses *only* that concept, before moving on — never teach three ideas and then test all three at once.

Sources: [Magnus Trainer — App Store](https://apps.apple.com/us/app/magnus-trainer-train-chess/id1097863089), [Magnus Trainer — Play Magnus company page](https://company.playmagnus.com/magnus-trainer), [Play Magnus Group — Grokipedia](https://grokipedia.com/page/Play_Magnus_Group)

---

## 7. Duolingo (learning-UX reference, not a chess product)

**What it does well — the most transferable research of this whole document**
- **Onboarding sequencing**: personalization questions first (build self-commitment) → a "building your course" loading moment (triggers reciprocity — the product visibly worked *for you*) → the first interactive lesson happens *before* account creation is required. Deferring signup until after the first real win produced a measured **20% jump in next-day retention** when Duolingo made this change. *(Chess Mind's own onboarding brief already mirrors the personalization-question step — "have you played before" — but currently gates real content behind auth earlier; see Audit for where this bites.)*
- **The streak mechanic**: turns a long-term, abstract goal ("get better at chess") into a single daily yes/no decision, powered by loss-aversion (losing a 30-day streak feels worse than never having had one). Reported to raise commitment by ~60% in Duolingo's own data.
- **XP and badges as secondary motivators**: leaderboards reportedly drive ~40% more engagement, badges ~30% more completion — but these sit *underneath* the streak as the primary loop, not above it.

**What it does poorly / risk to flag**
- Duolingo's gamification is sometimes criticized as manipulative/guilt-driven at the extreme (aggressive streak-loss notifications, mascot guilt-tripping). For a children's product specifically, the brief's own Rule 5 ("mistakes should feel safe," never "you failed") is the correct guardrail against copying Duolingo's harder-edged retention tactics.

**Best pattern to take**: (1) defer any friction (signup, subscription talk) until *after* the user has felt one real success; (2) one simple, central daily-return mechanic (a streak or equivalent) rather than ten simultaneous meters.

**What Chess Mind should NOT copy**: guilt-based streak-loss messaging, or making the streak feel more important than the actual chess understanding underneath it.

Sources: [Duolingo — an in-depth UX and onboarding breakdown](https://userguiding.com/blog/duolingo-onboarding-ux), [Duolingo Streak System Breakdown](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f), [Duolingo's Gamification Secrets](https://www.orizon.co/blog/duolingos-gamification-secrets), [Duolingo UX Breakdown 2026](https://www.925studios.co/blog/duolingo-design-breakdown)

---

## 8. Paywall / freemium UX (general research, applied to a children's product)

- The dominant, evidence-backed rule across every source reviewed: **"Locking features before users understand why they matter makes the paywall feel arbitrary instead of motivating."** Value must be *felt* before a lock is *seen* — this is the direct research backing for the brief's own Rule 9.
- **Placement matters more than aggressiveness**: the best-converting pattern shown across paywall UX research is surfacing the upgrade prompt *at the natural moment of hitting a real limit* (e.g., "3rd puzzle solved today") rather than upfront on first open. Chess Mind's existing `DAILY_PREVIEW_LIMIT` puzzle-cap-then-prompt pattern (found in the codebase audit) already matches this — it should be the template extended to Train Your Mind and Learn Chess, not reinvented.
- **Soft paywalls** (browse everything, but acting on locked content prompts upgrade) build more trust than **hard paywalls** (content invisible until paid) — directly supports the brief's instruction to show *what* Tactics/Openings/Endgames contain, with only the deeper items locked, rather than hiding the whole category.

Sources: [Hard paywall vs soft paywall — RevenueCat](https://www.revenuecat.com/blog/growth/hard-paywall-vs-soft-paywall), [Paywall UX Design Best Practices — webuild](https://webuild.io/paywall-ux-design-best-practices/), [8 paywall test ideas — RevenueCat](https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue)

---

## 9. Children's attention span / session length (general research)

- No authoritative body (including the American Academy of Pediatrics, which dropped its old 2-hour cap) sets a hard maximum session length for ages 6–12 doing educational activity specifically — the literature is about *total daily screen time*, not single-session structured learning, and even that shows no consistent effect on attention span at moderate levels.
- The practical, safely-supported takeaway for product design (not a hard clinical number): **shorter, clearly-bounded sessions with natural stopping points beat one long undifferentiated block**, which is exactly what the brief's 15→30→45→60-minute progression with pause/resume already assumes. This research doesn't contradict that plan; it just confirms there's no clinical reason to make sessions *longer* than the brief already proposes, and every practical reason (working memory, real classroom pedagogy for this age group) to keep early sessions short.

Sources: [Screen Time and Attention Subdomains in Children Aged 6–10](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9497664/), [Screen time among school-aged children — systematic review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10113131/), [Finding balance: screen time for kids 6–12](https://nortonchildrens.com/news/finding-balance-how-to-manage-screen-time-for-kids-ages-6-to-12-without-the-battles/)

---

## 10. Pricing context (for calibrating Chess Mind's own tiers, not for copying)

| Product | Price found | Notes |
|---|---|---|
| ChessKid Gold | ~$49/year (as low as ~$10/month at list) | Single tier, US-centric pricing |
| Chess.com Diamond | ~$120/year (~$12–20/month) | Top tier; Family plan splits cost across up to 6 people |
| Chess Mind Premium (existing) | ₹50/month or ₹349/year (~$0.60/mo, ~$4/yr) | Already an order of magnitude below both US competitors |
| Chess Mind School (existing) | ₹199 lifetime (~$2.30 one-time) | No direct competitor equivalent found — both ChessKid and Chess.com bundle "structured course" into their single subscription rather than selling it separately at a lifetime price |

**Implication for the Blueprint**: Chess Mind's pricing is already positioned far below both major US competitors for the Indian market, and the three-tier split (free / one-time School / recurring Premium) has **no direct precedent** in either competitor examined — it's a genuine point of differentiation, not a gap to fix. The Blueprint should preserve this pricing structure exactly as given in the brief and focus restructuring effort on *communicating* the three tiers clearly, not on changing the numbers.

Sources: [How is membership price decided — Chess.com forum](https://www.chess.com/forum/view/general/how-is-membership-price-decided-in-various-countries), [Diamond Membership: Explained](https://www.chess.com/blog/therealneevan/diamond-membership-explained), [Family Sharing Plan — ChessKid](https://support.chesskid.com/en/articles/8868445-family-sharing-plan)

---

## Cross-Competitor Synthesis — what Chess Mind should take, and what to deliberately avoid

**Take:**
1. Four clear *verbs* for primary navigation (ChessKid: Play/Watch/Puzzle), not feature nouns.
2. A named, single-voice coach character delivering short, encouraging, in-context commentary (Dr. Wolf + Ollie already fits this).
3. Teach-one-concept → immediately-practice-that-one-concept, before introducing the next (Magnus Trainer).
4. A finite, nameable gamified world (N zones, not an open map) whose progression mechanics are made *of* chess logic, not generic game skin (ChessKid Adventure's bounded quest count; Magnus' Kingdom's piece-movement mechanic).
5. A free Report-Card-style parent view with zero paywall on basic visibility (ChessKid).
6. Defer friction (signup, upgrade prompts) until after one genuine success moment (Duolingo).
7. One primary daily-return mechanic, not many competing meters (Duolingo streak).
8. Soft paywalls that show *what's inside* a locked section before asking for payment (paywall UX research + Chess Mind's own existing puzzle-cap pattern).

**Deliberately avoid:**
1. Chess.com's "browse a library of thousands" as the *default* first-time path — fine for Learn Chess as an opt-in library, wrong as the front door.
2. Splitting the gamified/story experience into a separate installable app (ChessKid Adventure's discontinuation is the cautionary tale).
3. Purely cosmetic reward loops disconnected from real skill signal (coins → costumes with no tie to actual chess ability).
4. Guilt-based streak-loss messaging or mascot shaming (Duolingo's harder edge) — directly conflicts with the brief's "mistakes should feel safe" rule.
5. Showing raw engine evaluation bars/numbers to a beginner child (Dr. Wolf explicitly avoids this for its target audience; Chess Mind's Game Review must too).
