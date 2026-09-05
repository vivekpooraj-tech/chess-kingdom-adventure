"""
Stage 1 of the scalable tactics library — streaming, balanced selection from
the Lichess open puzzle database.

    python scripts/select-tactics-library.py <lichess_db_puzzle.csv.zst> <out.json> [--target 5000]

Streams the compressed .zst (never decompresses to disk, never holds the whole
dataset in memory) and reservoir-samples into (skill, tier) buckets so the
result is a deliberately balanced teaching pool rather than "the first N rows"
or "whatever the rating filter happened to keep".

Why buckets rather than a flat sample: the raw database is dominated by a few
themes -- in a 200k-row sample, `short`/`endgame`/`middlegame`/`crushing` each
appear 75-100k times while `interference` and `zwischenzug` are rare. A flat
random sample of 5,000 would be almost entirely generic middlegame tactics and
would leave a child who needs pin practice with nearly nothing. Sampling per
(skill, tier) guarantees every skill Chess Mind can diagnose has real puzzles
behind it at every difficulty.

This stage only filters and balances. It deliberately does NOT parse chess:
FEN legality, move legality and the opponent's-first-move rewrite are done in
stage 2 (scripts/build-tactics-library.js) with chess.js, which is the same
engine the app itself trusts. Keeping the two apart means the expensive
per-puzzle validation runs over ~2x the target rather than over millions.
"""
import sys, io, csv, json, random, argparse, collections

try:
    import zstandard as zstd
except ImportError:
    sys.exit("zstandard is required:  pip install zstandard")

# Lichess theme -> Chess Mind SkillId (lib/analysis/skills.ts).
#
# Only themes that map to a skill Chess Mind can actually diagnose and coach
# are listed. Anything else is ignored rather than forced into a bucket: a
# puzzle tagged only `master` or `crushing` describes the game it came from,
# not a teachable motif, and pretending otherwise would put unrelated puzzles
# in front of a child told they are practising a specific weakness.
#
# Order matters: the FIRST matching theme wins, so specific motifs are listed
# before the broad fallbacks.
THEME_TO_SKILL = [
    ("fork", "forks"),
    ("pin", "pins"),
    ("skewer", "skewers"),
    ("discoveredAttack", "discovered_attacks"),
    ("doubleCheck", "discovered_attacks"),
    ("hangingPiece", "piece_safety"),
    ("trappedPiece", "piece_safety"),
    ("backRankMate", "king_safety"),
    ("kingsideAttack", "king_safety"),
    ("queensideAttack", "king_safety"),
    ("exposedKing", "king_safety"),
    ("deflection", "tactical_awareness"),
    ("attraction", "tactical_awareness"),
    ("clearance", "tactical_awareness"),
    ("interference", "tactical_awareness"),
    ("xRayAttack", "tactical_awareness"),
    ("intermezzo", "calculation"),
    ("quietMove", "calculation"),
    ("defensiveMove", "calculation"),
    ("sacrifice", "calculation"),
    ("promotion", "endgame"),
    ("advancedPawn", "endgame"),
    ("rookEndgame", "endgame"),
    ("queenEndgame", "endgame"),
    ("pawnEndgame", "endgame"),
    ("bishopEndgame", "endgame"),
    ("knightEndgame", "endgame"),
    ("endgame", "endgame"),
    ("mateIn1", "checks"),
    ("mateIn2", "checks"),
    ("mateIn3", "checks"),
]

# Difficulty tiers by Lichess rating.
#
# The ceiling is deliberately 2200, not 3205: this is a children's learning
# product, and puzzles above roughly 2200 are competitive-player material that
# would teach a child nothing except that they cannot do it. The floor of 500
# drops a small tail of puzzles whose ratings are mostly noise.
TIERS = [
    ("beginner", 500, 1200),
    ("intermediate", 1200, 1700),
    ("advanced", 1700, 2200),
]

def tier_for(rating):
    for name, lo, hi in TIERS:
        if lo <= rating < hi:
            return name
    return None

