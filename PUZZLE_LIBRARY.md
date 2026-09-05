# Chess Mind puzzle libraries

Chess Mind now has **two** puzzle pools. They are separate on purpose.

| | Mate pool | Tactics library |
|---|---|---|
| Where | `content/puzzles.ts` | `data/puzzles/tactics-library.json` |
| Size | 1,000 | 5,000 |
| Kind | forced mate only | forks, pins, skewers, discovered attacks, deflection, endgames, mates |
| Solution | none stored | explicit forced line |
| Correctness | proven at runtime (`lib/chess-engine/puzzleValidation.ts`) | proven at build time, compared at runtime |
| Reaches the browser | **no** — one puzzle per request | **no** — one puzzle per request |
| Served by | `/api/puzzles/mate` | `/api/puzzles/next` |
| Used by | `/puzzles` (Puzzle Trainer + Daily Challenge) | `/puzzles/tactics` (Tactics Trainer) |

They are not merged because their notions of "correct" genuinely differ. The
mate pool accepts **any** move that delivers checkmate, which is right: a mate
is a mate. A Lichess tactic has one intended line, so a move is checked against
that line. One component doing both via a mode flag would make it easy to
validate the wrong way round, so they are two components.

## Provenance and licence

Source: the **Lichess open puzzle database**, which this project's existing
notes (`scripts/puzzle-launch-review.md`) already record as **CC0**. CC0 is a
public-domain dedication, so no attribution is legally required.

Even so, each puzzle keeps `lichessId` and `gameUrl`, so the original game can
always be linked or credited. No licence text is asserted beyond what the
project already documented — if you need a formal statement, confirm the
current terms at <https://database.lichess.org/> rather than relying on this
file.

The source archive (~290 MB `.zst`, ~6.1M puzzles) is **not** in the repository
and never should be. It is streamed during curation and never fully
decompressed to disk.

## How the library is built

Two stages, mirroring the repo's existing pipeline convention (cheap streaming
filter in Python, expensive chess validation in Node).

```bash
# 1. Stream 6.1M puzzles, filter and balance -> ~10k candidates (~70s)
python scripts/select-tactics-library.py \
  <path>/lichess_db_puzzle.csv.zst /tmp/tactics-candidates.json --target 5000

# 2. Validate with chess.js and shape -> exactly 5,000
node scripts/build-tactics-library.js \
  /tmp/tactics-candidates.json data/puzzles/tactics-library.json --target=5000

# 3. Re-verify every puzzle independently of the builder
node scripts/verify-tactics-library.js
```

### Why balanced buckets, not a flat sample

The raw database is wildly uneven — in a 200k-row sample `short`, `endgame`,
`middlegame` and `crushing` each appear 75–100k times while `interference` and
`zwischenzug` are rare. A flat random 5,000 would be nearly all generic
middlegame tactics, and a child told to practise pins would find almost
nothing. Selection therefore reservoir-samples into **(skill × tier)** buckets:
10 skills × 3 tiers = 30 buckets, ~167 puzzles each.

### Filters applied

- rating 500–2199 (above ~2200 is competitive-player material, not teaching)
- popularity ≥ 80, plays ≥ 100 (human-upvoted, and enough plays for the rating
  to mean something)
- solution 2–6 plies
- must map to a skill Chess Mind can actually diagnose — a puzzle tagged only
  `master` or `crushing` describes its game, not a teachable motif

### The opponent's move

A Lichess FEN is the position *before* the opponent blunders, and the first
move of `Moves` is that blunder. Storing it raw would show the child the wrong
position and the wrong side to move. The builder applies that move once, so the
stored FEN is exactly what the child sees and `solution[0]` is their own first
move. Even indices are the child's moves; odd indices are the opponent's
scripted replies. This keeps the runtime dumb, which is where correctness bugs
are expensive.

## Serving architecture

```
data/puzzles/tactics-library.json   1.71 MB, 5,000 puzzles — server only
        ↓ fs.readFileSync, lazily, cached per server instance
lib/puzzles/tacticsLibrary.server.ts
        ↓ selectTacticsPuzzle({ skill, tier, exclude })
app/api/puzzles/next
        ↓ ~360 bytes
TacticsTrainer (browser)
```

The library is read with `fs` rather than `import`ed **specifically** so the
bundler cannot inline it. Verified: grepping the built client chunks for a
library puzzle id returns nothing, while the same grep for a `content/puzzles.ts`
id returns a chunk. Next.js traces the JSON into the function bundle
automatically (it appears in `route.js.nft.json`), so no config change is needed.

The browser download does not change as the library grows — 5,000 or 500,000
puzzles both cost ~360 bytes per puzzle served.

The mate pool is server-only by the same principle, via
`lib/puzzles/matePool.server.ts` and `/api/puzzles/mate` (~140 bytes per
puzzle).

### Keeping it that way

Two things protect this, because nothing in the type system does:

1. **Wire types live in neutral modules** — `lib/puzzles/mateTypes.ts` and
   `lib/puzzles/tacticsTypes.ts`. A client component must never import a type
   from a route or a `.server` module: that works only because TypeScript
   erases type-only imports, so deleting one keyword in a refactor would
   silently pull the whole dataset back into the bundle.
2. **`scripts/check-puzzle-bundle.js`** asserts it against the real build
   output and exits non-zero on violation. Run it after `npm run build`.

The mate pool IS legitimately present in `/free-play` and `/online/[gameId]`
chunks, which reach it through `PostGameAnalysis -> SkillPracticeSet ->
lib/training/recommendation.ts` for skill-practice positions. The guard allows
that and only fails on a puzzle route's first load.

## Selection and personalization

All from signals the app already records; nothing is invented.

- **Skill** — an explicit `?skill=` (e.g. from an Ollie recommendation) wins;
  otherwise the child's recurring weakness from `child_skill_signals`, via the
  same `deriveLearnerProfile` that Ollie and the Chess Brain panel use, so all
  three agree about what needs work.
- **Difficulty** — experience level sets the floor; promotion needs a real track
  record (≥20 solves at ≥70% first-try). There is deliberately no demotion: the
  widening below already prevents anyone being stuck on something too hard, and
  a visible downgrade after a bad session is discouraging.
- **Repetition** — everything in `puzzle_library_solves` for that child is
  excluded, plus up to 50 client-supplied ids. Ids are namespaced `lc-` so they
  share that table with the mate pool without colliding. No migration was
  needed.
- **Widening** — preferred skill+tier → any skill in that tier → adjacent tiers
  → anything unexcluded → anything. The final step permits a genuine repeat,
  which is the right outcome once a child has solved a bucket: repetition beats
  an empty screen, and spaced repetition is a feature.

The API only returns a `reason` when the pick really was driven by a recorded
weakness *and* the puzzle found is for that skill — so the UI can never claim a
justification that does not exist.

## Scaling past 5,000

The in-memory load is the simplest correct thing at this size and costs a warm
server nothing. Past roughly **50k** puzzles, move the pool into Postgres and
select with SQL. `selectTacticsPuzzle` is deliberately the only thing that
knows how puzzles are stored, so that swap stays inside one file.

## Known limitations

- Two trainers now exist. Justified — their notions of "correct" genuinely
  differ — but it is product surface area worth a deliberate decision.
- Tactics puzzles are not yet wired into Ollie's practice runner or the Game
  Review's "practice this skill" flow — both still use the mate pool and the
  small pattern set. The API already accepts `?skill=`, so this is a wiring
  job, not new infrastructure.
