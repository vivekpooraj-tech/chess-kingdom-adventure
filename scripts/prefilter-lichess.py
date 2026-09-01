"""
Phase 11 - streaming pre-filter for the Lichess open puzzle database.

    python scripts/prefilter-lichess.py <lichess_db_puzzle.csv.zst> <out.csv> [--per-bucket N]

Streams the compressed .zst (never decompresses it to disk, never builds a
big array), keeps only cheap-to-check rows (mate themes, sane rating /
popularity / solution length / piece count), and reservoir-samples within
(mateIn, named-pattern) buckets so no single mating pattern dominates the
pre-filtered pool. The expensive strict forced-mate validation happens
later in scripts/build-launch-library.js on this much smaller CSV.
"""
import sys, io, csv, random, argparse, itertools
import zstandard as zstd

HEADER = ["PuzzleId","FEN","Moves","Rating","RatingDeviation","Popularity","NbPlays","Themes","GameUrl","OpeningTags"]

# Lichess mate-pattern theme tags we treat as a distinct diversity bucket.
NAMED_PATTERNS = [
    "backRankMate","smotheredMate","arabianMate","anastasiaMate","hookMate",
    "bodenMate","doubleBishopMate","dovetailMate","killBoxMate","vukovicMate",
    "cornerMate",
]
# Motif tags worth tracking for the diversity report (not mutually exclusive).
MOTIFS = ["sacrifice","deflection","attraction","discoveredAttack","clearance",
          "pin","interference","quietMove","advancedPawn","promotion",
          "doubleCheck","xRayAttack","skewer","fork","defensiveMove"]

def piece_count(fen_board):
    return sum(1 for c in fen_board if c.isalpha())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--per-bucket", type=int, default=450,
                    help="max rows kept per (mateIn, pattern) bucket")
    ap.add_argument("--generic-per-mate", type=int, default=1600,
                    help="max rows kept per mateIn for puzzles with no named pattern")
    ap.add_argument("--rating-min", type=int, default=400)
    ap.add_argument("--rating-max", type=int, default=2000)
    ap.add_argument("--pop-min", type=int, default=70)
    ap.add_argument("--nbplays-min", type=int, default=30)
    ap.add_argument("--piece-max", type=int, default=24)
    # Per-depth piece ceilings: a busy mate-in-3 is both slow to strictly
    # validate and a poor beginner puzzle, so cap it much tighter than m1.
    ap.add_argument("--piece-max-m1", type=int, default=22)
    ap.add_argument("--piece-max-m2", type=int, default=18)
    ap.add_argument("--piece-max-m3", type=int, default=14)
    args = ap.parse_args()
    depth_cap = {1: args.piece_max_m1, 2: args.piece_max_m2, 3: args.piece_max_m3}
    random.seed(1122)

    buckets = {}          # bucket_key -> list (reservoir)
    bucket_seen = {}      # bucket_key -> count seen
    motif_counts = {m: 0 for m in MOTIFS}
    scanned = 0
    mate_rows = 0
    kept = 0

    dctx = zstd.ZstdDecompressor()
    with open(args.src, "rb") as fh:
        reader = dctx.stream_reader(fh)
        text = io.TextIOWrapper(reader, encoding="utf-8", newline="")
        rdr = csv.reader(text)
        first = next(rdr, None)
        # If the first row isn't the known header, it's data - feed it back in.
        rows = rdr if (first and first[0] == "PuzzleId") else itertools.chain([first], rdr)
        try:
            for cols in rows:
                scanned += 1
                if len(cols) < 8:
                    continue
                pid, fen, moves, rating, _rd, pop, nbplays, themes = cols[:8]
                if "mateIn1" in themes:
                    mate_in = 1
                elif "mateIn2" in themes:
                    mate_in = 2
                elif "mateIn3" in themes:
                    mate_in = 3
                else:
                    continue
                mate_rows += 1
                try:
                    rating_i = int(rating); pop_i = int(pop); nb_i = int(nbplays)
                except ValueError:
                    continue
                if not (args.rating_min <= rating_i <= args.rating_max):
                    continue
                if pop_i < args.pop_min or nb_i < args.nbplays_min:
                    continue
                uci = moves.split()
                if len(uci) != mate_in * 2:            # exact short forced line only
                    continue
                board = fen.split(" ", 1)[0]
                if board.count("K") != 1 or board.count("k") != 1:
                    continue
                if piece_count(board) > min(args.piece_max, depth_cap[mate_in]):
                    continue

                tset = set(themes.split())
                pattern = next((p for p in NAMED_PATTERNS if p in tset), "generic")
                cap = args.generic_per_mate if pattern == "generic" else args.per_bucket
                key = (mate_in, pattern)
                bucket_seen[key] = bucket_seen.get(key, 0) + 1
                buf = buckets.setdefault(key, [])
                if len(buf) < cap:
                    buf.append(cols[:10] if len(cols) >= 10 else cols[:8] + ["", ""])
                else:
                    j = random.randint(0, bucket_seen[key] - 1)
                    if j < cap:
                        buf[j] = cols[:10] if len(cols) >= 10 else cols[:8] + ["", ""]
                for m in MOTIFS:
                    if m in tset:
                        motif_counts[m] += 1
        except (zstd.ZstdError, OSError):
            pass

    out_rows = [r for buf in buckets.values() for r in buf]
    random.shuffle(out_rows)
    with open(args.out, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(out_rows)

    kept = len(out_rows)
    print(f"scanned rows      : {scanned}")
    print(f"mate1/2/3 rows    : {mate_rows}")
    print(f"kept (prefiltered): {kept}")
    by_mate = {}
    for (mi, pat), buf in buckets.items():
        by_mate[mi] = by_mate.get(mi, 0) + len(buf)
    print(f"kept by mateIn    : {by_mate}")
    print("kept by bucket    :")
    for k in sorted(buckets, key=lambda k: (k[0], k[1])):
        print(f"  m{k[0]:<1} {k[1]:<16} seen={bucket_seen[k]:<7} kept={len(buckets[k])}")
    print("motif tag counts (within mate rows that passed cheap filters):")
    for m, c in sorted(motif_counts.items(), key=lambda x: -x[1]):
        print(f"  {m:<18} {c}")

if __name__ == "__main__":
    main()