def skill_for(themes):
    tags = set(themes.split())
    for theme, skill in THEME_TO_SKILL:
        if theme in tags:
            return skill
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--target", type=int, default=5000,
                    help="approximate final library size")
    ap.add_argument("--oversample", type=float, default=2.0,
                    help="keep this multiple of the target so stage 2 can "
                         "discard anything that fails chess validation and "
                         "still hit the target")
    ap.add_argument("--pop-min", type=int, default=80,
                    help="Lichess popularity score; high means human solvers "
                         "upvoted it as a good puzzle")
    ap.add_argument("--nbplays-min", type=int, default=100,
                    help="minimum times played, so ratings are meaningful")
    ap.add_argument("--max-solution-plies", type=int, default=6,
                    help="opponent move + up to 5 solver plies; longer lines "
                         "are calculation exercises, not tactics practice")
    ap.add_argument("--seed", type=int, default=20260905)
    args = ap.parse_args()

    random.seed(args.seed)

    skills = sorted({s for _, s in THEME_TO_SKILL})
    buckets = collections.defaultdict(list)          # (skill, tier) -> rows
    seen = collections.Counter()                     # for reservoir sampling
    per_bucket = max(1, int(args.target * args.oversample / (len(skills) * len(TIERS))))

    stats = collections.Counter()
    dctx = zstd.ZstdDecompressor()
    with open(args.src, "rb") as fh:
        text = io.TextIOWrapper(dctx.stream_reader(fh), encoding="utf-8", newline="")
        reader = csv.DictReader(text)
        for row in reader:
            stats["read"] += 1
            try:
                rating = int(row["Rating"])
                pop = int(row["Popularity"])
                plays = int(row["NbPlays"])
            except (ValueError, KeyError, TypeError):
                stats["bad_numbers"] += 1
                continue

            tier = tier_for(rating)
            if tier is None:
                stats["out_of_rating_band"] += 1
                continue
            if pop < args.pop_min:
                stats["unpopular"] += 1
                continue
            if plays < args.nbplays_min:
                stats["too_few_plays"] += 1
                continue

            moves = row["Moves"].split()
            # A Lichess line is: opponent's move first, then the solver's
            # replies. Fewer than 2 plies means there is nothing to solve.
            if len(moves) < 2 or len(moves) > args.max_solution_plies:
                stats["bad_solution_length"] += 1
                continue

            skill = skill_for(row["Themes"])
            if skill is None:
                stats["no_teachable_skill"] += 1
                continue

            key = (skill, tier)
            seen[key] += 1
            bucket = buckets[key]
            if len(bucket) < per_bucket:
                bucket.append(row)
            else:
                # Reservoir sampling: every qualifying row in the whole file
                # has an equal chance of being kept, without holding them all.
                j = random.randrange(seen[key])
                if j < per_bucket:
                    bucket[j] = row
            stats["kept"] += 1

    out = []
    for (skill, tier), rows in sorted(buckets.items()):
        for r in rows:
            out.append({
                "lichessId": r["PuzzleId"],
                "fen": r["FEN"],
                "moves": r["Moves"],
                "rating": int(r["Rating"]),
                "popularity": int(r["Popularity"]),
                "nbPlays": int(r["NbPlays"]),
                "themes": r["Themes"],
                "gameUrl": r.get("GameUrl", ""),
                "skill": skill,
                "tier": tier,
            })

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh)

    print(f"rows read:        {stats['read']:,}")
    for k in ("bad_numbers","out_of_rating_band","unpopular","too_few_plays",
              "bad_solution_length","no_teachable_skill"):
        print(f"  dropped {k:<22} {stats[k]:,}")
    print(f"candidates kept:  {len(out):,}  (per-bucket cap {per_bucket})")
    print(f"buckets filled:   {len(buckets)} / {len(skills)*len(TIERS)}")
    thin = [f"{s}/{t}={len(v)}" for (s, t), v in sorted(buckets.items()) if len(v) < per_bucket]
    if thin:
        print("under-filled buckets (dataset simply has fewer):")
        print("  " + ", ".join(thin))

if __name__ == "__main__":
    main()
