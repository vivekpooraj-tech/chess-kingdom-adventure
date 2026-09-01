import { ChessPuzzle } from "@/lib/types";

// Every position below is verified — not hand-trusted — by
// `node scripts/verify-puzzles.js --pool`, which re-checks this exact
// array. Each entry must be a LEGAL position (exactly one king per side,
// kings not adjacent, and — the check that was missing when eight of
// these shipped with a heavy piece already aiming down a file at the
// cornered enemy king — the side NOT to move is not already in check),
// and must have a genuine forced mate at EXACTLY its declared `mateIn`
// depth (no faster mate hiding in the position; for mateIn 2/3 the
// forcing line holds against every legal defense, not just one expected
// reply). chess.js loads illegal FENs silently, so these are enforced
// explicitly.
//
// `level` (1-6) is the Daily Challenge difficulty tier — computed
// objectively by scripts/compute-puzzle-levels.js from each puzzle's
// solution precision and defender-reply count, not hand-assigned. See that
// script's own comments for exactly how, and this phase's final report for
// why level 6 currently has no puzzles (an honest content-pool gap, not an
// algorithm limitation).
export const PUZZLES: ChessPuzzle[] = [
  { id: "m1-backrank-rook",    fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate",      level: 1 },
  { id: "m2-two-rooks-a",      fen: "k7/1R6/8/8/8/8/8/KR6 w - - 0 1",    sideToMove: "w", mateIn: 2, theme: "Rook Ladder",         level: 3 },
  { id: "m3-queen-net-a",      fen: "k7/2Q5/8/K7/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
  { id: "m1-backrank-queen",   fen: "6k1/5ppp/8/8/8/8/8/4Q2K w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate",      level: 1 },
  { id: "m2-two-rooks-b",      fen: "6k1/8/8/8/8/8/R7/1R5K w - - 0 1",   sideToMove: "w", mateIn: 2, theme: "Rook Ladder",         level: 4 },
  { id: "m3-queen-net-b",      fen: "k7/8/3Q4/1K6/8/8/8/8 w - - 0 1",    sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
  { id: "m1-corner-queen-a",   fen: "k7/7Q/1K6/8/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 1, theme: "Cornered King",       level: 1 },
  { id: "m2-queen-king-a",     fen: "6k1/8/8/5QK1/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 2, theme: "Queen & King",        level: 3 },
  { id: "m3-queen-net-c",      fen: "7k/8/6Q1/5K2/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
  { id: "m1-corner-queen-b",   fen: "7k/Q7/6K1/8/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 1, theme: "Cornered King",       level: 1 },
  { id: "m2-queen-king-b",     fen: "k7/8/8/KQ6/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 2, theme: "Queen & King",        level: 3 },
  { id: "m3-rook-box-a",       fen: "7k/6R1/8/7K/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 3, theme: "Rook Box Mate",       level: 5 },
  { id: "m1-smothered-knight", fen: "6rk/6pp/7N/8/8/8/8/7K w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Smothered Mate",      level: 1 },
  { id: "m3-rook-box-b",       fen: "k7/1R6/8/K7/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Rook Box Mate",       level: 5 },
  { id: "m1-king-rook-ladder", fen: "4k3/8/4K3/8/8/8/8/R7 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "King & Rook Mate",    level: 1 },
  { id: "m3-rook-box-c",       fen: "k7/8/8/K1R5/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Rook Box Mate",       level: 5 },

  // Added for Daily Challenge personalization (Phase 25) -- each verified
  // via scripts/verify-puzzles.js exactly like the 16 above (no easier
  // hidden mate, sound against every legal defense). Several other
  // hand-composed candidates covering more named mate patterns (Arabian,
  // Anastasia's, Boden's, Hook, discovered check, double check) were
  // attempted and did NOT verify (hidden faster mate, no mate at all, or a
  // chess.js edge case on deep recursive checking) — discarded rather than
  // shipped unverified. See that phase's final report.
  { id: "m1-corner-rook-a",      fen: "k7/8/1K6/8/8/8/8/2R5 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "Corridor Mate",       level: 2 },
  { id: "m1-corner-rook-b",      fen: "7k/8/6K1/8/8/8/8/5R2 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "Corridor Mate",       level: 2 },
  { id: "m1-knight-rook-a",      fen: "7k/8/5NK1/8/8/8/8/6R1 w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Knight & Rook Mate",  level: 2 },
  { id: "m1-ladder-mid-a",       fen: "3k4/8/3K4/8/8/8/8/7R w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Rook Ladder",         level: 1 },
  { id: "m1-two-rooks-adjacent", fen: "1k6/8/1K6/8/8/8/R7/R7 w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Rook Ladder",         level: 2 },
  { id: "m2-two-rooks-mirror",   fen: "7k/6R1/8/8/8/8/8/6RK w - - 0 1",   sideToMove: "w", mateIn: 2, theme: "Rook Ladder",         level: 3 },
  { id: "m2-queen-king-mirror",  fen: "7k/8/8/6QK/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 2, theme: "Queen & King",        level: 3 },
  { id: "m3-queen-short-side",   fen: "k7/8/1Q6/2K5/8/8/8/8 w - - 0 1",   sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },

  // Phase 10 -- first batch imported from the Lichess open puzzle database
  // (https://database.lichess.org, CC0), filtered to mateIn1/2/3 at rating
  // <= 1600 / popularity >= 90, converted by scripts/import-puzzles.js, then
  // hand-reviewed (see scripts/puzzle-candidates.review.md) and re-verified
  // by `node scripts/verify-puzzles.js --pool`. Unlike the hand-composed
  // studies above these are real game positions, so they carry more pieces
  // -- they're the accessible on-ramp for each mate depth, not harder for
  // being busier. Lichess source id kept in the comment for provenance;
  // levels are from scripts/compute-puzzle-levels.js like every other entry.
  { id: "m1-pawn-break-mate",      fen: "8/8/5pkp/1RP5/1P3PKP/r7/8/8 b - - 0 48",            sideToMove: "b", mateIn: 1, theme: "Pawn Mate",              level: 1 }, // lichess 00EWi
  { id: "m1-queen-bishop-g2",      fen: "7k/6p1/8/4p3/Pp1Q4/1P3b1q/6P1/5RK1 b - - 0 45",     sideToMove: "b", mateIn: 1, theme: "Queen & Bishop Mate",   level: 2 }, // lichess 00H9n
  { id: "m1-backrank-bishop-guard", fen: "6k1/5ppp/5Bq1/8/p3R3/P6P/5rB1/R5K1 w - - 0 30",    sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate",         level: 1 }, // lichess 00Hfa
  { id: "m1-backrank-sealed",      fen: "4r3/3R1pkp/6p1/1P6/1b6/5B2/1P1R1PPP/6K1 b - - 0 36", sideToMove: "b", mateIn: 1, theme: "Back-Rank Mate",         level: 1 }, // lichess 00BQD
  { id: "m1-smothered-corner",     fen: "2r3k1/5ppp/2P5/8/5P2/P5Pn/6BP/R5RK b - - 0 32",     sideToMove: "b", mateIn: 1, theme: "Smothered Mate",         level: 1 }, // lichess 00LWa
  { id: "m1-opera-mate",           fen: "6k1/6pp/p2B4/2pP4/P1q5/6P1/2P1p2P/5RK1 w - - 0 27", sideToMove: "w", mateIn: 1, theme: "Opera Mate",             level: 1 }, // lichess 00K48
  { id: "m1-epaulette-mate",       fen: "2r4k/5p2/4pNp1/6Pp/qQ5P/7r/2P5/1RKN4 b - - 3 37",   sideToMove: "b", mateIn: 1, theme: "Epaulette Mate",         level: 1 }, // lichess 00LWX
  { id: "m2-rook-endgame-hfile",   fen: "8/6P1/5k1K/8/8/3p4/P2R4/6r1 b - - 2 49",            sideToMove: "b", mateIn: 2, theme: "King & Rook Mate",        level: 3 }, // lichess 00V0G
  { id: "m2-pawn-rook-corner",     fen: "1R6/2P5/p5k1/6pp/1P6/6PK/r6P/8 b - - 0 40",         sideToMove: "b", mateIn: 2, theme: "Pawn & Rook Mate",        level: 3 }, // lichess 00TFd
  { id: "m2-backrank-deflection",  fen: "r1n3k1/3R1ppp/2p5/5P2/8/1P2r3/P7/5RK1 w - - 0 34",  sideToMove: "w", mateIn: 2, theme: "Back-Rank Mate",         level: 3 }, // lichess 00EXM
  { id: "m2-backrank-ladder-b",    fen: "1R6/6kp/3p1pp1/2r1p3/PP6/8/2r2PPP/1R4K1 b - - 0 30", sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate",         level: 3 }, // lichess 00DYf
  { id: "m2-queen-f2-break",       fen: "5rk1/3Q1p2/5p1p/2q5/8/8/P1r2PPP/3RR1K1 b - - 5 23", sideToMove: "b", mateIn: 2, theme: "Queen & Rook Mate",      level: 3 }, // lichess 00Y1c
  { id: "m3-rook-ladder-drive",    fen: "6k1/5R2/pp4p1/2p4p/7P/1P6/P2rr1PK/5R2 w - - 1 39",  sideToMove: "w", mateIn: 3, theme: "Rook Ladder",            level: 5 }, // lichess 00gNl
  { id: "m3-backrank-infiltration", fen: "5k2/5r1p/pp2Q3/8/8/1P6/P1q2PPP/4R1K1 b - - 0 32",  sideToMove: "b", mateIn: 3, theme: "Back-Rank Mate",         level: 5 }, // lichess 00Ycz
  { id: "m3-queen-pawn-endgame",   fen: "8/5p2/6pk/3PQp2/8/4PP2/p5PK/4q3 w - - 0 40",        sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",       level: 5 }, // lichess 01NPD

  // ---------------------------------------------------------------------------
  // Phase 12 launch library - 961 puzzles imported from the Lichess open
  // puzzle database (https://database.lichess.org, CC0). Every one passed the
  // strict forced-mate check in scripts/verify-puzzles.js (mate forced at exactly
  // the declared depth against every defence - stricter than Lichess itself),
  // was de-duplicated by position AND by tactical idea, and curated for rating,
  // clarity, piece count and theme balance (see scripts/puzzle-launch-final-review.md).
  // `level` is computed by scripts/compute-puzzle-levels.js, not hand-assigned.
  // Lichess id / rating / popularity kept inline for provenance.
  // ---------------------------------------------------------------------------
  { id: "lichess-01cZp", fen: "3k4/8/6Q1/7p/p1q1P1pP/P1B5/1P5P/7K b - - 0 39"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 01cZp · r600 · pop100
  { id: "lichess-02LWp", fen: "1r6/r4Rp1/k3p2q/2Bp4/P6p/7P/2P3P1/6K1 w - - 0 28"     , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess 02LWp · r625 · pop99
  { id: "lichess-02ry1", fen: "8/4R3/3p1p2/3P1P2/4PKpk/1r6/7P/8 b - - 4 50"          , sideToMove: "b", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess 02ry1 · r596 · pop100
  { id: "lichess-0Ab9p", fen: "6k1/4R1p1/7p/7P/4n1PK/8/1P3r1N/8 b - - 5 44"          , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess 0Ab9p · r755 · pop95
  { id: "lichess-16aDE", fen: "8/1R3p1p/4p3/k1K1P2p/4P3/8/6P1/5r2 w - - 0 49"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 16aDE · r1144 · pop100
  { id: "lichess-1a77x", fen: "8/1b6/p3k2b/1p3p2/3B2P1/P1PK4/1P2N1P1/8 b - - 0 43"   , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 1a77x · r772 · pop100
  { id: "lichess-1HH1g", fen: "6k1/5rpp/2p5/1p6/3P4/1Q1p4/3q3P/4R1K1 w - - 2 28"     , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 1HH1g · r706 · pop96
  { id: "lichess-25hCa", fen: "8/7P/4p3/2PpP3/8/5K2/7k/6q1 w - - 0 57"               , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 25hCa · r768 · pop93
  { id: "lichess-2DS1Z", fen: "8/8/5R2/p1p3p1/P5k1/1P1PKp2/2P4r/8 b - - 3 44"        , sideToMove: "b", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess 2DS1Z · r597 · pop100
  { id: "lichess-2oc7h", fen: "k5r1/5R1p/P2N1p2/4pP2/7P/P4r2/7R/7K b - - 0 41"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 2oc7h · r752 · pop100
  { id: "lichess-2p63a", fen: "R7/8/4N1pk/1K3p2/5n2/5r2/8/8 w - - 0 54"              , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess 2p63a · r738 · pop100
  { id: "lichess-3Le8P", fen: "8/8/1R5p/8/p2r2P1/P4Pk1/1P6/6K1 b - - 0 43"           , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 3Le8P · r529 · pop100
  { id: "lichess-3ofF3", fen: "8/kp6/2P5/K7/P7/8/6R1/1r6 b - - 0 53"                 , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 3ofF3 · r971 · pop94
  { id: "lichess-3UB9n", fen: "4QK2/8/5k2/8/8/7r/8/8 b - - 0 71"                     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 3UB9n · r831 · pop86
  { id: "lichess-3uQO4", fen: "r6k/1p5p/p5p1/2b5/8/1B5P/P5PB/5K2 w - - 0 28"         , sideToMove: "w", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess 3uQO4 · r659 · pop95
  { id: "lichess-3W5t7", fen: "4k3/R7/4K3/p7/Pn6/8/3b4/8 w - - 11 60"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 3W5t7 · r855 · pop97
  { id: "lichess-46qrx", fen: "4r1k1/p5p1/1p4P1/8/8/P7/1P2R2K/8 w - - 0 50"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 46qrx · r440 · pop100
  { id: "lichess-49QgJ", fen: "7k/7p/8/pp1p4/3P2Q1/2P5/1P4PP/4qB1K b - - 0 30"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 49QgJ · r590 · pop100
  { id: "lichess-4IGrr", fen: "8/6p1/4Q3/1q3p2/4p3/6Pp/3k1PbB/1R4K1 b - - 0 46"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 4IGrr · r580 · pop100
  { id: "lichess-518gj", fen: "8/5pk1/6pp/p2R4/2p5/P5Pn/6BP/6RK b - - 0 37"          , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess 518gj · r862 · pop91
  { id: "lichess-57Xa0", fen: "3Q4/p4r1k/2p4q/3p4/8/8/7P/5rRK w - - 10 41"           , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 57Xa0 · r971 · pop100
  { id: "lichess-5nVfS", fen: "8/8/p3k3/4b1p1/2b3Pp/1P3P1P/3B4/3BK3 b - - 0 47"      , sideToMove: "b", mateIn: 1, theme: "Boden's Mate"          , level: 1 }, // lichess 5nVfS · r904 · pop100
  { id: "lichess-5v4z4", fen: "4k3/1PP1P3/4K3/8/8/8/8/q6B w - - 0 72"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 5v4z4 · r483 · pop96
  { id: "lichess-6On3z", fen: "r7/P7/5k1K/8/6P1/1p6/1P6/R7 b - - 2 59"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 6On3z · r596 · pop100
  { id: "lichess-6W8vV", fen: "8/8/5rk1/3R2p1/6Kp/5P1P/8/8 b - - 21 58"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 6W8vV · r822 · pop88
  { id: "lichess-7qp2j", fen: "6k1/5ppp/p7/1p3PP1/1r5P/3K4/4R3/8 w - - 0 49"         , sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate"        , level: 1 }, // lichess 7qp2j · r455 · pop100
  { id: "lichess-8F8nv", fen: "3r4/8/p3R3/1p1P1p2/kBP2P1p/Pb1K4/8/8 w - - 2 46"      , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 8F8nv · r596 · pop98
  { id: "lichess-8jmff", fen: "7k/2p2R2/5N2/2p2r2/5r2/4K3/8/8 w - - 6 61"            , sideToMove: "w", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess 8jmff · r1042 · pop93
  { id: "lichess-8UqNY", fen: "8/6kp/6p1/R4p2/8/P5Pn/1P4BP/6RK b - - 0 46"           , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess 8UqNY · r822 · pop96
  { id: "lichess-8vrSa", fen: "8/6r1/8/3Pp3/1p2P2P/k7/2K3p1/6R1 w - - 0 44"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess 8vrSa · r1043 · pop100
  { id: "lichess-9nDqr", fen: "R7/1p3k1p/5npB/1r6/4R3/2r4P/5PP1/6K1 w - - 3 34"      , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess 9nDqr · r878 · pop98
  { id: "lichess-9RBZG", fen: "4N1k1/3R3p/6p1/2b5/8/5PP1/4b2P/4Q2K b - - 0 36"       , sideToMove: "b", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess 9RBZG · r637 · pop100
  { id: "lichess-A3cMn", fen: "8/pB6/1p6/b1k2P2/2r5/1K1R4/P7/8 w - - 5 44"           , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess A3cMn · r730 · pop96
  { id: "lichess-a5q2g", fen: "8/1R6/5pkp/8/1p1b2KP/1r4P1/8/8 w - - 0 49"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess a5q2g · r897 · pop100
  { id: "lichess-aaaY1", fen: "8/8/5k2/6RK/5BP1/r7/8/8 b - - 0 56"                   , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess aaaY1 · r546 · pop86
  { id: "lichess-ALgT0", fen: "3r4/8/Q7/qp2p3/8/kB2p3/2P5/1K6 w - - 1 50"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess ALgT0 · r528 · pop100
  { id: "lichess-AmMKW", fen: "8/4r2p/1p2Nppk/p2b4/8/1PP1R3/P4KPP/8 w - - 0 32"      , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess AmMKW · r646 · pop100
  { id: "lichess-AXah7", fen: "5k2/1p3P2/3P1K2/p5N1/P5Pp/7P/8/2q5 w - - 0 57"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess AXah7 · r533 · pop100
  { id: "lichess-B9rY3", fen: "2r5/R4pk1/p7/1p3Pp1/6P1/8/PP6/1K1R3r b - - 6 37"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess B9rY3 · r774 · pop100
  { id: "lichess-BIiJ6", fen: "k7/P2N3p/K4pp1/4n3/4P3/8/8/8 w - - 5 48"              , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess BIiJ6 · r793 · pop87
  { id: "lichess-BpSVG", fen: "7r/3k1p2/1R6/2pb4/3p4/P2P2P1/1P1B1R2/6K1 b - - 0 37"  , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess BpSVG · r474 · pop100
  { id: "lichess-ByDtP", fen: "8/pR4p1/5k1p/2b4P/P1Bp1K2/3Pr1P1/8/8 w - - 5 35"      , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess ByDtP · r839 · pop97
  { id: "lichess-BYPi5", fen: "1k6/1P6/1KP5/8/8/8/5r2/8 w - - 0 77"                  , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess BYPi5 · r472 · pop94
  { id: "lichess-Ceb1j", fen: "8/8/7p/6b1/4r2k/R7/P2p3K/3B4 w - - 9 51"              , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess Ceb1j · r663 · pop94
  { id: "lichess-CJTAB", fen: "2r5/7p/R7/1p1p1kp1/1P1P4/5KP1/8/8 w - - 1 47"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess CJTAB · r887 · pop100
  { id: "lichess-CnJ5M", fen: "8/5pk1/p5p1/1p6/4BbP1/5P2/P2r3R/6RK b - - 0 43"       , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess CnJ5M · r754 · pop89
  { id: "lichess-cpExN", fen: "8/8/7p/1r6/6P1/5K1k/1p6/1R6 w - - 6 51"               , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess cpExN · r809 · pop87
  { id: "lichess-crpMu", fen: "5rk1/p1Q2p2/6pp/3PB3/8/7n/6PP/6RK b - - 0 39"         , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess crpMu · r879 · pop100
  { id: "lichess-cRUK8", fen: "4r1k1/p4ppb/4R2p/4P3/5B2/5r1P/6P1/5R1K w - - 0 29"    , sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate"        , level: 1 }, // lichess cRUK8 · r894 · pop100
  { id: "lichess-CSPNx", fen: "3Q4/p1p3k1/1p5p/2bb1P2/6P1/2P2R2/7P/7K b - - 0 34"    , sideToMove: "b", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess CSPNx · r578 · pop91
  { id: "lichess-CwXhU", fen: "k1r5/7R/b1N5/2p2p2/8/1KP3P1/PP1r1P2/8 w - - 6 33"     , sideToMove: "w", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess CwXhU · r605 · pop92
  { id: "lichess-DIuFN", fen: "Q7/8/5k1K/5b1P/5P2/5P2/3b4/8 b - - 0 59"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess DIuFN · r716 · pop90
  { id: "lichess-dj8Gk", fen: "2r4k/5B1p/6p1/p5B1/8/8/Pn3PPP/6K1 w - - 0 26"         , sideToMove: "w", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess dj8Gk · r660 · pop88
  { id: "lichess-DkTSv", fen: "8/p2R4/7k/6pP/1p1P1P1K/r7/8/8 w - - 0 36"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess DkTSv · r872 · pop95
  { id: "lichess-DkyZ5", fen: "8/6Rp/8/4pp1r/8/3K4/8/3k4 w - - 0 66"                 , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess DkyZ5 · r916 · pop91
  { id: "lichess-dP73s", fen: "k7/7R/p1N1p1r1/4Kn2/8/8/P7/8 w - - 4 48"              , sideToMove: "w", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess dP73s · r1151 · pop94
  { id: "lichess-DSNLK", fen: "5Q2/p5pk/4q3/6RK/4r2P/8/8/8 w - - 1 50"               , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess DSNLK · r757 · pop95
  { id: "lichess-e9AMT", fen: "8/7R/7p/4P3/4Bn1k/P2P4/5r1P/7K b - - 10 41"           , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess e9AMT · r713 · pop100
  { id: "lichess-ebxFq", fen: "8/pp1Q4/6pk/3b4/4q3/1P5P/P5P1/5R1K b - - 0 37"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess ebxFq · r532 · pop96
  { id: "lichess-edddW", fen: "8/5r2/3R4/5pkp/6p1/5PP1/6K1/8 w - - 4 61"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess edddW · r919 · pop92
  { id: "lichess-eexTf", fen: "r7/p7/1p1pNrpk/2p5/2P5/P2P4/6R1/2K5 w - - 1 35"       , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess eexTf · r900 · pop92
  { id: "lichess-eezfL", fen: "2R5/8/1P3k2/P4p2/3b3P/5KP1/1r6/8 b - - 0 44"          , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess eezfL · r915 · pop96
  { id: "lichess-eFQ2q", fen: "4rk2/1p3p1p/p7/3P1p2/8/8/PP4PP/4R2K b - - 0 36"       , sideToMove: "b", mateIn: 1, theme: "Back-Rank Mate"        , level: 1 }, // lichess eFQ2q · r463 · pop100
  { id: "lichess-eIpxd", fen: "k7/pp6/2p5/1r3P2/3P2B1/KP1n3P/8/5R2 b - - 2 39"       , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess eIpxd · r683 · pop98
  { id: "lichess-eryP4", fen: "8/3k4/8/8/1R6/PpP5/1P5r/1K6 b - - 5 72"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess eryP4 · r610 · pop100
  { id: "lichess-Esk1z", fen: "B3R3/8/1p6/8/1P1knp2/7r/P1K5/8 w - - 2 53"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess Esk1z · r1024 · pop100
  { id: "lichess-EulHd", fen: "5k2/r1r2ppp/1p6/p7/4R1P1/3R3P/P4K2/8 w - - 3 41"      , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess EulHd · r776 · pop98
  { id: "lichess-F5DtV", fen: "8/8/3R4/8/5K1k/5P2/3p4/3r4 w - - 2 70"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess F5DtV · r660 · pop100
  { id: "lichess-f6nOA", fen: "4r3/8/R7/5k2/8/8/2r3PP/4B1K1 b - - 0 40"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess f6nOA · r745 · pop97
  { id: "lichess-FAyQ7", fen: "8/1p2r3/pRnN4/2pK2k1/2P3P1/3P4/2P5/8 b - - 2 39"      , sideToMove: "b", mateIn: 1, theme: "Hook Mate"             , level: 1 }, // lichess FAyQ7 · r1005 · pop100
  { id: "lichess-FBvzn", fen: "8/1p3B2/p1p3p1/1k1p4/P3qP2/1KQ5/1PP5/8 b - - 0 41"    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess FBvzn · r795 · pop96
  { id: "lichess-fcpMy", fen: "8/8/8/5R2/r4p2/5K1k/8/8 w - - 0 54"                   , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess fcpMy · r560 · pop91
  { id: "lichess-FGXfC", fen: "8/1R6/3R3p/4P1p1/6P1/6r1/2r5/2k1K3 w - - 7 61"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess FGXfC · r941 · pop95
  { id: "lichess-FI64A", fen: "8/4Rp2/5B2/1k6/1p2BbP1/1P1K1P2/r7/8 b - - 1 41"       , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess FI64A · r485 · pop100
  { id: "lichess-FIEL8", fen: "3Q4/pp6/2k2p2/5p2/2P5/4q3/P5PP/4R2K b - - 0 38"       , sideToMove: "b", mateIn: 1, theme: "Back-Rank Mate"        , level: 1 }, // lichess FIEL8 · r499 · pop100
  { id: "lichess-fQ7C9", fen: "6k1/5pp1/1p2p3/1P1P2Q1/4p3/6bP/1B3q2/7K w - - 0 36"   , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess fQ7C9 · r1157 · pop99
  { id: "lichess-FQ9At", fen: "1R6/1P6/8/8/6p1/6k1/1r6/6K1 b - - 2 53"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess FQ9At · r993 · pop93
  { id: "lichess-GhNUd", fen: "8/8/P7/7R/6P1/6kP/r7/6K1 b - - 2 72"                  , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess GhNUd · r739 · pop100
  { id: "lichess-GMLea", fen: "5k2/2R2Bpp/8/8/5P1P/4n1PK/8/1r6 b - - 0 41"           , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess GMLea · r591 · pop100
  { id: "lichess-gN2yF", fen: "5k2/1R6/5K2/1p3p1p/p7/P4r2/1P6/8 w - - 0 51"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess gN2yF · r985 · pop95
  { id: "lichess-GW5Ow", fen: "8/8/3p1p1p/1R1Pkp2/1p6/4K3/1r3P2/8 w - - 1 54"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess GW5Ow · r781 · pop98
  { id: "lichess-GwwAo", fen: "8/R7/3B4/7P/4k3/4n1PK/p7/r7 b - - 3 41"               , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess GwwAo · r608 · pop94
  { id: "lichess-gzK0T", fen: "1Q6/7p/6pk/5p2/1Pr1p3/6Pn/6PP/6RK b - - 0 43"         , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess gzK0T · r709 · pop96
  { id: "lichess-h6ISr", fen: "3Q4/pp1R2qk/7p/8/8/2P5/P4r1P/7K b - - 1 36"           , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess h6ISr · r819 · pop100
  { id: "lichess-H8MG6", fen: "6k1/6p1/p2R3p/5P1r/8/5nP1/PP5P/5R1K b - - 0 35"       , sideToMove: "b", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess H8MG6 · r593 · pop92
  { id: "lichess-hG1eB", fen: "8/R7/5k1K/8/P2r4/8/5P1P/8 b - - 0 47"                 , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess hG1eB · r806 · pop97
  { id: "lichess-hGndC", fen: "6k1/1R5p/5K2/8/8/8/1p6/1r6 w - - 0 47"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess hGndC · r947 · pop94
  { id: "lichess-HkrMS", fen: "3Q4/2r5/p1p5/kp1p4/3P4/2P5/PKBq4/8 w - - 2 60"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess HkrMS · r650 · pop100
  { id: "lichess-Hl8Mg", fen: "8/8/R7/1pk5/4P3/1PKP4/6r1/8 b - - 0 55"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess Hl8Mg · r934 · pop100
  { id: "lichess-HntIa", fen: "8/8/4R3/R3p2p/P3k3/4n1PK/8/6r1 b - - 3 60"            , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess HntIa · r855 · pop100
  { id: "lichess-hrgI3", fen: "R7/8/1p3KPk/7p/2r5/2P5/8/8 w - - 1 43"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess hrgI3 · r753 · pop86
  { id: "lichess-HVvBD", fen: "4r2k/R5p1/7p/5q2/3Qn3/2P4P/2P2PK1/8 w - - 0 36"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess HVvBD · r604 · pop100
  { id: "lichess-hwHaX", fen: "2r4k/5R1p/p4NpB/4bb2/2p5/7P/6P1/7K w - - 0 30"        , sideToMove: "w", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess hwHaX · r972 · pop98
  { id: "lichess-HxhDj", fen: "8/2k2B1p/1np2p2/2b5/8/P5P1/1P2b2P/R6K b - - 0 30"     , sideToMove: "b", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess HxhDj · r762 · pop100
  { id: "lichess-HY9Mz", fen: "8/1R6/8/8/5K1k/8/2r5/1q4r1 w - - 0 62"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess HY9Mz · r1050 · pop87
  { id: "lichess-IAqqY", fen: "3r2k1/6p1/Rp2r2p/p7/2P5/7P/2R2PP1/5K2 b - - 3 42"     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess IAqqY · r696 · pop100
  { id: "lichess-Idri0", fen: "8/5p2/4p1pk/7p/3Q1P1P/4K3/1pq3P1/8 w - - 4 54"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess Idri0 · r853 · pop100
  { id: "lichess-ie741", fen: "8/7k/6pp/B3b3/1p1p4/1P1bPP1P/3N4/3BK3 b - - 0 41"     , sideToMove: "b", mateIn: 1, theme: "Boden's Mate"          , level: 1 }, // lichess ie741 · r636 · pop99
  { id: "lichess-iKhD0", fen: "8/3R2p1/5pkp/6bN/6Pr/5K2/8/8 w - - 4 43"              , sideToMove: "w", mateIn: 1, theme: "Hook Mate"             , level: 1 }, // lichess iKhD0 · r896 · pop87
  { id: "lichess-iszc0", fen: "2r5/8/2p1N1p1/1p1p1p1p/6rk/5R2/7K/q2B4 w - - 0 52"    , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess iszc0 · r742 · pop100
  { id: "lichess-izu8A", fen: "8/8/1pN3R1/pP6/P1p2K1k/2r5/5n2/8 w - - 0 52"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess izu8A · r863 · pop100
  { id: "lichess-J3mpb", fen: "5r1k/1R1R3p/3P3p/p2Bb3/4p3/5p1K/6r1/8 w - - 3 35"     , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess J3mpb · r836 · pop96
  { id: "lichess-JPBQl", fen: "4k1r1/1R6/4K3/4BP2/8/1p2r3/8/8 w - - 0 67"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess JPBQl · r901 · pop100
  { id: "lichess-JTeiN", fen: "2bK1k2/p5pp/1r6/5p2/2B5/r6P/2P3P1/4R3 w - - 2 31"     , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess JTeiN · r596 · pop100
  { id: "lichess-k6B8z", fen: "5k2/3R4/5K2/1p3p2/1r2b3/8/8/8 w - - 4 50"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess k6B8z · r785 · pop96
  { id: "lichess-K8bar", fen: "1r1k4/8/P2b4/6p1/2bPp3/8/1P1P4/R1BBK3 b Q - 0 28"     , sideToMove: "b", mateIn: 1, theme: "Boden's Mate"          , level: 1 }, // lichess K8bar · r745 · pop100
  { id: "lichess-ki6dK", fen: "8/8/3bN1pk/1p6/3P2K1/1r4P1/8/5R2 w - - 3 47"          , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess ki6dK · r889 · pop92
  { id: "lichess-kKFiE", fen: "8/1R2N3/1p1r2pk/p1b2p1p/P6P/5KP1/8/8 w - - 12 43"     , sideToMove: "w", mateIn: 1, theme: "Corner Mate"           , level: 1 }, // lichess kKFiE · r1094 · pop100
  { id: "lichess-kU1se", fen: "2R2r1k/6pp/8/4P3/3pN3/3q4/P5PP/4R1K1 w - - 2 27"      , sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate"        , level: 1 }, // lichess kU1se · r949 · pop100
  { id: "lichess-LdneV", fen: "1k5r/1pb5/2p5/8/1P6/P1P5/2P2QPP/6RK b - - 0 32"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess LdneV · r629 · pop97
  { id: "lichess-LeZuJ", fen: "6k1/P4p2/1R2p3/4P1pp/3p4/1P1b2P1/R4KP1/2r5 b - - 0 41", sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess LeZuJ · r861 · pop99
  { id: "lichess-lTjeE", fen: "8/6bp/4b3/R7/6Pk/5K2/8/4r3 w - - 3 49"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess lTjeE · r529 · pop91
  { id: "lichess-LUDef", fen: "Q3Q3/3r2k1/6p1/7p/6nP/6PK/3r2p1/8 b - - 0 41"         , sideToMove: "b", mateIn: 1, theme: "Corner Mate"           , level: 1 }, // lichess LUDef · r900 · pop88
  { id: "lichess-LXgya", fen: "8/p5pQ/1p3qn1/5pN1/6kP/6P1/5PK1/8 w - - 10 41"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess LXgya · r965 · pop100
  { id: "lichess-LXPJc", fen: "6k1/p5pp/r7/2Rp2r1/8/7K/8/5R2 w - - 2 39"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess LXPJc · r698 · pop95
  { id: "lichess-lyS9L", fen: "8/pp1kp1b1/6Q1/8/8/2R4n/PP4PP/6RK b - - 0 28"         , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess lyS9L · r809 · pop93
  { id: "lichess-MtDEZ", fen: "8/2p5/3k2N1/P2r3p/7P/KP1n4/2R5/8 b - - 0 60"          , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess MtDEZ · r530 · pop90
  { id: "lichess-mV0ie", fen: "8/8/3n4/kp1Np3/8/2R1K3/8/5r2 w - - 18 65"             , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess mV0ie · r583 · pop86
  { id: "lichess-N97dT", fen: "8/5R2/1p5k/4N3/p3nPPK/8/r7/8 b - - 4 55"              , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess N97dT · r619 · pop93
  { id: "lichess-NfUfv", fen: "6k1/R7/7K/P5P1/5r1P/8/2b5/8 b - - 6 51"               , sideToMove: "b", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess NfUfv · r905 · pop87
  { id: "lichess-NiwVT", fen: "1K6/2p3R1/1pkr2p1/8/2P5/2n2P2/p6P/8 w - - 0 36"       , sideToMove: "w", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess NiwVT · r1017 · pop97
  { id: "lichess-NRnMZ", fen: "8/8/1P4R1/8/8/2K5/pr6/1k6 w - - 0 70"                 , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess NRnMZ · r962 · pop96
  { id: "lichess-nShqm", fen: "5r1k/pR6/2p3P1/8/2BPp3/1P6/P1P3r1/2K5 w - - 2 28"     , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess nShqm · r1061 · pop100
  { id: "lichess-nVGv8", fen: "4k3/p5r1/4p3/8/3PQ2K/5PBP/PP1q4/8 b - - 6 47"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess nVGv8 · r972 · pop100
  { id: "lichess-O4R3J", fen: "7k/7p/p4p2/4p3/7B/1B3K1P/Pbrr4/8 w - - 0 33"          , sideToMove: "w", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess O4R3J · r674 · pop100
  { id: "lichess-OekUd", fen: "6r1/p6k/4p2p/3q2P1/5P1Q/7P/Pr6/5RK1 w - - 1 28"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess OekUd · r562 · pop100
  { id: "lichess-oSKvp", fen: "5rk1/1R5p/7K/5P1P/p1pN4/P1P5/1P6/6r1 b - - 6 48"      , sideToMove: "b", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess oSKvp · r863 · pop100
  { id: "lichess-OvCxj", fen: "5R2/k2K4/1p4r1/1PpB4/3n4/5p2/8/8 w - - 2 65"          , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess OvCxj · r636 · pop99
  { id: "lichess-p5ob2", fen: "6R1/8/8/8/8/5K1k/r7/8 w - - 90 143"                   , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess p5ob2 · r1124 · pop88
  { id: "lichess-PpICs", fen: "1k6/1p6/pP5r/3p3p/3P4/7K/8/4R3 w - - 2 41"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess PpICs · r511 · pop100
  { id: "lichess-PVnNv", fen: "8/4k1r1/8/p4r2/P6R/3B3K/2P4P/8 b - - 4 61"            , sideToMove: "b", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess PVnNv · r603 · pop86
  { id: "lichess-Q8PSa", fen: "8/p7/1P2pp1k/6P1/7K/2P4P/P5r1/1R6 b - - 0 41"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess Q8PSa · r904 · pop100
  { id: "lichess-qBZKv", fen: "b7/P4pkp/4p1p1/8/8/R3N1PP/5P1K/2r5 b - - 3 41"        , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess qBZKv · r457 · pop100
  { id: "lichess-QFEOD", fen: "8/8/8/6p1/8/6k1/5p1p/4R2K b - - 0 68"                 , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess QFEOD · r610 · pop80
  { id: "lichess-QjvoC", fen: "1k6/pp2Q3/3p4/q1p1p3/4P1P1/3PKR2/2P5/8 b - - 0 38"    , sideToMove: "b", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess QjvoC · r819 · pop92
  { id: "lichess-Qkqbg", fen: "4k3/1R3N2/4p3/2b2p2/5P2/2P2KP1/2r5/8 b - - 0 31"      , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess Qkqbg · r924 · pop99
  { id: "lichess-qmDpB", fen: "8/2R5/1p5p/4B3/P7/R7/1r1r4/1k4K1 b - - 10 38"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess qmDpB · r934 · pop97
  { id: "lichess-qmt54", fen: "8/1b2kp1Q/pp2p3/8/4P3/5P1n/6PP/6RK b - - 0 38"        , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess qmt54 · r650 · pop92
  { id: "lichess-QnyuT", fen: "7k/5R2/4Np2/3P4/4P3/4nPPK/8/6r1 b - - 0 51"           , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess QnyuT · r662 · pop98
  { id: "lichess-qUyts", fen: "6r1/p2k1p2/P6p/1p1q4/7Q/3P4/6PP/5R1K b - - 0 36"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess qUyts · r600 · pop96
  { id: "lichess-QzEIx", fen: "5r2/7p/8/8/p1Pkp1PP/R2n4/4K3/3R4 b - - 2 46"          , sideToMove: "b", mateIn: 1, theme: "Hook Mate"             , level: 1 }, // lichess QzEIx · r631 · pop100
  { id: "lichess-QZiq0", fen: "8/1p6/2p2k2/p7/2P2n1N/1P2r2P/P6K/6R1 b - - 7 47"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess QZiq0 · r1154 · pop99
  { id: "lichess-rpKpD", fen: "8/p7/1p3N1P/6p1/P3B2k/7P/1r2p1PK/4r3 w - - 4 51"      , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess rpKpD · r854 · pop100
  { id: "lichess-RRD3q", fen: "8/6pk/p7/4Q3/1B2p1P1/1P1p1b1r/P4P2/6K1 b - - 1 49"    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess RRD3q · r734 · pop100
  { id: "lichess-rvPlk", fen: "4Q3/6Q1/1k1p4/2q5/1n6/8/PP5P/KR6 b - - 0 46"          , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess rvPlk · r828 · pop90
  { id: "lichess-RYBZB", fen: "6k1/R7/3p3p/2p3p1/2P2P2/4Nn1P/6rB/7K b - - 0 45"      , sideToMove: "b", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess RYBZB · r1140 · pop100
  { id: "lichess-rzYAg", fen: "8/8/8/8/8/6K1/2R5/6kq w - - 0 69"                     , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess rzYAg · r1034 · pop100
  { id: "lichess-Sd8uu", fen: "3k4/5R2/3K4/7p/2P5/8/1r6/8 w - - 0 51"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess Sd8uu · r1120 · pop91
  { id: "lichess-sEnzj", fen: "8/p3kp2/5N1b/2PPPK2/7r/1P6/P6p/7R b - - 0 34"         , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess sEnzj · r705 · pop98
  { id: "lichess-siqhI", fen: "7K/5k2/R4P2/8/8/8/6r1/8 b - - 2 79"                   , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess siqhI · r1147 · pop98
  { id: "lichess-sK2pe", fen: "8/1R3p2/P7/6kp/3N2p1/4P1K1/1r3PPP/8 b - - 2 38"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess sK2pe · r1147 · pop99
  { id: "lichess-t5TgX", fen: "8/8/8/1R4P1/5kP1/4rB2/3p2K1/4q3 w - - 4 59"           , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess t5TgX · r943 · pop100
  { id: "lichess-T75np", fen: "8/1R6/4kpp1/8/rB2Kp1p/7P/2P2P2/4n3 w - - 2 38"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess T75np · r1050 · pop100
  { id: "lichess-TBUvz", fen: "7k/1p2r2p/8/8/4r3/1P2pR2/6R1/4K3 w - - 11 57"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess TBUvz · r536 · pop94
  { id: "lichess-tGkLe", fen: "8/3R4/2p2kpp/1pb5/p3K2P/1B6/Pr6/8 w - - 0 34"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess tGkLe · r960 · pop100
  { id: "lichess-Tgn2P", fen: "8/6R1/8/6pp/r7/5P2/5kPK/8 b - - 21 62"                , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess Tgn2P · r720 · pop88
  { id: "lichess-tQhxY", fen: "5k2/1R6/3R4/1p2nPPK/2p5/1r6/8/8 b - - 6 49"           , sideToMove: "b", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess tQhxY · r863 · pop95
  { id: "lichess-TXTVc", fen: "7k/6p1/2Q4p/8/8/7n/1P4PP/6RK b - - 0 37"              , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess TXTVc · r840 · pop87
  { id: "lichess-u4b8Y", fen: "8/7p/4pkp1/3p1q2/2pP1P2/Q1P2PK1/7P/8 w - - 3 43"      , sideToMove: "w", mateIn: 1, theme: "Epaulette Mate"        , level: 1 }, // lichess u4b8Y · r604 · pop100
  { id: "lichess-U8MXf", fen: "8/3P3p/8/p3kp2/8/P4n2/1r5R/6RK b - - 0 53"            , sideToMove: "b", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess U8MXf · r798 · pop100
  { id: "lichess-U97G4", fen: "6k1/6Pp/8/3p1p2/1Q6/4PPP1/2r1q3/6K1 w - - 5 54"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess U97G4 · r1138 · pop99
  { id: "lichess-UB9zi", fen: "3R4/8/8/1p6/kr6/2K5/8/8 w - - 0 50"                   , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess UB9zi · r634 · pop100
  { id: "lichess-uri2r", fen: "8/8/7r/p3p2P/5k2/1P5K/P5R1/8 b - - 2 44"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess uri2r · r498 · pop100
  { id: "lichess-UrtUC", fen: "8/4N1pk/4p3/3b2p1/p7/6K1/2R5/r7 w - - 0 45"           , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess UrtUC · r876 · pop89
  { id: "lichess-USiA6", fen: "6k1/5p1p/6p1/7n/7q/5P2/6PP/5BQK b - - 3 38"           , sideToMove: "b", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess USiA6 · r898 · pop98
  { id: "lichess-UsJmu", fen: "3r2k1/4Qp2/6qP/7p/4PB2/P7/1PP5/2K5 b - - 2 35"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess UsJmu · r878 · pop100
  { id: "lichess-Ut660", fen: "6rk/6pp/5b1N/1pq5/2p5/7P/6P1/5R1K w - - 0 37"         , sideToMove: "w", mateIn: 1, theme: "Smothered Mate"        , level: 1 }, // lichess Ut660 · r795 · pop100
  { id: "lichess-UvAsu", fen: "8/4Rp2/8/1bPN1kP1/3K4/r7/6P1/8 b - - 12 66"           , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess UvAsu · r856 · pop100
  { id: "lichess-UYf00", fen: "6rk/7p/3N3q/2p1p3/4n2P/8/1P6/1K4R1 w - - 0 49"        , sideToMove: "w", mateIn: 1, theme: "Corner Mate"           , level: 1 }, // lichess UYf00 · r835 · pop95
  { id: "lichess-v30I6", fen: "5n1k/5p2/5N2/p1p1Pn2/P5R1/1rP4P/5K2/8 w - - 0 47"     , sideToMove: "w", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess v30I6 · r685 · pop90
  { id: "lichess-v8PEU", fen: "5k2/3R4/2p2K2/3p4/1P1r4/7P/8/8 w - - 0 68"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess v8PEU · r1055 · pop100
  { id: "lichess-vd4i2", fen: "8/p5Bp/8/3B2pk/2P1Pp2/7K/2r5/8 w - - 0 43"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess vd4i2 · r783 · pop100
  { id: "lichess-vjLPX", fen: "k1r5/3R4/3Bp3/1N3p2/3p4/1KP1q3/8/8 w - - 0 53"        , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess vjLPX · r1115 · pop100
  { id: "lichess-vT1yc", fen: "6k1/2R5/6K1/5pp1/7r/5P2/8/8 w - - 0 51"               , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess vT1yc · r1257 · pop99
  { id: "lichess-VTHFy", fen: "q6k/p7/5pp1/7p/7Q/2B4b/PP5P/5RK1 b - - 0 32"          , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess VTHFy · r758 · pop98
  { id: "lichess-vtIqw", fen: "8/2k3p1/7p/2N2p2/1P1b1P2/3R1KP1/7r/8 b - - 0 45"      , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess vtIqw · r723 · pop100
  { id: "lichess-VyRBJ", fen: "8/p4R2/b7/4R3/1p1P2k1/1P2K3/P6r/8 b - - 13 48"        , sideToMove: "b", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess VyRBJ · r1162 · pop97
  { id: "lichess-WDwkh", fen: "5k2/R7/5K2/8/1p6/8/P7/6q1 w - - 0 62"                 , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess WDwkh · r597 · pop100
  { id: "lichess-wH7Uo", fen: "8/8/1p6/p1p5/P1R3p1/5pB1/1P1kpK2/8 b - - 5 54"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess wH7Uo · r777 · pop91
  { id: "lichess-WWuBW", fen: "6k1/4R3/6K1/5P2/8/7P/5P2/1q6 w - - 0 42"              , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess WWuBW · r602 · pop93
  { id: "lichess-XcQ7z", fen: "8/7B/3k3K/4n2P/6r1/5p2/8/5R2 b - - 0 47"              , sideToMove: "b", mateIn: 1, theme: "Corner Mate"           , level: 1 }, // lichess XcQ7z · r1110 · pop93
  { id: "lichess-xhlVo", fen: "1Q6/2p5/7p/7P/8/5kn1/7K/5r2 b - - 0 53"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess xhlVo · r825 · pop95
  { id: "lichess-xICM0", fen: "5k2/p6R/2p4p/8/1P6/2B1b1P1/b6P/7K b - - 0 35"         , sideToMove: "b", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess xICM0 · r664 · pop94
  { id: "lichess-XmDuX", fen: "8/8/7R/4p3/4P3/3NKP2/r4P2/5k2 b - - 0 53"             , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess XmDuX · r983 · pop100
  { id: "lichess-XQIin", fen: "5k2/R7/5K1p/6p1/8/8/1p5r/8 w - - 0 43"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess XQIin · r1162 · pop100
  { id: "lichess-XqXRe", fen: "8/2R4p/6pk/8/5PPK/7P/2p5/2r5 w - - 0 58"              , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess XqXRe · r874 · pop95
  { id: "lichess-XUkYa", fen: "7k/R7/5N2/2p5/P1r1p3/2b5/8/5K2 w - - 0 47"            , sideToMove: "w", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess XUkYa · r1125 · pop95
  { id: "lichess-xy4M4", fen: "2B5/8/P5k1/6p1/5pK1/r7/5R2/8 b - - 7 59"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess xy4M4 · r665 · pop100
  { id: "lichess-ykBUd", fen: "8/6R1/4N3/1p2KN1k/4P3/4P3/1r6/q7 w - - 0 58"          , sideToMove: "w", mateIn: 1, theme: "Vukovic Mate"          , level: 1 }, // lichess ykBUd · r1132 · pop95
  { id: "lichess-YQLCN", fen: "8/8/P2R4/2Bppk2/2pP1b2/2P2K2/r7/8 b - - 1 51"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess YQLCN · r877 · pop97
  { id: "lichess-z7VN3", fen: "8/R7/5k2/7P/5K2/p6r/B7/3b4 w - - 4 58"                , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 1 }, // lichess z7VN3 · r1375 · pop93
  { id: "lichess-Z8sMS", fen: "8/8/1R6/p5P1/P4N2/5nr1/k7/7K b - - 0 60"              , sideToMove: "b", mateIn: 1, theme: "Arabian Mate"          , level: 1 }, // lichess Z8sMS · r757 · pop96
  { id: "lichess-zJcOW", fen: "8/8/R7/4Npkp/5r2/2b4K/P7/8 w - - 0 45"                , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 1 }, // lichess zJcOW · r711 · pop100
  { id: "lichess-ZQnwo", fen: "2R5/1p6/4N1pk/6b1/8/3K3p/r4P2/8 w - - 0 51"           , sideToMove: "w", mateIn: 1, theme: "Anastasia's Mate"      , level: 1 }, // lichess ZQnwo · r659 · pop96
  { id: "lichess-ZXhp9", fen: "4r3/1k4pp/pB1R1p2/P7/8/7b/1P3P1P/7K b - - 0 28"       , sideToMove: "b", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess ZXhp9 · r479 · pop100
  { id: "lichess-zz3kt", fen: "7k/3b3p/7p/b1B5/2B1P3/8/5KP1/8 w - - 2 45"            , sideToMove: "w", mateIn: 1, theme: "Double Bishop Mate"    , level: 1 }, // lichess zz3kt · r820 · pop96
  { id: "lichess-zzodd", fen: "r7/5k2/2p5/Pp2Rp2/1B2bP2/P5PK/8/8 b - - 6 47"         , sideToMove: "b", mateIn: 1, theme: "Pillsburys Mate"       , level: 1 }, // lichess zzodd · r825 · pop96
  { id: "lichess-0HqjA", fen: "8/5pkp/4p1p1/PR2n3/8/1B5P/1P3P1K/6r1 b - - 2 35"      , sideToMove: "b", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess 0HqjA · r800 · pop95
  { id: "lichess-0OCKV", fen: "8/5Q2/3p4/4q1p1/4k3/2P5/5KP1/8 w - - 12 51"           , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 0OCKV · r874 · pop99
  { id: "lichess-1iXjI", fen: "2Q5/pr4p1/1q4kp/3R4/5b2/7P/P5P1/7K w - - 1 40"        , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess 1iXjI · r1187 · pop93
  { id: "lichess-36SAi", fen: "k7/p2Q4/1p6/1Pp4K/2P5/8/8/6q1 w - - 3 75"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 36SAi · r1083 · pop97
  { id: "lichess-3f4YN", fen: "2k1r1R1/pp6/3Q4/4Pq2/3p1P2/P7/1P4K1/2b5 w - - 0 42"   , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 3f4YN · r896 · pop100
  { id: "lichess-3X6Am", fen: "8/8/2k2p1p/3p4/8/q1b5/2Q3PP/1K1R4 b - - 3 33"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 3X6Am · r775 · pop100
  { id: "lichess-3YOPI", fen: "7r/8/3qp3/2kb2B1/Qpp5/8/5PPP/2R3K1 w - - 3 36"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 3YOPI · r1146 · pop97
  { id: "lichess-4GPXy", fen: "4r2k/6pp/8/3q4/5R2/Q5P1/PP3P1P/6K1 b - - 3 29"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 4GPXy · r1061 · pop99
  { id: "lichess-4Jrdh", fen: "6R1/5p1k/4n2p/3b4/4N1P1/r4P2/7K/8 w - - 2 45"         , sideToMove: "w", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess 4Jrdh · r761 · pop90
  { id: "lichess-5DmYI", fen: "8/7p/8/4P1Pk/5P2/7K/6PQ/4q3 b - - 0 55"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 5DmYI · r976 · pop100
  { id: "lichess-6bGWq", fen: "Q7/8/8/5Q2/3q4/KP6/2P5/3kq3 b - - 0 61"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 6bGWq · r1313 · pop93
  { id: "lichess-6DhfY", fen: "r3r3/1k1p4/p2P4/1b6/1K6/8/P7/2Q5 w - - 5 46"          , sideToMove: "w", mateIn: 1, theme: "Swallowstail Mate"     , level: 2 }, // lichess 6DhfY · r700 · pop88
  { id: "lichess-6FuIo", fen: "8/1P1R4/b7/5kpp/8/5KB1/4r2P/8 b - - 2 66"             , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 6FuIo · r974 · pop100
  { id: "lichess-6r4vG", fen: "6R1/pk2qp2/1p2r1p1/8/2Q5/4P2P/5PP1/6K1 w - - 1 44"    , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess 6r4vG · r838 · pop92
  { id: "lichess-6XYzA", fen: "8/1Q5p/5kp1/5p2/3q4/7P/4R1PK/r7 w - - 2 38"           , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 6XYzA · r982 · pop100
  { id: "lichess-7AmW0", fen: "8/p7/1p1q3p/2p5/2kb4/5Q2/P7/7K w - - 9 48"            , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess 7AmW0 · r1036 · pop88
  { id: "lichess-8C8BM", fen: "7k/3QR2p/2p2p2/1p6/8/5q1p/PP3P2/6K1 b - - 0 33"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 8C8BM · r1013 · pop100
  { id: "lichess-8jNoB", fen: "8/6RB/8/4n1P1/3k1K2/1r6/8/8 b - - 2 47"               , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 8jNoB · r1017 · pop92
  { id: "lichess-8NCE9", fen: "8/3R4/7k/6pp/6P1/2p1Q3/1r5q/5K2 w - - 0 42"           , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 8NCE9 · r968 · pop91
  { id: "lichess-8uIqs", fen: "8/8/2r3p1/6Bp/2p1p2P/k1KnP3/6P1/1R6 w - - 4 48"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 8uIqs · r1202 · pop100
  { id: "lichess-9i2CQ", fen: "3r4/4R3/2p4p/3k4/2N2p2/1PP5/P5r1/2K5 w - - 0 39"      , sideToMove: "w", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess 9i2CQ · r955 · pop98
  { id: "lichess-9kzCo", fen: "2Q5/8/1p2rkp1/p3qp1p/P4R1P/1P4P1/5P1K/8 w - - 12 52"  , sideToMove: "w", mateIn: 1, theme: "Epaulette Mate"        , level: 2 }, // lichess 9kzCo · r842 · pop99
  { id: "lichess-9PC65", fen: "r7/P7/6R1/2R5/1p6/1P5k/r6p/7K w - - 3 42"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess 9PC65 · r1026 · pop98
  { id: "lichess-A0RkZ", fen: "6k1/R6p/6p1/p7/8/7P/2r3r1/3R3K w - - 0 32"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess A0RkZ · r960 · pop91
  { id: "lichess-a9R7N", fen: "8/R5R1/2p1rk1p/3b4/2pP3P/3n2K1/PP6/8 w - - 1 42"      , sideToMove: "w", mateIn: 1, theme: "Blind Swine Mate"      , level: 2 }, // lichess a9R7N · r1124 · pop95
  { id: "lichess-aha8f", fen: "8/p5kp/6p1/4p3/PP2P1K1/2Q3P1/7q/8 b - - 2 46"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess aha8f · r962 · pop100
  { id: "lichess-aoYRo", fen: "4Q3/p5pk/8/p1pPK3/4P3/5qP1/7P/8 b - - 4 49"           , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess aoYRo · r940 · pop98
  { id: "lichess-aVKck", fen: "8/r2q4/p7/1p3p2/1kp3p1/5Q2/5PPP/R5K1 w - - 0 43"      , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess aVKck · r857 · pop100
  { id: "lichess-AVvT3", fen: "8/5Q2/1pq3pk/7p/7P/6PK/5P2/8 b - - 3 45"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess AVvT3 · r1169 · pop93
  { id: "lichess-b81pW", fen: "1Q6/6k1/7p/3RP3/3P2rp/4Pn1K/8/8 b - - 2 51"           , sideToMove: "b", mateIn: 1, theme: "Vukovic Mate"          , level: 2 }, // lichess b81pW · r1114 · pop92
  { id: "lichess-BAgrJ", fen: "6k1/3R4/p2r2rp/1p2R3/3p4/P7/1P6/K7 w - - 1 46"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess BAgrJ · r686 · pop89
  { id: "lichess-C89hb", fen: "6k1/5pp1/7p/p2R4/P1K5/1P1Q2P1/8/4q3 b - - 4 46"       , sideToMove: "b", mateIn: 1, theme: "Swallowstail Mate"     , level: 2 }, // lichess C89hb · r1186 · pop96
  { id: "lichess-cILWf", fen: "6k1/1p4pp/p4p2/8/P3QPPK/1q6/6P1/8 w - - 0 32"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess cILWf · r621 · pop100
  { id: "lichess-CIxaX", fen: "4N3/5Q2/p5p1/6k1/P7/3b4/4q1P1/2K5 b - - 9 44"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess CIxaX · r876 · pop94
  { id: "lichess-ck14E", fen: "8/6pk/5P2/6p1/6P1/R4RKP/8/1q6 b - - 0 45"             , sideToMove: "b", mateIn: 1, theme: "Epaulette Mate"        , level: 2 }, // lichess ck14E · r1098 · pop92
  { id: "lichess-CQnX6", fen: "8/3R2pk/8/3P2p1/8/P7/2r3r1/4RK2 b - - 1 41"           , sideToMove: "b", mateIn: 1, theme: "Blind Swine Mate"      , level: 2 }, // lichess CQnX6 · r1010 · pop85
  { id: "lichess-CTH2w", fen: "1r5k/7p/3R1R1P/8/2p3P1/2P5/r7/3K4 b - - 2 36"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess CTH2w · r963 · pop100
  { id: "lichess-cVfKc", fen: "6k1/2R3pp/4p3/1R1b1p2/4n3/4K3/5r2/8 w - - 0 37"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess cVfKc · r1015 · pop100
  { id: "lichess-dapUB", fen: "6k1/pR2Q1p1/8/3pq3/6P1/7K/P1P1Br2/8 b - - 0 33"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess dapUB · r970 · pop100
  { id: "lichess-dfmgh", fen: "8/8/2q3pk/6Np/5R1P/6PK/5P2/8 b - - 7 38"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess dfmgh · r622 · pop93
  { id: "lichess-DoqKD", fen: "3Qn1k1/B4pp1/8/8/3P4/2P2P1p/2q3PP/6K1 b - - 1 34"     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess DoqKD · r1161 · pop97
  { id: "lichess-Dsetz", fen: "5Q2/8/8/8/8/K3P3/2k5/1q6 b - - 0 58"                  , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Dsetz · r1060 · pop87
  { id: "lichess-dvYty", fen: "2k5/4nP2/1Q6/p6q/1p6/2P1R3/PP1K1P2/r7 b - - 2 41"     , sideToMove: "b", mateIn: 1, theme: "Swallowstail Mate"     , level: 2 }, // lichess dvYty · r1185 · pop99
  { id: "lichess-DWJVC", fen: "7k/pp3Q1p/1bp5/5p2/3q4/7P/PP4P1/5K2 w - - 2 34"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess DWJVC · r686 · pop95
  { id: "lichess-E4pQL", fen: "Q1R5/5ppk/4p3/1N1p4/3N2n1/7p/6r1/7K b - - 0 44"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess E4pQL · r836 · pop96
  { id: "lichess-eazHt", fen: "8/p7/1p6/kP3p2/3P1P2/P2Q2PK/8/4q3 b - - 6 60"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess eazHt · r845 · pop96
  { id: "lichess-eEAvx", fen: "8/R4pk1/8/8/1p4pP/1P2RnP1/5PK1/2r5 b - h3 0 49"       , sideToMove: "b", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess eEAvx · r1019 · pop92
  { id: "lichess-EkHOm", fen: "8/1R4p1/2p2k2/p2pNPr1/3Pn3/8/PP5K/8 w - - 2 43"       , sideToMove: "w", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess EkHOm · r1032 · pop90
  { id: "lichess-EMc7o", fen: "8/5p1k/6p1/4b2p/4QB2/6K1/2P2PPP/3q4 b - - 7 34"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess EMc7o · r1080 · pop100
  { id: "lichess-ETYnM", fen: "4Q3/1K6/6pk/1P4rp/q2P4/8/8/8 w - - 0 67"              , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess ETYnM · r757 · pop99
  { id: "lichess-EYfDt", fen: "8/4R1R1/p7/1p6/2p1b3/P1K1k3/8/1r6 b - - 0 50"         , sideToMove: "b", mateIn: 1, theme: "Pillsburys Mate"       , level: 2 }, // lichess EYfDt · r1185 · pop94
  { id: "lichess-f1HNz", fen: "7k/pp2r2p/2p5/5Q2/3qp1P1/1P2R3/P7/6K1 w - - 0 35"     , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess f1HNz · r609 · pop100
  { id: "lichess-fBxWw", fen: "6k1/p1q1rRpp/4P3/8/6QK/3p3P/2p3P1/8 w - - 2 51"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess fBxWw · r730 · pop100
  { id: "lichess-fDDgS", fen: "5Q2/p5pk/1p6/4B1Kp/3PP3/6Pq/n7/8 w - - 2 50"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess fDDgS · r721 · pop97
  { id: "lichess-fgy35", fen: "4k3/ppp4R/4r3/8/P7/2P5/r4PR1/5K2 b - - 0 35"          , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess fgy35 · r848 · pop96
  { id: "lichess-FJAa9", fen: "6k1/p3Q1pp/8/8/1K2p3/4q3/PP6/8 w - - 0 38"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess FJAa9 · r697 · pop93
  { id: "lichess-fnc8k", fen: "8/8/8/8/2q5/4K3/7Q/5k2 w - - 12 79"                   , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess fnc8k · r767 · pop98
  { id: "lichess-FPIa6", fen: "8/4r3/3rpk2/p3N3/1n1PKP2/8/8/6R1 w - - 0 41"          , sideToMove: "w", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess FPIa6 · r1104 · pop100
  { id: "lichess-FqELM", fen: "7k/6p1/4Q2p/5P2/6PK/8/1q5P/8 b - - 2 52"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess FqELM · r977 · pop94
  { id: "lichess-FSZ6e", fen: "8/8/8/8/6pk/8/4Q1PK/2q5 b - - 5 65"                   , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess FSZ6e · r1218 · pop96
  { id: "lichess-FXH2g", fen: "8/1p4Q1/p7/5p2/4qk2/3p4/PP5P/K7 w - - 27 46"          , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess FXH2g · r882 · pop85
  { id: "lichess-g03N8", fen: "8/8/5pk1/8/3r3r/P4RK1/1P3R2/8 b - - 3 54"             , sideToMove: "b", mateIn: 1, theme: "Blind Swine Mate"      , level: 2 }, // lichess g03N8 · r871 · pop96
  { id: "lichess-G4lo8", fen: "8/5p2/1p4pk/5rp1/P2Q4/2P4P/1r5b/7K w - - 5 43"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess G4lo8 · r909 · pop100
  { id: "lichess-g62gb", fen: "r4k2/2R4R/p7/1p1p2p1/3P1r2/2P5/5nK1/8 w - - 3 38"     , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess g62gb · r976 · pop100
  { id: "lichess-gdpuJ", fen: "3R4/5pkp/5N2/2K2pP1/8/8/8/q7 w - - 0 56"              , sideToMove: "w", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess gdpuJ · r930 · pop93
  { id: "lichess-GoWhy", fen: "5rk1/pp1b4/3p1Qp1/3P4/6r1/5K2/P6R/8 w - - 0 29"       , sideToMove: "w", mateIn: 1, theme: "Kill Box Mate"         , level: 2 }, // lichess GoWhy · r918 · pop96
  { id: "lichess-gxZ94", fen: "r7/5p2/p1p2R2/P1Nbk3/1P6/2KP4/8/8 w - - 5 42"         , sideToMove: "w", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess gxZ94 · r1146 · pop92
  { id: "lichess-Gybzt", fen: "6k1/8/8/3p1Qp1/1p1P1p2/1P2r1PK/P2q3R/8 b - - 4 33"    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Gybzt · r979 · pop100
  { id: "lichess-gyMQc", fen: "8/1p6/2b1Qp2/3p2p1/2pk1r1p/8/P4PKP/8 w - - 0 48"      , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess gyMQc · r925 · pop97
  { id: "lichess-H3Ptl", fen: "5Q2/4QK2/8/7k/6q1/8/8/8 b - - 2 106"                  , sideToMove: "b", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess H3Ptl · r978 · pop97
  { id: "lichess-Hk71o", fen: "8/5Q2/2p5/4p3/3pk2P/8/r3r1PK/8 w - - 5 48"            , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess Hk71o · r881 · pop88
  { id: "lichess-hpxZ5", fen: "3r2k1/5ppp/8/8/4q3/3p2P1/P2Q1P1P/R4K2 b - - 1 32"     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess hpxZ5 · r1121 · pop97
  { id: "lichess-hQoAw", fen: "8/pQ6/6pk/7p/4Nn2/8/PPr2qP1/6RK b - - 1 44"           , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess hQoAw · r1136 · pop100
  { id: "lichess-HRTN1", fen: "3k4/8/3pB3/p2P2p1/4PbP1/1Q1P4/PK6/6q1 b - - 8 44"     , sideToMove: "b", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess HRTN1 · r897 · pop100
  { id: "lichess-htJ1N", fen: "6k1/3q1p2/1p5p/6p1/1P1p1P2/P6Q/8/6RK b - - 0 30"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess htJ1N · r570 · pop100
  { id: "lichess-hXQDB", fen: "8/pp3p1p/5k2/1Pp5/P3K3/4N2P/2Prb1P1/2R5 b - - 8 43"   , sideToMove: "b", mateIn: 1, theme: "Pillsburys Mate"       , level: 2 }, // lichess hXQDB · r1014 · pop100
  { id: "lichess-I2Jp8", fen: "5k2/1pb1r3/7p/1PpB4/2P3Q1/8/5qPP/7K w - - 1 42"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess I2Jp8 · r842 · pop96
  { id: "lichess-IDrhf", fen: "8/2pk2p1/p6p/2P1q3/1P4K1/P4Q1P/6P1/8 b - - 10 43"     , sideToMove: "b", mateIn: 1, theme: "Swallowstail Mate"     , level: 2 }, // lichess IDrhf · r961 · pop91
  { id: "lichess-IXatz", fen: "3k2r1/3P1p2/8/R7/4r3/8/3R3K/8 b - - 2 49"             , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess IXatz · r909 · pop93
  { id: "lichess-j5Vq3", fen: "8/1Q4pk/p6n/P4q2/1Pp5/7P/5P2/6RK b - - 0 40"          , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess j5Vq3 · r594 · pop100
  { id: "lichess-jEorh", fen: "k7/P2R3p/6p1/1ppN1p2/8/6P1/5PK1/q7 w - - 4 33"        , sideToMove: "w", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess jEorh · r1229 · pop96
  { id: "lichess-jFeIm", fen: "r6r/1p4Rp/4kpb1/3p4/1B6/pP3R2/P6P/6K1 w - - 5 32"     , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 2 }, // lichess jFeIm · r1091 · pop100
  { id: "lichess-jIPIo", fen: "Q7/2k2pp1/K7/N1q5/8/8/8/8 b - - 2 53"                 , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess jIPIo · r1034 · pop100
  { id: "lichess-jPZD2", fen: "8/p1k1p3/4P3/2p2BP1/1rPb4/K2R4/P7/8 b - - 0 39"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess jPZD2 · r866 · pop98
  { id: "lichess-k9Ksy", fen: "8/7p/1pQ5/2b3Pk/7P/8/4qNK1/8 w - - 9 56"              , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess k9Ksy · r885 · pop93
  { id: "lichess-kaqLu", fen: "4KQ2/2k3q1/8/8/8/8/8/8 b - - 0 58"                    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess kaqLu · r1144 · pop91
  { id: "lichess-kASeE", fen: "8/8/p1pR3N/2P1k1Kp/1P3p2/P4P2/3n3r/8 w - - 20 59"     , sideToMove: "w", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess kASeE · r1022 · pop95
  { id: "lichess-kEE6s", fen: "6r1/8/3k4/7p/2R5/P2NP2K/1PP2P2/6r1 b - - 11 57"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess kEE6s · r937 · pop96
  { id: "lichess-kFGpg", fen: "8/3q1k1p/Q4p1P/3Pp3/1P2P3/2N1K3/P5r1/8 b - - 0 37"    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess kFGpg · r966 · pop95
  { id: "lichess-kpDy0", fen: "8/Q1p2k2/4R3/2Np2p1/3P1q2/6P1/Pr6/5R1K b - - 0 27"    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess kpDy0 · r734 · pop100
  { id: "lichess-l0ChA", fen: "6R1/1r5k/1P6/4p3/4N3/2p1B1K1/2r5/3q4 w - - 2 56"      , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess l0ChA · r905 · pop100
  { id: "lichess-l147N", fen: "5k2/5p2/8/4PK2/5Q2/7P/8/6q1 b - - 10 67"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess l147N · r821 · pop90
  { id: "lichess-lhLZT", fen: "5k2/2R5/1p1N2p1/3Pp2q/1PP2b2/8/5PQ1/5K2 b - - 18 58"  , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess lhLZT · r908 · pop100
  { id: "lichess-LIGYq", fen: "8/5p1k/PQ5p/7n/4b2P/7K/5Pr1/3R4 b - - 2 35"           , sideToMove: "b", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess LIGYq · r917 · pop90
  { id: "lichess-LjUjZ", fen: "8/2pk2P1/8/3P2Q1/4r2P/3K4/q2R4/8 b - - 4 50"          , sideToMove: "b", mateIn: 1, theme: "Triangle Mate"         , level: 2 }, // lichess LjUjZ · r1119 · pop94
  { id: "lichess-lnF1r", fen: "8/6p1/3R4/4R3/2P3Pp/3P3P/3k3K/2r2r2 b - g3 0 52"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess lnF1r · r1095 · pop95
  { id: "lichess-M4Nnp", fen: "2k5/3n4/1p1P4/p3BR2/P1p1KP1P/3r4/8/8 b - - 2 48"      , sideToMove: "b", mateIn: 1, theme: "Corner Mate"           , level: 2 }, // lichess M4Nnp · r818 · pop99
  { id: "lichess-m6cAR", fen: "6R1/8/1r6/7k/8/7r/8/K5R1 b - - 11 49"                 , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess m6cAR · r949 · pop100
  { id: "lichess-MqkRd", fen: "5bk1/5pp1/4q3/3Q3p/1p4P1/3R3K/7P/8 b - - 1 35"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess MqkRd · r841 · pop99
  { id: "lichess-MSwZf", fen: "6k1/5p1p/BR4p1/4P3/5P2/6P1/2r4r/1R3K2 b - - 1 34"     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess MSwZf · r955 · pop100
  { id: "lichess-mtWBu", fen: "4bk2/6R1/4PP2/6K1/7P/8/5r2/8 w - - 3 59"              , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess mtWBu · r984 · pop96
  { id: "lichess-MvjGR", fen: "5rk1/ppp4p/3q1P1Q/8/8/Pn3P2/KP6/8 w - - 1 31"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess MvjGR · r1054 · pop100
  { id: "lichess-N1FYo", fen: "8/5ppk/7p/3Qp3/4P3/2P3KP/6P1/5q2 b - - 1 44"          , sideToMove: "b", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess N1FYo · r884 · pop97
  { id: "lichess-nMzYW", fen: "2k5/R7/5R2/8/6r1/p1r5/5K2/8 w - - 0 47"               , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess nMzYW · r750 · pop98
  { id: "lichess-NNzh1", fen: "2k5/2p3R1/3r4/2Q2pK1/1P2q3/P7/2R3P1/8 b - - 10 50"    , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess NNzh1 · r1106 · pop95
  { id: "lichess-nzDGG", fen: "8/1P2kpp1/8/2Pp4/3NnP2/3KP3/1N1R3r/8 b - - 0 42"      , sideToMove: "b", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess nzDGG · r1085 · pop90
  { id: "lichess-O4ESz", fen: "1k1b1Q2/pp2P3/8/8/P7/7P/3r1PPq/4RK2 b - - 0 41"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess O4ESz · r862 · pop95
  { id: "lichess-ocK7S", fen: "8/7k/p3b3/1p3R1p/2pP4/P3K3/1r6/6R1 w - - 4 41"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess ocK7S · r1123 · pop100
  { id: "lichess-oeKkj", fen: "8/6r1/6k1/3p4/1qp2Q2/3bPP2/1P3KP1/7R w - - 4 46"      , sideToMove: "w", mateIn: 1, theme: "Kill Box Mate"         , level: 2 }, // lichess oeKkj · r1343 · pop94
  { id: "lichess-OgvDL", fen: "rnb5/ppk3b1/8/4P3/3P4/Q7/PPP2K1P/q7 w - - 0 26"       , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess OgvDL · r1015 · pop100
  { id: "lichess-oJrFT", fen: "6rk/pp6/2n4q/8/3P1Q2/2P5/PP4P1/6K1 w - - 0 32"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess oJrFT · r698 · pop92
  { id: "lichess-OurgW", fen: "8/3Pkp2/4p1r1/B2p4/5P1p/6P1/1r5P/2R3K1 w - - 0 44"    , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess OurgW · r1175 · pop93
  { id: "lichess-pbURu", fen: "8/1p5p/3Q2pk/p1KPP3/8/7P/Pq4P1/8 b - - 5 32"          , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess pbURu · r1151 · pop95
  { id: "lichess-pbxSm", fen: "8/7k/7p/3q1r2/3B2Q1/6PP/5P1K/8 w - - 9 42"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess pbxSm · r874 · pop95
  { id: "lichess-Pj2jb", fen: "8/1p5q/3p2R1/2p2k2/8/5K2/1P4R1/8 w - - 0 49"          , sideToMove: "w", mateIn: 1, theme: "Blind Swine Mate"      , level: 2 }, // lichess Pj2jb · r1120 · pop98
  { id: "lichess-pqmZ4", fen: "1R6/6kp/4q1p1/3r4/8/3p4/1P4PP/5QK1 w - - 0 33"        , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess pqmZ4 · r804 · pop92
  { id: "lichess-q07Qx", fen: "3r4/1R1p4/4pp2/r7/2k1P3/p3K3/R5P1/8 w - - 0 35"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess q07Qx · r962 · pop97
  { id: "lichess-Q2Gdb", fen: "4rk2/1Q4p1/5pKp/6nP/6P1/8/8/8 w - - 29 84"            , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Q2Gdb · r1300 · pop100
  { id: "lichess-QaW24", fen: "8/5pp1/4b2p/1Q6/2rpkP2/8/4PK1P/8 w - - 9 39"          , sideToMove: "w", mateIn: 1, theme: "Epaulette Mate"        , level: 2 }, // lichess QaW24 · r951 · pop92
  { id: "lichess-qTd3f", fen: "R3N1k1/5pp1/4p2p/8/3P4/7P/2n2KP1/3r4 w - - 4 45"      , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess qTd3f · r812 · pop86
  { id: "lichess-RaSeU", fen: "7k/6p1/7p/3qpQ2/1pR5/1P2K2P/5PP1/r7 b - - 8 34"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess RaSeU · r904 · pop100
  { id: "lichess-RMHad", fen: "8/8/p7/P5p1/2b4p/5k1K/7P/2R5 b - - 9 57"              , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess RMHad · r1125 · pop91
  { id: "lichess-rMxg6", fen: "5rk1/6pp/8/Q1p5/8/1P3P1q/P1R4R/7K b - - 1 44"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess rMxg6 · r1151 · pop98
  { id: "lichess-Rp6W7", fen: "2R5/3k1pQp/3p4/4n3/1q2P3/4BP2/6PP/6K1 b - - 0 28"     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Rp6W7 · r1040 · pop100
  { id: "lichess-RphMw", fen: "3q1rk1/5p2/p2p1PnQ/6p1/8/P7/6PK/8 w - - 1 39"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess RphMw · r909 · pop100
  { id: "lichess-s0wxK", fen: "8/2R3rk/7p/4QP2/1p2P3/1P5P/1P1q2P1/7K b - - 2 34"     , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess s0wxK · r1096 · pop98
  { id: "lichess-S8yd5", fen: "5R2/ppk1p2q/2p5/6K1/3Q4/P5Pr/8/8 w - - 10 45"         , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess S8yd5 · r880 · pop96
  { id: "lichess-sAORO", fen: "8/8/5Qrk/6pp/5p2/5P1P/7r/5K2 w - - 10 75"             , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess sAORO · r972 · pop100
  { id: "lichess-sbU5w", fen: "2Q5/2p2rk1/p4q2/1p5K/2pP2BR/8/PP6/8 b - - 6 47"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess sbU5w · r893 · pop95
  { id: "lichess-sh2dc", fen: "5r1k/pp4q1/7p/8/P7/2P1Qp1P/1P5K/5R2 b - - 0 32"       , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess sh2dc · r754 · pop100
  { id: "lichess-sO3My", fen: "8/5ppk/q6p/2PK4/3R2P1/3R4/8/8 b - - 4 50"             , sideToMove: "b", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess sO3My · r944 · pop97
  { id: "lichess-SpNGT", fen: "4rk2/1R5R/5K2/4r3/8/8/8/8 b - - 14 83"                , sideToMove: "b", mateIn: 1, theme: "Blind Swine Mate"      , level: 2 }, // lichess SpNGT · r1144 · pop88
  { id: "lichess-srZpg", fen: "1r5k/3R4/3pB1Pp/2p1b3/8/6P1/6K1/8 w - - 7 41"         , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 2 }, // lichess srZpg · r1148 · pop99
  { id: "lichess-t1Boe", fen: "6k1/pp4pp/8/8/P1P5/1P6/5qPP/4Q2K b - - 0 30"          , sideToMove: "b", mateIn: 1, theme: "Back-Rank Mate"        , level: 2 }, // lichess t1Boe · r526 · pop93
  { id: "lichess-Ta5E6", fen: "1k6/pp6/8/8/1P1Q1pPq/P6P/6K1/4r2R b - - 6 36"         , sideToMove: "b", mateIn: 1, theme: "Kill Box Mate"         , level: 2 }, // lichess Ta5E6 · r1238 · pop99
  { id: "lichess-TFKPs", fen: "8/8/3RR3/8/pP3PP1/P7/K3Bk2/2r4r b - b3 0 40"          , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess TFKPs · r1142 · pop100
  { id: "lichess-TlsXU", fen: "1R6/8/6rk/p4K1p/P2B4/2P3P1/1pr2P2/8 w - - 2 55"       , sideToMove: "w", mateIn: 1, theme: "Pillsburys Mate"       , level: 2 }, // lichess TlsXU · r1051 · pop95
  { id: "lichess-tNTTR", fen: "8/7P/ppk5/2p1B1N1/5P1r/8/PPr5/4RK2 b - - 4 41"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess tNTTR · r714 · pop98
  { id: "lichess-trTUL", fen: "5rk1/p2Q3p/P3p1pP/5pP1/8/8/7K/1q6 w - - 0 41"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess trTUL · r904 · pop100
  { id: "lichess-TsJtj", fen: "8/8/p3bR2/1p1pk3/1P1N4/P2KP1r1/8/8 w - - 0 45"        , sideToMove: "w", mateIn: 1, theme: "Hook Mate"             , level: 2 }, // lichess TsJtj · r945 · pop96
  { id: "lichess-TT5SV", fen: "4R3/p4rpk/1p6/8/8/8/Pq3rPP/R2Q2K1 w - - 0 23"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess TT5SV · r810 · pop93
  { id: "lichess-tvKb4", fen: "8/1p6/p1p5/P7/1P4q1/1kP1Q2p/5P1K/8 b - - 3 59"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess tvKb4 · r869 · pop100
  { id: "lichess-TzdYJ", fen: "8/p7/1p6/1P3p1p/6q1/4rkP1/PQ5K/8 w - - 10 48"         , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess TzdYJ · r942 · pop100
  { id: "lichess-uZJcq", fen: "5k2/R6p/p7/2n2p2/5n2/P1P4P/6r1/3R3K w - - 0 30"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess uZJcq · r563 · pop100
  { id: "lichess-v2PW7", fen: "8/6pk/4R2p/1p1q2P1/6PK/7P/4Q3/6r1 b - - 0 42"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess v2PW7 · r910 · pop100
  { id: "lichess-v2U2Z", fen: "8/1p4kp/pP1B2p1/2pq4/3b4/7P/1P4P1/5Q1K w - - 0 31"    , sideToMove: "w", mateIn: 1, theme: "Dovetail Mate"         , level: 2 }, // lichess v2U2Z · r871 · pop99
  { id: "lichess-v32iD", fen: "r6k/5Q1p/2p2qp1/8/p1B5/7P/5nPK/8 w - - 0 38"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess v32iD · r822 · pop100
  { id: "lichess-VCC56", fen: "5k2/5pq1/8/p1P3Q1/1n2Bp2/8/6PK/8 w - - 1 36"          , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess VCC56 · r1007 · pop100
  { id: "lichess-vDC0y", fen: "6Q1/4k3/8/2p5/2BnPP2/2K5/5q2/8 b - - 4 50"            , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess vDC0y · r977 · pop97
  { id: "lichess-vSwTb", fen: "2R2bk1/5r2/p7/1p6/8/1Q3P2/P1P2qPP/4R2K b - - 0 46"    , sideToMove: "b", mateIn: 1, theme: "Back-Rank Mate"        , level: 2 }, // lichess vSwTb · r549 · pop100
  { id: "lichess-vuSm4", fen: "8/5R1p/1p4pk/3r4/5P2/2Q4K/PP3P1P/6r1 b - - 0 32"      , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess vuSm4 · r830 · pop92
  { id: "lichess-W8axp", fen: "7k/pb1q2rp/8/1p2QR2/1P6/2P4P/P7/5K2 w - - 5 34"       , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess W8axp · r827 · pop99
  { id: "lichess-WoIfN", fen: "r6k/pR6/7p/4b3/7P/1P1B4/r7/2K3R1 w - - 4 36"          , sideToMove: "w", mateIn: 1, theme: "Opera Mate"            , level: 2 }, // lichess WoIfN · r968 · pop96
  { id: "lichess-Wvzht", fen: "4kb2/3R4/4KP2/3p4/3r4/8/8/8 w - - 0 63"               , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Wvzht · r971 · pop94
  { id: "lichess-x8e0v", fen: "Q4K2/7r/3P2k1/1Np3b1/2P5/8/R7/8 b - - 0 48"           , sideToMove: "b", mateIn: 1, theme: "Pillsburys Mate"       , level: 2 }, // lichess x8e0v · r1097 · pop89
  { id: "lichess-xBg7g", fen: "3Q4/5Bpk/1p5p/2p5/2b3PP/1q3PK1/8/8 w - - 0 36"        , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess xBg7g · r950 · pop100
  { id: "lichess-XV4ob", fen: "8/1k3p2/1p3p2/4b3/Q5P1/P6P/KR6/2q5 b - - 2 47"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess XV4ob · r908 · pop100
  { id: "lichess-xvQ7J", fen: "7k/R5pp/5p2/3P4/2Q1P3/6PK/1r5P/3q4 b - - 1 38"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess xvQ7J · r1151 · pop100
  { id: "lichess-Xwmbg", fen: "8/6k1/3Q1pq1/3P4/P7/5N1p/5PP1/6K1 b - - 0 47"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Xwmbg · r1155 · pop100
  { id: "lichess-Yg0Fk", fen: "5rk1/3R1p2/7p/3Q2pK/1P6/6P1/7P/5q2 b - - 1 37"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess Yg0Fk · r910 · pop100
  { id: "lichess-yGzup", fen: "6k1/7p/p5r1/2P1Q3/PP5K/2P3P1/5r2/8 b - - 4 47"        , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess yGzup · r892 · pop95
  { id: "lichess-yNbHt", fen: "4Qbk1/p4p1p/2P2qpB/P5P1/7K/7P/8/8 b - - 0 49"         , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess yNbHt · r810 · pop95
  { id: "lichess-yzkfn", fen: "8/p4Q2/p7/4p3/3kq3/1P1p4/P4K2/8 w - - 2 60"           , sideToMove: "w", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess yzkfn · r1191 · pop91
  { id: "lichess-z5yMb", fen: "7k/8/7P/pP6/P3b1q1/2PQ3P/7K/8 b - - 0 42"             , sideToMove: "b", mateIn: 1, theme: "Checkmate in 1"        , level: 2 }, // lichess z5yMb · r1108 · pop100
  { id: "lichess-Zs903", fen: "4rk2/R5R1/6p1/r5P1/7p/1P6/8/1K6 w - - 2 42"           , sideToMove: "w", mateIn: 1, theme: "Blind Swine Mate"      , level: 2 }, // lichess Zs903 · r1137 · pop97
  { id: "lichess-06xEN", fen: "8/1p6/2p5/2P2K1k/8/8/pr6/R7 w - - 0 44"               , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 06xEN · r839 · pop93
  { id: "lichess-0crO9", fen: "3r4/8/6p1/3pKbR1/p2N4/2P4p/7k/8 w - - 0 62"           , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess 0crO9 · r1143 · pop98
  { id: "lichess-0DK93", fen: "8/8/6R1/4Np1p/3p3k/3Kp3/r6P/8 w - - 2 44"             , sideToMove: "w", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess 0DK93 · r1161 · pop95
  { id: "lichess-0GhM8", fen: "8/5p2/6p1/7p/1Q3P2/6PP/2p1kPK1/3q4 w - - 7 50"        , sideToMove: "w", mateIn: 2, theme: "Dovetail Mate"         , level: 3 }, // lichess 0GhM8 · r1303 · pop95
  { id: "lichess-0KhAG", fen: "5k2/p4r2/6R1/2pp4/8/P1PP4/2P2r2/6RK b - - 0 45"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 0KhAG · r980 · pop98
  { id: "lichess-0NVIr", fen: "2k5/8/p7/1p1Q3p/8/2NP4/PPq5/K3n3 b - - 2 36"          , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess 0NVIr · r925 · pop96
  { id: "lichess-0OIxJ", fen: "5k2/8/7p/1B2n1p1/P4P2/6PK/1r5P/5R2 b - - 0 41"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 0OIxJ · r1212 · pop100
  { id: "lichess-0OY0a", fen: "8/1p2kp1Q/2br4/8/7P/2P3P1/PP3P2/6K1 b - - 0 36"       , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess 0OY0a · r780 · pop92
  { id: "lichess-0UI0C", fen: "8/8/8/1P6/8/Pk3r2/1N5R/1K6 b - - 2 51"                , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 0UI0C · r616 · pop100
  { id: "lichess-0uU9p", fen: "3q4/p5k1/1p6/7Q/8/8/PP4PP/3r1RK1 b - - 0 30"          , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess 0uU9p · r1154 · pop97
  { id: "lichess-0z923", fen: "R7/P6k/3b3p/8/3B1p2/7P/5P1K/r7 b - - 1 35"            , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 0z923 · r860 · pop89
  { id: "lichess-1KmUC", fen: "7K/2B3P1/1p6/3bQ3/2kp4/5r2/8/8 b - - 0 53"            , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess 1KmUC · r1086 · pop100
  { id: "lichess-1nQOt", fen: "5r2/p6p/1p6/3R4/5nk1/5Nr1/PPP2K2/8 w - - 14 49"       , sideToMove: "w", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess 1nQOt · r1278 · pop98
  { id: "lichess-1P7pY", fen: "4k3/4b2Q/4p1p1/p7/8/1P1b4/P7/K3R3 b - - 7 46"         , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess 1P7pY · r837 · pop98
  { id: "lichess-1reTT", fen: "7k/1R6/6K1/7p/8/5rp1/8/8 w - - 0 47"                  , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 1reTT · r1290 · pop98
  { id: "lichess-1RlN1", fen: "1r2k3/R6R/7p/2pb4/P6r/1P5P/1K6/8 w - - 8 44"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 1RlN1 · r1294 · pop100
  { id: "lichess-1tc4Q", fen: "8/8/3R4/3PpP1k/1n2P3/6K1/6B1/1rq5 w - - 0 55"         , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess 1tc4Q · r1029 · pop93
  { id: "lichess-2fzFJ", fen: "6k1/1R3p2/4pBpp/1P1p2b1/8/1r3P1P/4K3/8 w - - 8 41"    , sideToMove: "w", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess 2fzFJ · r811 · pop100
  { id: "lichess-33JYv", fen: "6r1/6pk/R7/6p1/4K3/2P3r1/P7/1R6 w - - 0 41"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 33JYv · r809 · pop100
  { id: "lichess-37xoI", fen: "3r2k1/R4n1p/6p1/p3q3/1p5P/1Q3P2/6P1/7K w - - 4 35"    , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 37xoI · r1031 · pop100
  { id: "lichess-3d9g6", fen: "1r6/4R2p/1p5k/p1p1R1p1/5rP1/7P/5P2/6K1 w - - 0 38"    , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 3d9g6 · r1196 · pop100
  { id: "lichess-3HnG1", fen: "6k1/6r1/2p3Np/3n3P/1P2r3/5RP1/5PK1/8 w - - 0 38"      , sideToMove: "w", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess 3HnG1 · r749 · pop95
  { id: "lichess-3Iizu", fen: "8/7P/8/p7/6P1/1Pk5/P2pr3/1K4R1 b - - 0 44"            , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 3Iizu · r1116 · pop100
  { id: "lichess-3LpLf", fen: "3kr3/2bb4/Q1P3pp/3R4/8/P6P/6P1/7K b - - 0 39"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 3LpLf · r605 · pop100
  { id: "lichess-3vKvW", fen: "k7/8/1K6/p2P2R1/P7/8/1prb4/8 w - - 0 54"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 3vKvW · r617 · pop100
  { id: "lichess-4fPIa", fen: "6k1/R7/5p2/3b4/1P3B1N/2Pn2P1/4r3/6K1 b - - 0 35"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 4fPIa · r1256 · pop100
  { id: "lichess-4k4y2", fen: "3q2k1/5p1p/6pP/4Q3/2P5/8/KP1n4/4R3 b - - 0 36"        , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess 4k4y2 · r1148 · pop95
  { id: "lichess-4QLzW", fen: "6k1/p2R1p2/6q1/4b3/8/P1p2P1Q/1r3P2/5K2 w - - 0 35"    , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 4QLzW · r900 · pop100
  { id: "lichess-4rgB5", fen: "7Q/5p2/4k2p/8/5P1P/P1N3P1/5b1K/4q3 b - - 0 41"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 4rgB5 · r1189 · pop99
  { id: "lichess-4SqSq", fen: "2k5/2p5/p1Pn2N1/7p/r5p1/5R1P/6K1/8 w - - 0 40"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 4SqSq · r881 · pop98
  { id: "lichess-4v5xg", fen: "6k1/2R5/8/3r2p1/3b2P1/5p2/P4r2/1R4K1 w - - 0 37"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 4v5xg · r923 · pop100
  { id: "lichess-4wJfE", fen: "3Q4/5ppk/7p/5r2/P5n1/8/P3N1PP/7K b - - 4 33"          , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess 4wJfE · r1107 · pop100
  { id: "lichess-4Xlh9", fen: "8/5p1p/7k/1p1B4/6QP/2P5/1P2nqPK/8 b - - 0 32"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 4Xlh9 · r1003 · pop100
  { id: "lichess-5d9CQ", fen: "4R3/kp6/7p/6p1/2P2p2/1P6/P1r3PP/7K b - - 0 30"        , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess 5d9CQ · r577 · pop95
  { id: "lichess-5EeT3", fen: "5K2/3R1R1p/2r3pk/p7/P7/8/6PP/4r3 b - - 19 45"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 5EeT3 · r888 · pop100
  { id: "lichess-5kKU5", fen: "krn2b2/1p1r3p/1Q3p2/3P3K/2N3P1/7P/8/8 w - - 5 53"     , sideToMove: "w", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess 5kKU5 · r1143 · pop98
  { id: "lichess-5LzxV", fen: "8/2r5/8/7p/4R3/7k/5P2/6K1 b - - 0 41"                 , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 5LzxV · r703 · pop96
  { id: "lichess-5p8GI", fen: "6R1/p6p/1b2B1pk/8/6PP/6K1/P7/4r3 w - - 3 43"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 5p8GI · r864 · pop94
  { id: "lichess-5QNIs", fen: "5bk1/1R5p/6p1/3N1n2/1p1r4/8/1P3PPP/6K1 w - - 2 30"    , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess 5QNIs · r970 · pop98
  { id: "lichess-5RDrC", fen: "8/2p4k/3p3P/p2B3K/6P1/4bR2/P7/4r3 b - - 4 50"         , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess 5RDrC · r740 · pop92
  { id: "lichess-5SuQG", fen: "6k1/5Rp1/3NP2p/5P2/3B1nP1/3b4/4r3/3K4 b - - 7 41"     , sideToMove: "b", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess 5SuQG · r1025 · pop100
  { id: "lichess-5TALP", fen: "5rk1/p1R5/1p4p1/4B1b1/1P6/8/P5PP/6K1 b - - 2 34"      , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess 5TALP · r919 · pop100
  { id: "lichess-60F8m", fen: "8/7p/4N1pk/4p3/p5r1/8/5K2/2R5 w - - 0 44"             , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess 60F8m · r732 · pop94
  { id: "lichess-6hvxj", fen: "8/2pR1p2/2B4k/1PP3pp/8/6PK/1r5P/8 b - - 4 38"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6hvxj · r977 · pop98
  { id: "lichess-6iHgR", fen: "5r1k/6p1/7p/p1PQ4/P1P5/6P1/4q2P/3R3K b - - 0 31"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6iHgR · r1121 · pop98
  { id: "lichess-6m0ya", fen: "8/2B5/p1p2b2/1k2p2p/4P3/PPK4P/8/8 w - - 2 40"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6m0ya · r817 · pop100
  { id: "lichess-6MmKt", fen: "8/3q3k/7b/1P3P1Q/K1R5/P5rP/8/7R b - - 0 49"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6MmKt · r1081 · pop99
  { id: "lichess-6qxId", fen: "1k6/ppp2p2/6b1/6P1/3r4/8/PP2R3/2K5 w - - 0 37"        , sideToMove: "w", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess 6qxId · r567 · pop87
  { id: "lichess-6RmWD", fen: "8/8/R7/5pkp/8/5PP1/6K1/4r3 w - - 8 60"                , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6RmWD · r862 · pop100
  { id: "lichess-6Thy3", fen: "8/6pp/5k2/3q4/P7/2p1Q3/5PPP/2B3K1 b - - 1 30"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6Thy3 · r662 · pop100
  { id: "lichess-6w0le", fen: "4bk2/b5pp/8/8/2Bp4/2B4P/1P4P1/6K1 w - - 0 34"         , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess 6w0le · r896 · pop89
  { id: "lichess-6wJye", fen: "8/5p2/8/3PPN2/6p1/3B1q1k/2P2P2/6K1 w - - 5 52"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 6wJye · r900 · pop100
  { id: "lichess-73mRs", fen: "7k/7p/5Kp1/1B5r/2P5/R7/8/3r4 w - - 5 50"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 73mRs · r648 · pop100
  { id: "lichess-7Abku", fen: "4r2k/p3P2P/2p2ppP/3q4/8/2QP4/1PK5/8 w - - 1 40"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 7Abku · r950 · pop99
  { id: "lichess-7aWky", fen: "8/7b/7P/7B/1P1k1p2/4b1P1/7P/7K b - - 0 39"            , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess 7aWky · r1045 · pop100
  { id: "lichess-7Q5OB", fen: "7k/r5rp/5NQ1/pp6/5PP1/P7/KP6/7q w - - 2 34"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 7Q5OB · r1036 · pop100
  { id: "lichess-7qCSf", fen: "5r1k/p5pp/8/6N1/8/8/q5PP/5R1K w - - 0 30"             , sideToMove: "w", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess 7qCSf · r1129 · pop92
  { id: "lichess-7sVCg", fen: "8/8/R7/6p1/5p1k/5P2/2r3P1/6K1 w - - 0 52"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 7sVCg · r844 · pop97
  { id: "lichess-7YU0L", fen: "1k6/7R/1p4r1/p2r4/n7/P5P1/2P4P/5RK1 w - - 0 37"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 7YU0L · r889 · pop100
  { id: "lichess-7ZphA", fen: "6R1/p7/8/7B/P7/1P4pk/2r5/6K1 b - - 0 54"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 7ZphA · r1141 · pop100
  { id: "lichess-85MrZ", fen: "4r1k1/5p2/6p1/R6p/3Q4/3n1P2/6PP/7K b - - 0 32"        , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess 85MrZ · r1233 · pop95
  { id: "lichess-8AvGo", fen: "8/7p/4N1pk/3Pbp2/6r1/5R2/5P2/5K2 w - - 5 40"          , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess 8AvGo · r635 · pop97
  { id: "lichess-8CpTD", fen: "8/7k/6p1/4P2p/5P2/2p1q3/2Qp2PP/3R3K b - - 4 39"       , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess 8CpTD · r921 · pop95
  { id: "lichess-8dyGV", fen: "8/R2b1k2/5Bp1/4P3/5P1K/1r6/7P/8 b - - 8 43"           , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess 8dyGV · r1071 · pop93
  { id: "lichess-8fszV", fen: "1r5k/1PR3p1/5pB1/p7/1r6/6P1/6KP/8 w - - 1 52"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 8fszV · r893 · pop100
  { id: "lichess-8hNqc", fen: "8/R5pk/p5rp/K7/1P5P/4R1P1/8/6r1 b - - 4 36"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 8hNqc · r888 · pop96
  { id: "lichess-8NKQx", fen: "5r2/6k1/3Q2p1/8/2p5/3nB3/PP4PP/7K b - - 0 39"         , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess 8NKQx · r1042 · pop95
  { id: "lichess-8onPD", fen: "3r4/3P4/2pR4/2P2k2/5p1K/5P2/8/8 b - - 0 44"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 8onPD · r521 · pop100
  { id: "lichess-8p4Sg", fen: "6k1/pR3rpp/8/2n5/8/q3P3/6PP/5RK1 w - - 0 23"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 8p4Sg · r1122 · pop100
  { id: "lichess-8Sjz6", fen: "5K2/4P1R1/8/R2bBp2/3b1P2/Pk5r/8/8 b - - 8 51"         , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess 8Sjz6 · r1156 · pop94
  { id: "lichess-90Wbk", fen: "8/6r1/1R1P4/6R1/3Pk2K/5bP1/8/8 b - - 6 45"            , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess 90Wbk · r1134 · pop97
  { id: "lichess-919jn", fen: "3k4/1pp4p/p2p2b1/8/2q5/7Q/P4RPP/7K b - - 5 39"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 919jn · r691 · pop98
  { id: "lichess-9cxhl", fen: "2r2bk1/1R5p/p5p1/8/P1p1N3/7P/5PPK/8 w - - 0 34"       , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess 9cxhl · r858 · pop100
  { id: "lichess-9GVGf", fen: "8/8/8/6R1/7K/5kp1/R7/6r1 b - - 5 55"                  , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 9GVGf · r729 · pop92
  { id: "lichess-9Hl5V", fen: "8/7R/kp4p1/6P1/PP6/K5n1/5r2/7q w - - 0 41"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 9Hl5V · r1246 · pop99
  { id: "lichess-9mDmj", fen: "8/ppR5/4k1p1/8/4NnP1/8/Pr3P1P/5K2 b - - 0 29"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 9mDmj · r507 · pop100
  { id: "lichess-9Nodo", fen: "7k/8/2p3RP/1b4Nr/4P3/8/p4K2/8 w - - 0 51"             , sideToMove: "w", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess 9Nodo · r977 · pop97
  { id: "lichess-9ySYx", fen: "8/R7/6pk/8/3p1KP1/3q1P2/4p3/8 w - - 2 39"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess 9ySYx · r947 · pop100
  { id: "lichess-A04Ld", fen: "1k6/ppp3p1/7r/3r4/5P2/6P1/P5K1/4R3 w - - 0 30"        , sideToMove: "w", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess A04Ld · r400 · pop100
  { id: "lichess-a0N0p", fen: "6k1/5ppp/8/4p3/5q2/3P2RP/2r2PQK/8 w - - 0 28"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess a0N0p · r517 · pop100
  { id: "lichess-A1I3D", fen: "6q1/6rk/5Q2/4p3/8/1P6/P5rp/5R1K w - - 14 49"          , sideToMove: "w", mateIn: 2, theme: "Kill Box Mate"         , level: 3 }, // lichess A1I3D · r1383 · pop96
  { id: "lichess-A1y74", fen: "8/pRR3pk/8/3PP2P/3n1PK1/7P/r7/8 b - - 10 45"          , sideToMove: "b", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess A1y74 · r826 · pop91
  { id: "lichess-A3HnH", fen: "3k3r/3p4/2pBp1R1/1bP2p2/8/p1K3R1/4r3/8 w - - 0 43"    , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess A3HnH · r830 · pop91
  { id: "lichess-acmL9", fen: "4r1k1/5pbp/2Q3pB/8/6qP/3p4/5P2/5K2 w - - 8 43"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess acmL9 · r625 · pop100
  { id: "lichess-Ahm2m", fen: "8/2R1R1pp/5k2/1P6/1rP3r1/8/5P1P/7K b - - 6 38"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Ahm2m · r773 · pop97
  { id: "lichess-aLaRV", fen: "4R3/2p2ppp/8/3P2k1/8/3Q2K1/6PP/2q5 b - - 0 37"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess aLaRV · r862 · pop94
  { id: "lichess-AnC00", fen: "3R4/p3r3/1p2r1b1/1P3p2/4kn2/6K1/8/7R w - - 0 52"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess AnC00 · r782 · pop100
  { id: "lichess-ANmgX", fen: "5k2/p3R1p1/5p2/5P2/r7/7r/3K4/4R3 w - - 5 40"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ANmgX · r858 · pop100
  { id: "lichess-aRJCy", fen: "5r2/R3R3/n5k1/3r4/8/2P5/P1P3PP/6K1 b - - 2 30"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess aRJCy · r716 · pop97
  { id: "lichess-ATkZZ", fen: "1k6/1pp5/3N1pP1/pP5r/P7/8/7r/3RKR2 b - - 4 35"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ATkZZ · r836 · pop100
  { id: "lichess-AvaTX", fen: "1q5k/3Q3p/6p1/5p2/1p6/1Bp3P1/5PK1/b7 w - - 0 33"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess AvaTX · r1097 · pop99
  { id: "lichess-awdWd", fen: "5k2/5p1p/3b1Np1/p2P2P1/4R3/7r/4K3/8 w - - 0 40"       , sideToMove: "w", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess awdWd · r1162 · pop97
  { id: "lichess-awg9p", fen: "8/3r2k1/5rp1/2P3Kp/P6P/2Q5/6P1/8 b - - 5 37"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess awg9p · r617 · pop100
  { id: "lichess-b0LNe", fen: "1R6/5ppk/8/3rP1K1/6P1/r7/p7/R7 w - - 2 42"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess b0LNe · r871 · pop95
  { id: "lichess-B5FPn", fen: "4r2k/5B1p/6p1/1pB5/3p4/3P4/1PK5/q7 w - - 0 33"        , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess B5FPn · r931 · pop92
  { id: "lichess-b6JPW", fen: "8/8/4B3/1Nk2rb1/P1P5/6Pp/7P/6K1 b - - 2 41"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess b6JPW · r778 · pop96
  { id: "lichess-B7iNf", fen: "8/8/4R3/5p2/1r3P2/5kP1/7P/6K1 b - - 2 37"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess B7iNf · r638 · pop100
  { id: "lichess-BeWrY", fen: "3R3R/2p1r3/1pk5/p2b3P/8/P5P1/2P2P2/6K1 b - - 0 39"    , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess BeWrY · r533 · pop100
  { id: "lichess-bgNPx", fen: "8/3R3p/8/5pp1/5p1k/r4P2/6P1/5K2 w - - 0 41"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess bgNPx · r698 · pop98
  { id: "lichess-bGx44", fen: "8/p5R1/8/P7/1P2nNbk/r2B4/7P/4K3 b - - 16 51"          , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess bGx44 · r758 · pop87
  { id: "lichess-BHLxJ", fen: "8/8/1P2R1p1/6rp/3p4/1R2nk2/2P5/4K3 b - - 0 46"        , sideToMove: "b", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess BHLxJ · r969 · pop94
  { id: "lichess-BnKdx", fen: "1R2N3/5p1k/4p1p1/4r1P1/7p/2K3n1/8/8 w - - 2 48"       , sideToMove: "w", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess BnKdx · r769 · pop100
  { id: "lichess-but8C", fen: "1r2Nbk1/3R3p/4ppp1/2p5/8/6P1/5PKP/8 w - - 8 40"       , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess but8C · r1140 · pop100
  { id: "lichess-BwddJ", fen: "4rk2/pp1R4/2p2N2/7p/8/5P2/PPP5/1K6 b - - 0 30"        , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess BwddJ · r400 · pop100
  { id: "lichess-bZ7ik", fen: "3r4/7p/1R1PR3/3r1pp1/5k2/8/6KP/8 w - - 0 53"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess bZ7ik · r874 · pop95
  { id: "lichess-BZGrJ", fen: "5k2/pp3p2/2p5/3rN3/1r6/6RP/3p2P1/5RK1 w - - 2 52"     , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess BZGrJ · r1116 · pop98
  { id: "lichess-C5Va3", fen: "1r6/4k1p1/4p3/1B2P3/P2Pb3/6P1/5R1K/8 b - - 5 39"      , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess C5Va3 · r867 · pop98
  { id: "lichess-cDi4l", fen: "2k5/2p5/4p1r1/1pN5/5K2/P3P2R/1n3P2/8 w - - 0 40"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess cDi4l · r615 · pop95
  { id: "lichess-cG2Fz", fen: "8/2R4p/b5pk/4p3/5pPP/1r1p1P2/3K4/8 w - - 6 47"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess cG2Fz · r838 · pop97
  { id: "lichess-CJY99", fen: "R1r3k1/2r2ppp/8/3p4/8/5P1P/6P1/2R4K w - - 0 37"       , sideToMove: "w", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess CJY99 · r952 · pop95
  { id: "lichess-csDXN", fen: "6r1/RP5R/4k2p/2P4P/8/5p2/P4P1K/2r5 b - - 3 47"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess csDXN · r1035 · pop98
  { id: "lichess-cwhUs", fen: "5k2/2r2pb1/1R4pp/8/7r/P1P5/KP6/4R3 w - - 6 40"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess cwhUs · r900 · pop100
  { id: "lichess-D4GZH", fen: "5k2/5p2/4nP2/5r2/R7/6P1/5PK1/8 w - - 3 52"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess D4GZH · r647 · pop100
  { id: "lichess-dH7oI", fen: "8/4Q3/4b3/2p2q2/p4k2/P7/1PP2r2/1K1RR3 b - - 0 43"     , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess dH7oI · r800 · pop100
  { id: "lichess-Dkuz7", fen: "5R2/R6P/6p1/6k1/5n2/1P1b1P2/P3r3/3K4 b - - 8 40"      , sideToMove: "b", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess Dkuz7 · r1055 · pop98
  { id: "lichess-Dkyo5", fen: "8/2pk4/R2p4/1P1P4/2PKP3/1r4p1/R5P1/5r2 b - - 0 40"    , sideToMove: "b", mateIn: 2, theme: "Epaulette Mate"        , level: 3 }, // lichess Dkyo5 · r840 · pop95
  { id: "lichess-dm5rA", fen: "8/R6p/5Kpk/1q3b2/2r3P1/7P/8/8 w - - 10 47"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess dm5rA · r1066 · pop95
  { id: "lichess-DOl0N", fen: "6k1/5pp1/4p2p/3p4/1rb5/R2B4/6K1/8 w - - 2 37"         , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess DOl0N · r662 · pop93
  { id: "lichess-dQWIo", fen: "2k5/2p4R/1pK5/pP5p/P7/2P3r1/8/8 w - - 0 37"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess dQWIo · r894 · pop94
  { id: "lichess-dRRhp", fen: "8/5K2/8/5pq1/6k1/3Q4/6P1/8 w - - 0 53"                , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess dRRhp · r1302 · pop100
  { id: "lichess-DVTMz", fen: "6k1/3R1r1p/6pQ/1p6/8/p3PPK1/1q6/8 w - - 0 40"         , sideToMove: "w", mateIn: 2, theme: "Kill Box Mate"         , level: 3 }, // lichess DVTMz · r958 · pop95
  { id: "lichess-dZMl0", fen: "k1r5/7R/1R6/8/3B2n1/8/P5PP/7K b - - 0 39"             , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess dZMl0 · r1093 · pop90
  { id: "lichess-e8DZ2", fen: "7Q/8/8/6R1/5p2/n2k1P2/4p1P1/4K3 b - - 0 49"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess e8DZ2 · r820 · pop95
  { id: "lichess-ebA9K", fen: "8/4N1pk/2p1p3/4n1r1/p7/P7/1P3R2/5K2 w - - 2 39"       , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess ebA9K · r731 · pop86
  { id: "lichess-egGM2", fen: "7k/pp5p/3p1rr1/8/7Q/7R/6RP/7K b - - 0 33"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess egGM2 · r681 · pop94
  { id: "lichess-egNux", fen: "1r6/5Qp1/1k5q/1Pp5/3b3r/7P/6B1/2RR3K b - - 0 36"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess egNux · r826 · pop100
  { id: "lichess-Ei3Kc", fen: "7R/8/4rnp1/4ppk1/8/4P2P/5PK1/8 w - - 6 44"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Ei3Kc · r1175 · pop100
  { id: "lichess-eJpmo", fen: "8/p2RB2p/kp6/5p2/PP2b3/8/7r/K7 w - - 0 37"            , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess eJpmo · r993 · pop93
  { id: "lichess-emm8e", fen: "7k/6pp/p3Q3/7P/5P2/2r5/P2q4/K6R b - - 3 36"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess emm8e · r939 · pop100
  { id: "lichess-EMNy2", fen: "Q7/6k1/1B3p2/4pPp1/3pP1n1/6rp/8/R6K b - - 0 53"       , sideToMove: "b", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess EMNy2 · r1026 · pop99
  { id: "lichess-eVA32", fen: "5r1k/p1b2B1p/6p1/8/8/4B2P/5PP1/5K2 w - - 0 29"        , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess eVA32 · r851 · pop92
  { id: "lichess-evt5N", fen: "5k2/p1r2b2/8/1p2bB2/4Q3/1P6/P4PP1/6K1 b - - 4 45"     , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess evt5N · r576 · pop100
  { id: "lichess-Ewipi", fen: "8/pp5k/5p1p/8/6N1/KP6/P1br4/6R1 w - - 2 41"           , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess Ewipi · r770 · pop96
  { id: "lichess-eXDFv", fen: "8/p1pp2k1/1p6/5Q1p/4r3/8/P5PP/7K b - - 0 33"          , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess eXDFv · r435 · pop100
  { id: "lichess-f0aa6", fen: "8/8/8/3R4/p1p3pk/8/Pr3PP1/6K1 w - - 2 41"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess f0aa6 · r871 · pop94
  { id: "lichess-F1Dgu", fen: "8/R5p1/3kppp1/P7/8/8/r1R2PPP/6K1 b - - 0 41"          , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess F1Dgu · r906 · pop100
  { id: "lichess-F1EFm", fen: "8/8/8/5pk1/5n2/4N2P/1r3R2/5K2 b - - 5 51"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess F1EFm · r1059 · pop100
  { id: "lichess-f89vC", fen: "8/1p3p1k/p6p/3Nr3/5K2/8/4r3/6R1 w - - 0 34"           , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess f89vC · r857 · pop96
  { id: "lichess-f9JIj", fen: "7k/2p4p/p1n2b2/1p1b4/8/2P5/PP2R2K/6R1 w - - 3 40"     , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess f9JIj · r589 · pop100
  { id: "lichess-fahcM", fen: "6k1/4R3/8/r7/5N2/6p1/5PP1/6K1 b - - 0 34"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess fahcM · r525 · pop100
  { id: "lichess-FAHoF", fen: "2Q5/KP1n4/8/3k4/8/8/2R5/7r b - - 0 81"                , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess FAHoF · r933 · pop98
  { id: "lichess-fICSQ", fen: "8/8/p1R3p1/1pQ2r2/kn6/8/PKP5/3q4 w - - 0 39"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess fICSQ · r1208 · pop100
  { id: "lichess-Flq07", fen: "8/8/5kp1/8/6PK/r6R/7P/8 b - - 8 56"                   , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Flq07 · r913 · pop100
  { id: "lichess-fMW0g", fen: "1r5Q/5p2/5p2/5P2/6P1/P1k5/K2p3R/8 b - - 0 56"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess fMW0g · r1202 · pop99
  { id: "lichess-fq0Rz", fen: "5rk1/1R1R1N1p/p3p1p1/7n/8/4K3/6rP/8 w - - 0 34"       , sideToMove: "w", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess fq0Rz · r1040 · pop99
  { id: "lichess-FrHgi", fen: "7k/5p1p/3pq3/Q7/2r3R1/P6P/KP6/8 w - - 0 32"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess FrHgi · r1324 · pop98
  { id: "lichess-FtfJM", fen: "8/R6p/6pk/8/1q4P1/5NK1/7P/8 w - - 5 39"               , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess FtfJM · r842 · pop94
  { id: "lichess-FvGkq", fen: "8/2r5/8/R7/6pk/8/5KP1/8 w - - 2 53"                   , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess FvGkq · r936 · pop100
  { id: "lichess-FYRYR", fen: "8/5bk1/5p1p/2bR2p1/8/6P1/7P/1Q5K b - - 0 42"          , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess FYRYR · r582 · pop93
  { id: "lichess-fz2Jf", fen: "8/6N1/2P5/8/p1R5/1r3k2/8/5K2 b - - 0 57"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess fz2Jf · r540 · pop100
  { id: "lichess-G0NHh", fen: "8/8/8/8/3B4/pk6/8/1KR4r b - - 11 63"                  , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess G0NHh · r1022 · pop93
  { id: "lichess-GgPPP", fen: "8/8/8/RRP1Bp2/5P1K/P6P/k5r1/7r b - - 0 50"            , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess GgPPP · r1104 · pop92
  { id: "lichess-GHBjm", fen: "R7/P5k1/6p1/6Kp/r4P1P/6P1/8/8 b - - 0 46"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess GHBjm · r840 · pop94
  { id: "lichess-GKFWQ", fen: "1r6/3k4/3b1p2/3Q1N2/4p3/P7/5PP1/6K1 b - - 4 35"       , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess GKFWQ · r433 · pop100
  { id: "lichess-gPSjD", fen: "5k2/5p1p/1r4p1/1n2R3/1p4P1/8/2K5/2B5 w - - 5 41"      , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess gPSjD · r986 · pop100
  { id: "lichess-gTxI0", fen: "r7/5Pk1/2R5/8/1pBb4/P5P1/K1P5/8 b - - 0 37"           , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess gTxI0 · r974 · pop100
  { id: "lichess-gZXlJ", fen: "8/5p2/4p1k1/6pp/1R2N3/1P4PK/5r1P/8 b - - 3 45"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess gZXlJ · r900 · pop96
  { id: "lichess-h3pac", fen: "5r1k/7p/4B3/1pP5/1q6/6BP/5pK1/5R2 w - - 0 39"         , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess h3pac · r864 · pop100
  { id: "lichess-H7Ai7", fen: "8/K3Nrpk/p7/8/8/r7/3R4/8 w - - 4 57"                  , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess H7Ai7 · r853 · pop92
  { id: "lichess-H7pzb", fen: "3r1R2/p5Q1/1p1kq3/3p3p/8/1P6/P5PP/7K b - - 5 37"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess H7pzb · r661 · pop98
  { id: "lichess-haq50", fen: "5r1k/1R4p1/p6p/8/6n1/7N/P5PP/7K b - - 0 27"           , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess haq50 · r1133 · pop97
  { id: "lichess-HGCt7", fen: "6k1/p2R2pp/1p3p2/8/8/5PK1/r3r1PP/2R5 w - - 2 33"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess HGCt7 · r968 · pop100
  { id: "lichess-HhuoP", fen: "3r3k/5p2/5Pp1/p7/3q1Q2/5K2/7P/8 w - - 0 45"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess HhuoP · r955 · pop100
  { id: "lichess-hJiVC", fen: "8/1pR2Rp1/1rb2Nk1/7p/7P/6P1/5P2/6K1 b - - 0 37"       , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess hJiVC · r847 · pop100
  { id: "lichess-HMpZJ", fen: "3r2k1/3R1p1p/6p1/2p3KP/5P2/8/1q6/7R w - - 0 37"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess HMpZJ · r921 · pop100
  { id: "lichess-HnRUQ", fen: "3br2r/1p3p2/p7/2P5/1Pk4p/2N4P/2K3R1/8 w - - 1 44"     , sideToMove: "w", mateIn: 2, theme: "Epaulette Mate"        , level: 3 }, // lichess HnRUQ · r823 · pop93
  { id: "lichess-hUpCX", fen: "2r4k/Q4R2/4pRp1/P2p4/8/KPq5/7r/8 w - - 0 40"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess hUpCX · r790 · pop100
  { id: "lichess-iblq4", fen: "6k1/5p1p/6p1/8/3RNn2/1r3P1P/5P2/5K2 b - - 0 33"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess iblq4 · r543 · pop100
  { id: "lichess-Id3BV", fen: "3r4/p7/8/7p/R3R1nk/1PP5/P5P1/3N2K1 b - - 0 42"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Id3BV · r515 · pop100
  { id: "lichess-iQ6oL", fen: "7k/1R3Q2/6p1/4q3/3rP3/7P/6P1/7K b - - 6 43"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess iQ6oL · r868 · pop100
  { id: "lichess-J9CvA", fen: "3k4/R3R3/1p4p1/2r5/P4P2/8/6PP/7K b - - 2 44"          , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess J9CvA · r418 · pop100
  { id: "lichess-JDEpK", fen: "3n4/ppp3pB/3b4/6k1/4R3/2r5/P5KP/5R2 w - - 5 27"       , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess JDEpK · r1171 · pop99
  { id: "lichess-jFGFm", fen: "k3r3/1p2r2p/p7/8/Q7/R4qP1/5P1P/3R2K1 b - - 3 32"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess jFGFm · r984 · pop100
  { id: "lichess-JFOVI", fen: "2r5/6R1/4pk2/1p6/p7/1n4RP/1P3P2/1K6 b - - 6 42"       , sideToMove: "b", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess JFOVI · r1044 · pop93
  { id: "lichess-JicAl", fen: "8/8/k1K5/8/3r4/8/8/6R1 w - - 23 74"                   , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess JicAl · r876 · pop96
  { id: "lichess-jKvR6", fen: "1b5k/7p/8/2BB4/8/1P1p4/r7/6K1 w - - 0 37"             , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess jKvR6 · r819 · pop100
  { id: "lichess-JlaFl", fen: "7k/3bN2p/8/6p1/4n3/4B2P/6PK/8 w - - 4 40"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess JlaFl · r1084 · pop98
  { id: "lichess-jN2KP", fen: "8/p3Nppk/1bQ3p1/8/3q4/P7/2P1KP2/8 w - - 0 33"         , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess jN2KP · r1060 · pop100
  { id: "lichess-jrbvX", fen: "6R1/p4r2/kp6/3p4/P7/6B1/4n1PK/1R6 b - - 3 37"         , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess jrbvX · r819 · pop95
  { id: "lichess-jTCjT", fen: "5k1B/5p2/1b5p/P7/8/6P1/b3B2P/7K b - - 0 33"           , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess jTCjT · r858 · pop91
  { id: "lichess-JtlZj", fen: "5R2/6k1/1p4r1/p5r1/7p/P7/KPP5/5R2 w - - 0 41"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess JtlZj · r999 · pop100
  { id: "lichess-jwStd", fen: "8/pp6/8/3R2p1/1r3p1b/kP5P/P7/1K6 w - - 0 52"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess jwStd · r503 · pop100
  { id: "lichess-jygK2", fen: "6k1/2p2p1p/6p1/6N1/2P2n2/4q3/1Q3R1P/7K b - - 2 34"    , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess jygK2 · r752 · pop100
  { id: "lichess-jyjKD", fen: "3r2k1/p2P1ppp/8/2p1R3/2r1P1P1/7P/8/6K1 w - - 1 37"    , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess jyjKD · r680 · pop100
  { id: "lichess-K8ZyA", fen: "R7/P7/3p4/7p/4B3/6kP/r5P1/6K1 b - - 2 44"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess K8ZyA · r814 · pop95
  { id: "lichess-k9lMQ", fen: "6k1/Rr3p2/p5pK/p4r1p/P7/7P/8/8 w - - 0 39"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess k9lMQ · r824 · pop99
  { id: "lichess-KcO5s", fen: "5r2/4Q2p/3p2pk/4p3/3n4/P5P1/6PP/6K1 b - - 0 37"       , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess KcO5s · r836 · pop92
  { id: "lichess-kOSm3", fen: "1Q6/8/6k1/7p/3Bp3/1PP2bPK/r7/4R3 b - - 0 49"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess kOSm3 · r1301 · pop100
  { id: "lichess-kSE8N", fen: "4r1k1/pR3pp1/8/1P5Q/r7/8/5PP1/5K2 b - - 0 37"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess kSE8N · r661 · pop97
  { id: "lichess-KW1gz", fen: "4r3/k1B5/p7/2bP4/8/3K2P1/7r/RR6 b - - 0 40"           , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess KW1gz · r1048 · pop100
  { id: "lichess-KyA4Y", fen: "7k/1B1R3p/4P3/3P2b1/8/5p1P/4rP2/6K1 b - - 0 33"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess KyA4Y · r917 · pop100
  { id: "lichess-L4p3s", fen: "6k1/r4ppp/4p3/q7/4Q3/8/5PPP/1R4K1 w - - 1 28"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess L4p3s · r858 · pop100
  { id: "lichess-l8FN0", fen: "8/3Rbk2/6pp/5p2/4rq2/6R1/2Q4P/6K1 b - - 8 46"         , sideToMove: "b", mateIn: 2, theme: "Dovetail Mate"         , level: 3 }, // lichess l8FN0 · r1057 · pop95
  { id: "lichess-lElbf", fen: "8/8/5k2/4Rppp/3P3P/4PKP1/1r6/8 b - - 0 41"            , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess lElbf · r985 · pop98
  { id: "lichess-LF8L9", fen: "6k1/5pp1/4b2p/8/3pB3/2p4P/4r1PK/R7 w - - 4 46"        , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess LF8L9 · r651 · pop100
  { id: "lichess-LflW2", fen: "8/7k/7p/8/p3Np1P/4nP2/2r5/6RK w - - 2 42"             , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess LflW2 · r845 · pop95
  { id: "lichess-LGqeF", fen: "6k1/5p2/6p1/5r2/1ppB4/1r6/4R1K1/8 w - - 0 44"         , sideToMove: "w", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess LGqeF · r610 · pop100
  { id: "lichess-Liudi", fen: "6k1/5pp1/1pR1r3/p7/P2PBn2/5P2/1P6/5K2 w - - 2 35"     , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess Liudi · r562 · pop95
  { id: "lichess-LJPVi", fen: "7k/7p/4R1p1/6P1/2Bb4/4p3/Pr6/4K3 w - - 0 32"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess LJPVi · r975 · pop100
  { id: "lichess-LmR2K", fen: "8/1R4pk/7p/8/3n1N2/r6P/5PP1/5K2 b - - 3 38"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess LmR2K · r798 · pop100
  { id: "lichess-LNdYW", fen: "3r4/6k1/6p1/8/8/4P3/KP1nBP2/3R4 b - - 0 32"           , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess LNdYW · r766 · pop90
  { id: "lichess-LQIjP", fen: "7k/1R2R3/P4pp1/1N5p/1q6/7P/5PPK/3r4 b - - 2 42"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess LQIjP · r1020 · pop99
  { id: "lichess-lsWXq", fen: "8/2p4k/p1p1Q1p1/4P3/5b2/4q2P/P5K1/5R2 b - - 7 42"     , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess lsWXq · r1194 · pop100
  { id: "lichess-LTFZ3", fen: "6k1/1p6/1P4K1/5p2/6p1/2r5/3pp3/R7 w - - 0 50"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess LTFZ3 · r800 · pop93
  { id: "lichess-lXajP", fen: "8/2b5/7k/3P2p1/4P1B1/1r5p/4RP2/7K b - - 3 43"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess lXajP · r725 · pop100
  { id: "lichess-M3dRa", fen: "8/B7/2p2kpp/5p2/2nP1K1P/5PP1/8/8 b - - 12 53"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess M3dRa · r870 · pop100
  { id: "lichess-m3IIu", fen: "6k1/1p1n1r1p/6p1/8/1P2q3/1Q5P/B5P1/7K w - - 0 30"     , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess m3IIu · r1076 · pop100
  { id: "lichess-MDF7c", fen: "8/8/8/2R5/5kp1/8/6PK/1r6 b - - 2 46"                  , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess MDF7c · r952 · pop100
  { id: "lichess-mjHC9", fen: "8/3R4/7p/5p1k/7P/6PN/r1r2PK1/8 w - - 0 51"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess mjHC9 · r1038 · pop100
  { id: "lichess-MlTtx", fen: "8/5K1k/5p2/4p3/3p4/3P4/3r4/2R5 w - - 1 55"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess MlTtx · r807 · pop95
  { id: "lichess-mmJUa", fen: "8/8/4R3/P2P1p2/1B3kp1/2P5/6PK/r7 b - - 2 45"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess mmJUa · r1045 · pop100
  { id: "lichess-MQifq", fen: "2r4k/p5pp/5p2/8/2rR4/8/Q5PP/2R4K b - - 0 33"          , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess MQifq · r587 · pop98
  { id: "lichess-MsxlO", fen: "7k/2p3pp/3q4/2p2P2/6K1/2P5/p1P5/4R3 w - - 0 50"       , sideToMove: "w", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess MsxlO · r571 · pop94
  { id: "lichess-mVlb7", fen: "8/2R5/5pkp/3p4/5PPr/4P3/4K3/8 w - - 2 41"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess mVlb7 · r923 · pop100
  { id: "lichess-mWiVb", fen: "6k1/5p2/1R6/6n1/7p/1P4rP/P1R4K/8 b - - 0 36"          , sideToMove: "b", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess mWiVb · r1158 · pop94
  { id: "lichess-N2vqR", fen: "8/8/1p6/p7/P1P5/4b3/1Q3p1Q/4k2K b - - 3 60"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess N2vqR · r1030 · pop100
  { id: "lichess-N7hrV", fen: "6k1/5pp1/1P5p/3Q2b1/1P1PK1P1/2r4P/8/8 b - - 4 44"     , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess N7hrV · r952 · pop100
  { id: "lichess-n7l7R", fen: "6k1/2R2p2/3K2pp/3P4/1r5P/1r6/8/B7 w - - 1 41"         , sideToMove: "w", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess n7l7R · r695 · pop100
  { id: "lichess-N8Wdc", fen: "6R1/8/8/8/5Kp1/2rbN2k/8/8 w - - 0 51"                 , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess N8Wdc · r1189 · pop99
  { id: "lichess-nCI5f", fen: "8/p7/8/1Rp2kp1/2P5/6PK/r6P/8 b - - 5 40"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess nCI5f · r795 · pop93
  { id: "lichess-NkYN5", fen: "7k/p1p2r1p/1p1p1P2/4nQ2/4P3/8/P7/1K6 w - - 0 34"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess NkYN5 · r790 · pop98
  { id: "lichess-nNXZV", fen: "3R4/5p1p/3p1rk1/3P4/6PK/8/8/8 w - - 1 42"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess nNXZV · r845 · pop100
  { id: "lichess-np32n", fen: "2k3r1/1p2R3/3p4/p2P4/P7/4n1PK/4N3/8 b - - 1 40"       , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess np32n · r932 · pop91
  { id: "lichess-NQDWU", fen: "6k1/5ppp/r1Q5/8/8/5P1K/r5PP/4q3 w - - 3 34"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess NQDWU · r826 · pop96
  { id: "lichess-NSTCl", fen: "8/5r2/5k2/4R1pK/P2B1p2/1P3P2/2P4P/8 b - - 0 46"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess NSTCl · r747 · pop97
  { id: "lichess-NVeDy", fen: "8/8/8/4R3/2P2pBk/5P2/5qPp/7K w - - 4 57"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess NVeDy · r933 · pop100
  { id: "lichess-Nvf7A", fen: "1R6/P4pk1/8/8/8/r5p1/6P1/7K b - - 1 41"               , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Nvf7A · r780 · pop100
  { id: "lichess-NX6HU", fen: "8/8/5K1k/1p3P2/8/pP6/r7/4R3 w - - 0 57"               , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess NX6HU · r707 · pop100
  { id: "lichess-NXtyV", fen: "6k1/1p4pp/1P1rP3/3n4/8/R6P/6P1/6K1 w - - 1 35"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess NXtyV · r637 · pop100
  { id: "lichess-O68cc", fen: "2K5/2P5/2k5/8/2P5/8/4R3/7r b - - 0 63"                , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess O68cc · r715 · pop96
  { id: "lichess-O7kwJ", fen: "3r3r/5pR1/7k/1p2P3/5K2/pn4N1/8/8 w - - 6 46"          , sideToMove: "w", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess O7kwJ · r1109 · pop95
  { id: "lichess-o7wBc", fen: "6k1/5p2/4p1p1/3b3p/5q2/8/2R3P1/Q6K w - - 0 44"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess o7wBc · r889 · pop100
  { id: "lichess-o9z36", fen: "7k/b6p/6p1/8/2B2P2/3p2K1/3Bb1P1/8 w - - 0 44"         , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess o9z36 · r878 · pop91
  { id: "lichess-ocxKL", fen: "5R2/6nk/8/1p3PP1/6KP/r7/8/8 w - - 1 57"               , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ocxKL · r872 · pop94
  { id: "lichess-OD8Mc", fen: "k7/p3R3/3r2p1/1pN5/8/b7/4K1PP/8 w - - 0 37"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess OD8Mc · r711 · pop93
  { id: "lichess-oiBzG", fen: "1k2r3/1pp1P3/p7/2q3p1/8/1P6/P3Q1P1/4R2K b - - 3 39"   , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess oiBzG · r1118 · pop98
  { id: "lichess-OiFlg", fen: "6Q1/R7/p3pk2/3p4/8/bpPr4/4p3/K6R b - - 0 39"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess OiFlg · r1236 · pop100
  { id: "lichess-OKw79", fen: "7k/R5p1/8/8/8/2P4r/1PB1nr2/1K6 w - - 0 41"            , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess OKw79 · r552 · pop96
  { id: "lichess-olf0b", fen: "3k1r2/1pq5/4RN2/8/3p4/1P4Pp/P1P4K/4R3 w - - 3 33"     , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess olf0b · r934 · pop100
  { id: "lichess-OOedR", fen: "1R6/8/3p4/6r1/6p1/7k/2P4r/2K3R1 w - - 8 48"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess OOedR · r854 · pop100
  { id: "lichess-orQwM", fen: "8/3N1Rpk/7p/7P/8/2n3P1/1p1K1P2/2r5 w - - 0 41"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess orQwM · r1329 · pop100
  { id: "lichess-OSDTv", fen: "2k5/pb1p4/8/1P4r1/8/1P2N1P1/P4P1K/3R4 b - - 0 39"     , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess OSDTv · r797 · pop100
  { id: "lichess-p6lNy", fen: "8/2B2k2/5p2/6p1/p1N1R2p/8/2r2PPP/6K1 b - - 3 35"      , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess p6lNy · r658 · pop100
  { id: "lichess-pbGxf", fen: "R7/P6k/8/8/5N1p/4P2P/r5PK/4n3 b - - 0 42"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess pbGxf · r1335 · pop100
  { id: "lichess-pDACK", fen: "6k1/pR6/2p3K1/3pr1p1/8/5Pr1/P7/3B4 w - - 3 43"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess pDACK · r1186 · pop98
  { id: "lichess-pdfdA", fen: "6kb/5p1p/p3p1pP/8/5Q2/2r5/P2K4/8 w - - 1 35"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess pdfdA · r903 · pop100
  { id: "lichess-pDmyu", fen: "4k3/4r1B1/4N3/1p1P4/pP3R2/2p5/5PK1/2q5 w - - 3 53"    , sideToMove: "w", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess pDmyu · r1122 · pop99
  { id: "lichess-PDszE", fen: "5k2/5pp1/p1N4p/3P4/1P4n1/3R2P1/1r4P1/6K1 b - - 2 35"  , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess PDszE · r758 · pop100
  { id: "lichess-PK47f", fen: "8/8/7k/R5pp/P7/6PK/3r3P/8 b - - 0 50"                 , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess PK47f · r910 · pop100
  { id: "lichess-PUXEK", fen: "8/k1p5/ppr5/8/4Q3/5P2/r3n1PK/4R3 b - - 1 31"          , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess PUXEK · r871 · pop92
  { id: "lichess-pvXAt", fen: "7k/p1q3p1/7p/1p6/1K1BQ3/P1P5/1P6/8 b - - 3 39"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess pvXAt · r970 · pop100
  { id: "lichess-Px84z", fen: "8/p6R/1p6/k1p5/2Pp4/1P3r2/P1K5/8 w - - 3 41"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Px84z · r614 · pop100
  { id: "lichess-Q1Noh", fen: "8/k1r5/1p1qp3/5p2/5R2/5QP1/5P1K/8 w - - 3 73"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Q1Noh · r1088 · pop100
  { id: "lichess-q6Afm", fen: "1Q6/8/2p5/2kr4/4R3/5Pp1/6P1/7K b - - 12 51"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess q6Afm · r529 · pop100
  { id: "lichess-qF7D2", fen: "8/8/2q3kp/5p2/P5P1/2P4K/2Q2P1P/8 b - - 0 39"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess qF7D2 · r989 · pop100
  { id: "lichess-QGTkq", fen: "8/1kr2p2/3Qp3/1P1b3p/3P4/6PP/5P2/6K1 b - - 0 39"      , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess QGTkq · r583 · pop100
  { id: "lichess-QhaFp", fen: "k7/P3R3/nK6/8/1P6/2P5/8/5q2 w - - 0 50"               , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess QhaFp · r838 · pop90
  { id: "lichess-qm1Yo", fen: "1r6/kP6/4np2/5r2/6RP/5PP1/8/1R4K1 w - - 1 43"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess qm1Yo · r796 · pop100
  { id: "lichess-Qm6x8", fen: "6k1/1R4p1/5p1p/3r4/1pN5/1Pn5/2P3PP/2K5 b - - 5 36"    , sideToMove: "b", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess Qm6x8 · r974 · pop98
  { id: "lichess-qNFCd", fen: "8/4R2p/5Rpk/p2pP3/1r1P1KPP/1r6/8/8 w - - 3 37"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess qNFCd · r883 · pop95
  { id: "lichess-qngwJ", fen: "5bk1/1R6/6n1/7N/1r6/1P6/8/1K6 w - - 1 48"             , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess qngwJ · r1122 · pop96
  { id: "lichess-Qpw3o", fen: "8/8/5k2/5P1K/6P1/6R1/8/2r5 b - - 4 62"                , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Qpw3o · r607 · pop100
  { id: "lichess-QVpy9", fen: "6k1/R5pp/8/8/P3n3/3r2B1/6PP/6K1 b - - 0 33"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess QVpy9 · r558 · pop100
  { id: "lichess-QYosj", fen: "6k1/5p2/6pp/8/3B1P1P/1p4P1/1P2RK2/1q6 w - - 0 42"     , sideToMove: "w", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess QYosj · r582 · pop98
  { id: "lichess-R2xrc", fen: "5k2/pbp2p1p/1p3N2/4P3/8/KP6/P3r3/6R1 w - - 2 33"      , sideToMove: "w", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess R2xrc · r976 · pop100
  { id: "lichess-RDdOd", fen: "8/3Q2pk/2pB4/2P1pK2/3q3p/7P/8/8 b - - 7 41"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess RDdOd · r1183 · pop100
  { id: "lichess-RE1pd", fen: "7k/p2r2p1/6qp/2n5/8/P6P/Q5P1/5R1K w - - 1 33"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess RE1pd · r905 · pop100
  { id: "lichess-rGKAr", fen: "5r2/pp3r2/3k3K/3P2P1/P1P5/1B3n2/8/R4R2 b - - 2 36"    , sideToMove: "b", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess rGKAr · r1190 · pop99
  { id: "lichess-rie7h", fen: "8/6bp/7k/r7/4B1Kp/6B1/8/8 w - - 0 53"                 , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess rie7h · r914 · pop100
  { id: "lichess-RJcGU", fen: "2R1N2k/5p2/4p2p/3pP3/3P3P/1r1b4/8/6K1 w - - 2 43"     , sideToMove: "w", mateIn: 2, theme: "Hook Mate"             , level: 3 }, // lichess RJcGU · r1160 · pop96
  { id: "lichess-rkqsa", fen: "6k1/2r2p1p/r5p1/1R6/1K1B4/5P2/8/8 w - - 0 49"         , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess rkqsa · r503 · pop89
  { id: "lichess-rTdfy", fen: "3N3k/p5pp/8/8/2b5/4q3/P5PP/5R1K w - - 0 25"           , sideToMove: "w", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess rTdfy · r1052 · pop98
  { id: "lichess-RTwBR", fen: "2rk4/1B6/4Q3/1b2Pp2/3P4/pP6/P7/1K6 b - - 0 40"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess RTwBR · r904 · pop100
  { id: "lichess-RvE9h", fen: "2r4k/8/pp5p/4P3/8/1P6/P2R2PP/7K b - - 0 30"           , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess RvE9h · r400 · pop100
  { id: "lichess-s1u44", fen: "8/8/8/7p/1P3k2/1R4p1/r5P1/6K1 b - - 1 44"             , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess s1u44 · r634 · pop100
  { id: "lichess-sbS1j", fen: "6k1/5p2/4p1p1/3p2QR/3q1P2/8/6PK/2r5 w - - 1 38"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess sbS1j · r886 · pop98
  { id: "lichess-SCXZ0", fen: "8/8/1N3k1p/pN3pp1/5P2/1P2R1PK/r6P/8 b - - 0 41"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess SCXZ0 · r1124 · pop100
  { id: "lichess-slP2s", fen: "1r4k1/7p/3N1R2/3p1R2/1np3P1/4r2P/7K/8 w - - 6 45"     , sideToMove: "w", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess slP2s · r1284 · pop99
  { id: "lichess-SlxGo", fen: "Q7/8/8/8/1P4p1/6P1/4pk2/7K b - - 0 52"                , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess SlxGo · r876 · pop86
  { id: "lichess-SqJ6H", fen: "8/2pr4/R5p1/1B2P3/7p/1k4pP/6P1/7K b - - 0 40"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess SqJ6H · r467 · pop100
  { id: "lichess-SuEso", fen: "8/p5p1/4R2p/kr6/6P1/2K5/5r2/6R1 w - - 0 57"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess SuEso · r832 · pop96
  { id: "lichess-SvanH", fen: "2k5/p2n4/2K5/2Pp2p1/1Q1P4/1P4P1/r7/2q5 w - - 1 46"    , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess SvanH · r899 · pop100
  { id: "lichess-taDwR", fen: "8/4PQ1p/6p1/pp6/6P1/4RPk1/r7/6K1 b - - 0 38"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess taDwR · r761 · pop93
  { id: "lichess-TBMHo", fen: "8/3Q2pk/4P2p/3P4/8/3qr2P/6P1/6RK b - - 2 48"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess TBMHo · r973 · pop95
  { id: "lichess-tbsZp", fen: "6k1/1b4r1/3R1R2/3P2Pp/6rP/1n5K/8/8 w - - 0 45"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess tbsZp · r868 · pop95
  { id: "lichess-tGITX", fen: "8/3R2pk/7p/5N2/r3pN2/5nP1/5PKP/1q6 w - - 11 46"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess tGITX · r901 · pop100
  { id: "lichess-tKU4h", fen: "5r2/7p/p5pb/kp1Nq3/8/8/6PP/2RR3K w - - 8 39"          , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess tKU4h · r727 · pop100
  { id: "lichess-To89U", fen: "5r1k/2p4p/8/2bB4/8/4P3/5PKB/8 w - - 0 31"             , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess To89U · r738 · pop100
  { id: "lichess-tSbdK", fen: "8/R7/6kp/5rp1/1pPNn3/1P2B3/6PP/7K b - - 5 39"         , sideToMove: "b", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess tSbdK · r1175 · pop99
  { id: "lichess-tt7jT", fen: "6k1/p1p5/6nQ/5qN1/8/8/P1r2PPP/4R1K1 b - - 2 31"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess tt7jT · r774 · pop100
  { id: "lichess-tt8RJ", fen: "7k/p3PBpp/3B1p2/8/b4P2/4b1P1/7P/7K b - - 1 33"        , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess tt8RJ · r876 · pop93
  { id: "lichess-tvFvo", fen: "8/pq5k/3P1Q2/8/5B2/P7/5PPP/6K1 b - - 2 41"            , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess tvFvo · r642 · pop100
  { id: "lichess-twnNz", fen: "8/3R2pk/4N2p/4B3/pn4P1/4P2P/1P4r1/1K6 b - - 3 29"     , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess twnNz · r617 · pop100
  { id: "lichess-tZrN3", fen: "6k1/5pp1/6p1/2R5/2P5/6P1/r1rpKPP1/3R4 w - - 4 34"     , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess tZrN3 · r923 · pop100
  { id: "lichess-u9SyQ", fen: "1k6/p1p5/3p4/6q1/8/1PP3p1/P1K1R1Qr/8 w - - 1 50"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess u9SyQ · r860 · pop100
  { id: "lichess-UD0lQ", fen: "8/8/4p1p1/3p2k1/1p1P4/4P1K1/4q3/7Q w - - 0 45"        , sideToMove: "w", mateIn: 2, theme: "Swallowstail Mate"     , level: 3 }, // lichess UD0lQ · r920 · pop96
  { id: "lichess-udKWy", fen: "1R6/6k1/7p/4p1p1/2B1N2n/5n1K/PP4r1/8 w - - 2 35"      , sideToMove: "w", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess udKWy · r1131 · pop100
  { id: "lichess-uF6Kp", fen: "8/6pk/8/6r1/3nN3/7P/1R5K/8 b - - 1 52"                , sideToMove: "b", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess uF6Kp · r777 · pop89
  { id: "lichess-uGrkL", fen: "1r3bk1/2R5/4p2p/8/1p2N3/4P2P/5P2/6K1 w - - 0 39"      , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 3 }, // lichess uGrkL · r794 · pop97
  { id: "lichess-uKVrO", fen: "7k/1p1R4/p5Qp/6p1/P1PP2K1/4q2P/1P6/8 b - - 4 34"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess uKVrO · r1147 · pop100
  { id: "lichess-uLaeY", fen: "5r2/6pk/5r2/1p5p/1P2N3/6Pb/3R3P/R5K1 b - - 12 43"     , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 3 }, // lichess uLaeY · r592 · pop95
  { id: "lichess-uMTlT", fen: "4N3/8/3p4/5ppk/8/PR3PPK/r7/8 b - - 0 40"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess uMTlT · r923 · pop100
  { id: "lichess-UnkRB", fen: "1r4k1/5pP1/p6p/8/7R/P4R1P/3r4/7K b - - 0 37"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess UnkRB · r1085 · pop100
  { id: "lichess-uqdhd", fen: "8/3R3p/4k3/4r1pK/1p6/5P1P/1P4r1/3R4 w - - 0 39"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess uqdhd · r1196 · pop100
  { id: "lichess-uSV8X", fen: "8/1p3r2/5k2/1R6/8/2P1n1RK/1P4P1/8 b - - 2 42"         , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess uSV8X · r723 · pop86
  { id: "lichess-UTAxl", fen: "7k/6p1/7p/3p1Q2/4n3/8/4q2P/6RK w - - 9 43"            , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess UTAxl · r860 · pop95
  { id: "lichess-utZl6", fen: "2r5/6kp/6p1/4p3/2r1N1PP/p7/P3R3/K4R2 b - - 2 39"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess utZl6 · r578 · pop100
  { id: "lichess-uZQB7", fen: "8/7p/p4Kpk/8/4p3/8/1r6/2R5 w - - 0 45"                , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess uZQB7 · r708 · pop94
  { id: "lichess-v4pey", fen: "8/5ppk/4p3/5b1B/5P2/4b1P1/3p3P/3R3K b - - 0 37"       , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess v4pey · r817 · pop100
  { id: "lichess-v649D", fen: "k7/p4ppp/B2R4/5r2/8/6K1/2rp2PP/8 w - - 4 37"          , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess v649D · r601 · pop94
  { id: "lichess-vbYGW", fen: "8/8/2p2R1p/8/P7/1P5k/2r4P/7K b - - 2 45"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess vbYGW · r886 · pop94
  { id: "lichess-vESmA", fen: "8/p2R4/kp6/4b3/PPK4P/6r1/8/8 w - - 0 42"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess vESmA · r941 · pop100
  { id: "lichess-vFj8Z", fen: "5r2/4N1pk/8/1p2P1p1/4K3/2p1P3/1q6/5R2 w - - 2 50"     , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess vFj8Z · r895 · pop94
  { id: "lichess-vw5LW", fen: "5k2/R7/5Kp1/p4p1p/r6P/1r4P1/8/8 w - - 0 57"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess vw5LW · r702 · pop100
  { id: "lichess-vxNhB", fen: "8/p4R2/kpK5/8/1P4p1/P7/8/6r1 w - - 0 50"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess vxNhB · r1059 · pop99
  { id: "lichess-VZLR4", fen: "3Q4/b5k1/6p1/1b2p2p/8/6P1/7P/7K b - - 0 47"           , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess VZLR4 · r727 · pop100
  { id: "lichess-w07lT", fen: "8/7R/2R5/p3qp2/Pb2p1kP/4Pn2/5PK1/8 w - - 1 37"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess w07lT · r1084 · pop98
  { id: "lichess-w1SK3", fen: "8/8/r2N2kp/6p1/6n1/6P1/1PPR2PP/6K1 b - - 8 35"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess w1SK3 · r511 · pop100
  { id: "lichess-wEIGQ", fen: "6k1/R7/R7/2p5/2P1n1P1/1Pb4P/3r4/2K5 b - - 7 55"       , sideToMove: "b", mateIn: 2, theme: "Corner Mate"           , level: 3 }, // lichess wEIGQ · r1030 · pop94
  { id: "lichess-WJQQq", fen: "8/8/5pp1/p4b1p/1r5P/5k2/4RnNK/8 w - - 4 51"           , sideToMove: "w", mateIn: 2, theme: "Vukovic Mate"          , level: 3 }, // lichess WJQQq · r1188 · pop93
  { id: "lichess-wNdb0", fen: "3R4/5p1k/p5p1/8/2q3rp/5Q2/5B1P/5R1K b - - 5 46"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess wNdb0 · r612 · pop100
  { id: "lichess-wRyCH", fen: "4r3/4N1pk/1p6/p4p2/3r4/P1R5/1P5P/6K1 w - - 2 40"      , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess wRyCH · r785 · pop100
  { id: "lichess-WTm26", fen: "8/2N5/7R/4k1p1/r1P2nPP/8/3N1P2/5K2 b - - 0 54"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess WTm26 · r526 · pop96
  { id: "lichess-WvCu3", fen: "8/8/1r2NKpk/5p2/4r3/5R2/8/8 w - - 6 64"               , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess WvCu3 · r661 · pop98
  { id: "lichess-Wybpu", fen: "6k1/7p/6p1/6P1/2q5/rp3P2/1Q6/1K1R4 w - - 2 34"        , sideToMove: "w", mateIn: 2, theme: "Kill Box Mate"         , level: 3 }, // lichess Wybpu · r1164 · pop96
  { id: "lichess-WZg3e", fen: "2k5/1pp1r3/7p/1r2N3/1P3P1P/4K3/8/6R1 w - - 1 42"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess WZg3e · r506 · pop100
  { id: "lichess-WZprC", fen: "8/p7/7R/3B1kp1/8/1P4PK/r6P/8 b - - 0 34"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess WZprC · r981 · pop97
  { id: "lichess-x3bT1", fen: "5r1k/6pp/2b5/3q2N1/8/6PP/P4R1K/8 w - - 0 32"          , sideToMove: "w", mateIn: 2, theme: "Smothered Mate"        , level: 3 }, // lichess x3bT1 · r1133 · pop95
  { id: "lichess-X3kOd", fen: "8/kr4pp/3Bn3/3NP3/2r5/4K1P1/7P/5R2 w - - 0 36"        , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 3 }, // lichess X3kOd · r862 · pop100
  { id: "lichess-X49ae", fen: "3R4/7k/5K2/p5Pp/5P1P/8/P1p5/3q4 w - - 0 53"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess X49ae · r1243 · pop100
  { id: "lichess-X5xss", fen: "3r4/p6p/7k/4Q3/1P6/4b2P/P2q2P1/7K w - - 9 50"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess X5xss · r1346 · pop100
  { id: "lichess-x6Wpx", fen: "2kr4/1p2R1Q1/p7/5P2/1P6/P7/2r3PP/6K1 b - - 6 35"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess x6Wpx · r900 · pop100
  { id: "lichess-xBJ3c", fen: "2r5/8/3Bk2r/4P1P1/p2R4/8/PP6/1K6 b - - 0 38"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess xBJ3c · r717 · pop95
  { id: "lichess-xJnvv", fen: "8/R7/5ppk/3bp3/1B5P/7K/1r6/8 w - - 2 43"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess xJnvv · r982 · pop99
  { id: "lichess-XKjrd", fen: "8/r5p1/8/5pR1/5P2/6Pk/5K2/8 w - - 3 63"               , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess XKjrd · r1301 · pop100
  { id: "lichess-xlvoR", fen: "5k2/2R5/5K2/8/6P1/2pr4/8/8 w - - 2 57"                , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess xlvoR · r783 · pop96
  { id: "lichess-xmQu4", fen: "8/p5b1/8/6p1/4Q3/2P3k1/PP1r4/6K1 b - - 0 47"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess xmQu4 · r722 · pop100
  { id: "lichess-xnCr4", fen: "8/1p3K1k/pPp2P2/P7/8/8/3pr3/3R4 w - - 0 54"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess xnCr4 · r628 · pop100
  { id: "lichess-XnEoe", fen: "5r2/8/6R1/4k1p1/6P1/4Np2/4nP1K/8 b - - 10 44"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess XnEoe · r744 · pop100
  { id: "lichess-XPrYD", fen: "4kr2/R2b3R/1p6/8/2p5/3P1r2/3K4/8 w - - 4 40"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess XPrYD · r1158 · pop100
  { id: "lichess-XsJAG", fen: "8/pR5p/6pk/8/P5P1/1P2rN1P/4n2K/1r6 w - - 1 37"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess XsJAG · r1134 · pop100
  { id: "lichess-xVZZT", fen: "8/p5p1/1p4k1/8/5QP1/6KP/Pq6/8 w - - 0 39"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess xVZZT · r1028 · pop100
  { id: "lichess-Y92VZ", fen: "r7/8/8/8/1R6/3k4/4nPPK/4R3 b - - 2 42"                , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 3 }, // lichess Y92VZ · r776 · pop93
  { id: "lichess-ykl8F", fen: "3r4/2R4p/4Rp1k/p6P/6P1/1P6/r7/6K1 b - - 1 36"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ykl8F · r658 · pop100
  { id: "lichess-ynDE9", fen: "8/4Q3/p7/6p1/2Pn1q1k/P4p2/5P2/5BK1 w - - 0 44"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ynDE9 · r789 · pop100
  { id: "lichess-yQCnv", fen: "6R1/5B1k/pb4p1/1b4Pp/5P2/8/7P/7K b - - 8 46"          , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess yQCnv · r837 · pop91
  { id: "lichess-YSphp", fen: "5R2/6k1/2p5/p2pq3/1p4P1/3Q4/PPP5/1K6 b - - 0 41"      , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess YSphp · r751 · pop100
  { id: "lichess-yT2Y5", fen: "2r5/5kp1/R7/1p5R/6P1/5n1P/PP6/1K6 b - - 0 38"         , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess yT2Y5 · r930 · pop100
  { id: "lichess-yUcOv", fen: "5r1k/Q5Rp/p2R4/8/5q2/2P3PP/5P1K/r7 b - - 0 30"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess yUcOv · r861 · pop100
  { id: "lichess-yXU5O", fen: "7Q/1kp3Q1/pp6/n7/4P3/K1P5/Pr6/8 b - - 0 49"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess yXU5O · r1250 · pop100
  { id: "lichess-yY4B1", fen: "8/6pp/1R5b/4r3/2k5/2P5/3p1PPP/3R2K1 b - - 0 33"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess yY4B1 · r718 · pop92
  { id: "lichess-Yz6LX", fen: "8/8/1p4Pk/8/p4R2/5PRK/8/q7 b - - 2 51"                , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Yz6LX · r920 · pop100
  { id: "lichess-z0yes", fen: "5r2/8/8/3P4/3k4/1Q6/3q1bPP/2R4K b - - 0 38"           , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess z0yes · r576 · pop100
  { id: "lichess-zBvJ6", fen: "8/8/R6p/6pk/8/5KP1/P1r5/8 w - - 3 39"                 , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess zBvJ6 · r915 · pop100
  { id: "lichess-ZCkWQ", fen: "8/2R1R3/3r1p2/p4k1P/8/r1p2PK1/8/8 w - - 2 52"         , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ZCkWQ · r809 · pop100
  { id: "lichess-zh3Ds", fen: "8/8/7R/5kp1/8/6PK/5r2/8 b - - 0 56"                   , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess zh3Ds · r833 · pop93
  { id: "lichess-Zkqxo", fen: "6k1/3b1p2/p2q2pK/6N1/7P/2Q3P1/5P2/8 b - - 3 44"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Zkqxo · r897 · pop94
  { id: "lichess-ZN9XP", fen: "7k/p5R1/1p2N1pp/1P6/r3R3/8/6PP/7K b - - 0 40"         , sideToMove: "b", mateIn: 2, theme: "Back-Rank Mate"        , level: 3 }, // lichess ZN9XP · r542 · pop100
  { id: "lichess-zOIj6", fen: "5r1k/B6p/2p3p1/8/4p1b1/PBP5/2P5/6K1 w - - 0 25"       , sideToMove: "w", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess zOIj6 · r860 · pop96
  { id: "lichess-ZRCSr", fen: "8/1pp5/p7/B4k2/5b2/1P6/P1b5/K6R b - - 0 37"           , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 3 }, // lichess ZRCSr · r828 · pop92
  { id: "lichess-ZrN4k", fen: "7k/p3rB2/2p3PB/1p4P1/8/b7/1pK5/8 w - - 1 37"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ZrN4k · r1176 · pop95
  { id: "lichess-ZtWnG", fen: "6k1/8/6K1/Rp6/4r3/8/8/8 w - - 0 49"                   , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ZtWnG · r942 · pop100
  { id: "lichess-zVRAr", fen: "8/8/1r3p2/3R1Pp1/6P1/K1k5/2P5/8 b - - 0 52"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess zVRAr · r1120 · pop100
  { id: "lichess-Zvzh6", fen: "8/pR4p1/5p1p/5rkP/8/P5PK/8/8 w - - 9 71"              , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess Zvzh6 · r1116 · pop100
  { id: "lichess-ZZaUk", fen: "8/5ppk/8/3Q4/8/2r3qP/6P1/3R3K w - - 0 41"             , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 3 }, // lichess ZZaUk · r938 · pop100
  { id: "lichess-503xl", fen: "8/5R2/4P1k1/3P2p1/6Bp/1b5P/6PK/q3r3 w - - 0 61"       , sideToMove: "w", mateIn: 2, theme: "Opera Mate"            , level: 4 }, // lichess 503xl · r1187 · pop98
  { id: "lichess-5XArd", fen: "8/7p/7k/5Kp1/6Pn/6N1/8/8 w - - 5 50"                  , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess 5XArd · r875 · pop100
  { id: "lichess-6ezYm", fen: "7k/pB6/8/4P3/3n1r1P/8/PP4P1/3R2K1 b - - 0 32"         , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess 6ezYm · r917 · pop93
  { id: "lichess-6qP9M", fen: "8/1Bk5/P7/5R2/5pp1/7P/r5PK/8 b - - 1 48"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess 6qP9M · r1030 · pop100
  { id: "lichess-8urlO", fen: "5r2/6k1/8/p6R/Pr1p2n1/3B4/2P1K3/6R1 b - - 4 40"       , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess 8urlO · r906 · pop100
  { id: "lichess-c6k2N", fen: "8/8/6R1/6N1/5p2/4r1kP/P7/4b1K1 b - - 2 41"            , sideToMove: "b", mateIn: 2, theme: "Opera Mate"            , level: 4 }, // lichess c6k2N · r822 · pop100
  { id: "lichess-CdGKW", fen: "3k4/p7/b7/4Q3/3b4/P1r5/7P/3R3K b - - 0 34"            , sideToMove: "b", mateIn: 2, theme: "Double Bishop Mate"    , level: 4 }, // lichess CdGKW · r901 · pop92
  { id: "lichess-cNrLW", fen: "4r3/4N1pk/8/p4p2/Pp4b1/8/1P3R2/6K1 w - - 4 37"        , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess cNrLW · r824 · pop92
  { id: "lichess-DkF6R", fen: "7k/5q1p/p2R4/5P2/4p3/8/1b4RP/7K w - - 0 39"           , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess DkF6R · r784 · pop98
  { id: "lichess-dZGkB", fen: "4Q3/p5pk/7p/3q4/8/P4r1P/1P5K/6R1 w - - 9 45"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess dZGkB · r939 · pop100
  { id: "lichess-efo3O", fen: "8/2k2pp1/p1P1p2p/8/qP1Q3P/6P1/7K/8 w - - 3 64"        , sideToMove: "w", mateIn: 2, theme: "Epaulette Mate"        , level: 4 }, // lichess efo3O · r965 · pop100
  { id: "lichess-GPZCI", fen: "1k5r/1p5p/1N6/4p3/8/2RPP3/Pr6/4K3 w - - 0 28"         , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess GPZCI · r1088 · pop92
  { id: "lichess-gzled", fen: "8/6p1/1k6/2b5/2Q4p/3Q3P/q4PP1/5NK1 b - - 4 49"        , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess gzled · r1108 · pop98
  { id: "lichess-h8jcF", fen: "4K1k1/r2P2p1/2n4p/8/3N1P2/3R4/1P5P/8 b - - 10 44"     , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess h8jcF · r1115 · pop100
  { id: "lichess-hFkKs", fen: "8/8/1p4q1/p7/6P1/P6k/1PPBQb2/7K b - - 0 44"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess hFkKs · r1141 · pop100
  { id: "lichess-hiewK", fen: "8/4kpr1/1n1R4/4P3/1P6/Pq4Pp/5Q1P/6K1 w - - 4 40"      , sideToMove: "w", mateIn: 2, theme: "Kill Box Mate"         , level: 4 }, // lichess hiewK · r1126 · pop94
  { id: "lichess-i8uTQ", fen: "5rk1/pp3pp1/8/3NPR2/3rn3/8/6KP/8 w - - 1 36"          , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess i8uTQ · r883 · pop98
  { id: "lichess-IBi6U", fen: "8/6RR/8/p1Nnk3/6P1/r7/5PKP/8 b - - 2 45"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess IBi6U · r918 · pop100
  { id: "lichess-iPbAV", fen: "8/2R3pk/8/6PK/8/p7/1b6/r7 w - - 1 49"                 , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess iPbAV · r942 · pop100
  { id: "lichess-j08P9", fen: "8/R7/2P5/1P6/5ppk/8/2r2PKP/8 b - - 0 42"              , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess j08P9 · r892 · pop100
  { id: "lichess-Jzrge", fen: "1Q6/6pk/3P3p/8/4n2K/2P3PP/P4r2/8 b - - 0 39"          , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess Jzrge · r1111 · pop98
  { id: "lichess-kyCWt", fen: "8/p4pk1/2n1p1P1/8/5P1Q/8/7K/3q4 w - - 2 35"           , sideToMove: "w", mateIn: 2, theme: "Epaulette Mate"        , level: 4 }, // lichess kyCWt · r927 · pop100
  { id: "lichess-lAkFk", fen: "6k1/5p1p/4q1p1/p7/3Bb3/3pP3/1R1K2PP/8 w - - 3 33"     , sideToMove: "w", mateIn: 2, theme: "Pillsburys Mate"       , level: 4 }, // lichess lAkFk · r538 · pop100
  { id: "lichess-lpDZl", fen: "5rk1/p4pp1/8/5Np1/1p6/2r3P1/5PK1/5R2 w - - 0 30"      , sideToMove: "w", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess lpDZl · r940 · pop100
  { id: "lichess-MuQKR", fen: "6k1/6pp/4Pp2/8/1pBr4/1P3P2/6PP/6K1 w - - 0 35"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess MuQKR · r879 · pop96
  { id: "lichess-MZZYn", fen: "6r1/6rk/R7/4p1p1/4Pn2/PPp5/2P5/1K4R1 w - - 0 44"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess MZZYn · r832 · pop100
  { id: "lichess-Nn9Tm", fen: "r4r2/P2k4/1R1p4/3Np3/3nP3/6P1/6P1/R5K1 b - - 6 35"    , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess Nn9Tm · r858 · pop100
  { id: "lichess-npzVH", fen: "8/pQ2R1bk/2p2q1p/3p4/8/8/7P/5rRK w - - 4 37"          , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess npzVH · r1173 · pop100
  { id: "lichess-nUDzp", fen: "3r3k/R7/1p3R2/6P1/5P2/Pr6/6K1/8 b - - 6 66"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess nUDzp · r912 · pop99
  { id: "lichess-O8ybH", fen: "1R2r1rk/P7/1R6/4n3/1P6/5P2/5KPP/8 b - - 4 44"         , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess O8ybH · r868 · pop97
  { id: "lichess-oHhnM", fen: "6k1/4q2p/4pPpP/4P1N1/6P1/6K1/2p5/8 w - - 0 47"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess oHhnM · r1133 · pop99
  { id: "lichess-OIWWb", fen: "8/p5k1/8/P1pp4/3n1r1P/8/6P1/R2R2K1 b - - 0 34"        , sideToMove: "b", mateIn: 2, theme: "Anastasia's Mate"      , level: 4 }, // lichess OIWWb · r925 · pop90
  { id: "lichess-oXhuc", fen: "8/5p1k/p7/1p6/4N1RP/6N1/Pr4r1/3K4 w - - 2 40"         , sideToMove: "w", mateIn: 2, theme: "Arabian Mate"          , level: 4 }, // lichess oXhuc · r886 · pop96
  { id: "lichess-P6T3q", fen: "8/R7/4k3/1Pp1pNb1/2P1P1P1/6K1/6P1/5r2 b - - 1 44"     , sideToMove: "b", mateIn: 2, theme: "Pillsburys Mate"       , level: 4 }, // lichess P6T3q · r885 · pop98
  { id: "lichess-q7vwA", fen: "1R3R2/6k1/7p/6p1/4p3/6PP/5P2/2r1nK2 b - - 4 40"       , sideToMove: "b", mateIn: 2, theme: "Hook Mate"             , level: 4 }, // lichess q7vwA · r1146 · pop91
  { id: "lichess-QU7ZY", fen: "8/5q1k/6pp/2p1Q3/p1P5/7P/1r3PP1/4R1K1 b - - 3 44"     , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess QU7ZY · r864 · pop100
  { id: "lichess-R2M4G", fen: "7R/6p1/3Bp1k1/3b1p2/5K1P/4P3/8/6r1 w - - 15 44"       , sideToMove: "w", mateIn: 2, theme: "Opera Mate"            , level: 4 }, // lichess R2M4G · r1051 · pop94
  { id: "lichess-roeBq", fen: "8/8/P6P/2R5/2P3pk/8/4r1PK/8 b - - 0 46"               , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess roeBq · r922 · pop100
  { id: "lichess-UBjQW", fen: "5bk1/p6p/1pQ2B2/5qp1/8/6P1/P4P1P/6K1 w - - 1 30"      , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess UBjQW · r1165 · pop100
  { id: "lichess-UnTcD", fen: "3r4/8/p1r5/3pp1k1/R5p1/1P4K1/P4R2/8 w - - 0 56"       , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess UnTcD · r1140 · pop100
  { id: "lichess-vfEAy", fen: "1k6/p2PP3/1p1r3p/8/4K3/P7/8/6q1 w - - 0 41"           , sideToMove: "w", mateIn: 2, theme: "Dovetail Mate"         , level: 4 }, // lichess vfEAy · r1307 · pop96
  { id: "lichess-vjYWH", fen: "8/1p6/p1bR4/5pk1/r3p3/3B2PP/2P4K/8 w - - 0 37"        , sideToMove: "w", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess vjYWH · r1087 · pop100
  { id: "lichess-vnZ2i", fen: "6k1/7p/p2p2pQ/4q3/r7/2r2B2/6P1/5R1K w - - 4 38"       , sideToMove: "w", mateIn: 2, theme: "Kill Box Mate"         , level: 4 }, // lichess vnZ2i · r960 · pop100
  { id: "lichess-ztGyT", fen: "8/4q1k1/6pp/8/6Q1/3R2PP/r4P1K/8 b - - 4 39"           , sideToMove: "b", mateIn: 2, theme: "Checkmate in 2"        , level: 4 }, // lichess ztGyT · r962 · pop98
  { id: "lichess-09IbS", fen: "8/8/R2R3p/7k/6p1/2r4P/6PK/8 b - - 1 34"               , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 09IbS · r1237 · pop100
  { id: "lichess-0HTZO", fen: "8/8/8/PR6/6pk/8/r5PK/8 b - - 5 56"                    , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 0HTZO · r943 · pop100
  { id: "lichess-0jf4v", fen: "4R3/8/R3pk2/5np1/7p/5r2/7P/7K b - - 1 41"             , sideToMove: "b", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess 0jf4v · r1232 · pop95
  { id: "lichess-0LOLz", fen: "8/R7/8/2R2b2/4rk2/6p1/8/6K1 b - - 1 55"               , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 0LOLz · r1251 · pop100
  { id: "lichess-0mqJm", fen: "2Q5/p7/8/8/8/P5p1/1P3k1p/7K b - - 0 53"               , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 0mqJm · r1050 · pop98
  { id: "lichess-0wJlX", fen: "8/2k5/1n3R2/2Np4/8/6r1/PKP5/8 b - - 8 40"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 0wJlX · r877 · pop87
  { id: "lichess-2b4Lt", fen: "8/8/3p4/2bR4/6p1/2P4P/5k1K/8 b - - 0 51"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 2b4Lt · r1062 · pop94
  { id: "lichess-2Blwr", fen: "r7/PR4pk/2p5/6PK/8/8/8/q7 w - - 0 38"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 2Blwr · r1112 · pop89
  { id: "lichess-2iz2Q", fen: "k7/P1K5/1P2p3/3p4/5Pp1/6P1/8/4q3 w - - 0 61"          , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 2iz2Q · r1144 · pop97
  { id: "lichess-2Qhre", fen: "8/8/1R6/2r2k2/6N1/5PK1/r7/8 w - - 6 48"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 2Qhre · r1155 · pop96
  { id: "lichess-2rM2P", fen: "8/6pk/1R5p/6P1/2r5/6K1/8/8 w - - 2 51"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 2rM2P · r1224 · pop95
  { id: "lichess-37ezE", fen: "8/3P4/1R4p1/8/2b2bP1/7k/5P2/6K1 b - - 0 38"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 37ezE · r1192 · pop95
  { id: "lichess-3gmve", fen: "8/3k4/7R/4P1n1/8/6BP/1r4PK/8 b - - 0 43"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 3gmve · r864 · pop89
  { id: "lichess-3S883", fen: "8/R6p/2r4k/1p3K1P/6P1/8/p7/2n5 w - - 0 49"            , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 3S883 · r1120 · pop93
  { id: "lichess-4MRnX", fen: "8/p7/5k2/R7/6PK/1r6/6NP/6b1 b - - 2 43"               , sideToMove: "b", mateIn: 3, theme: "Opera Mate"            , level: 5 }, // lichess 4MRnX · r1137 · pop93
  { id: "lichess-4nTM3", fen: "8/1p4pk/p1bR4/8/8/6KN/r3p3/8 w - - 2 53"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 4nTM3 · r931 · pop100
  { id: "lichess-5wAjc", fen: "8/6pk/1R6/6p1/2r5/n4N2/5K2/8 w - - 0 46"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 5wAjc · r1005 · pop100
  { id: "lichess-6winl", fen: "8/8/2p4Q/8/2q3P1/1k6/2b2P1P/2R3K1 b - - 7 50"         , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 6winl · r1047 · pop100
  { id: "lichess-7cEVG", fen: "8/1r2b3/2R1Pk1K/6p1/8/5PN1/8/8 b - - 0 67"            , sideToMove: "b", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess 7cEVG · r884 · pop94
  { id: "lichess-7Cur4", fen: "4r1k1/Q4ppp/8/4q3/8/8/8/5RK1 w - - 2 38"              , sideToMove: "w", mateIn: 3, theme: "Back-Rank Mate"        , level: 5 }, // lichess 7Cur4 · r925 · pop89
  { id: "lichess-7iE6S", fen: "8/kp6/4R3/2P5/p1KN4/8/8/3r1n2 w - - 2 55"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 7iE6S · r913 · pop93
  { id: "lichess-7KdrM", fen: "8/PRP5/8/3p4/8/5p2/5kR1/7K b - - 0 54"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 7KdrM · r1208 · pop94
  { id: "lichess-7uef6", fen: "k7/2K5/1P4p1/5p1p/7P/8/6P1/4q3 w - - 0 50"            , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 7uef6 · r1007 · pop93
  { id: "lichess-7xgIR", fen: "8/1r4R1/7p/7k/5p2/5P2/1r6/2R3K1 w - - 0 45"           , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 7xgIR · r1183 · pop95
  { id: "lichess-7yzwX", fen: "3Q4/8/5p1p/5P1P/4P3/1p6/p1k5/K7 b - - 0 57"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 7yzwX · r1129 · pop96
  { id: "lichess-80se3", fen: "8/8/5N2/4R2p/5ppk/5P2/2r3PK/8 b - - 1 42"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 80se3 · r814 · pop96
  { id: "lichess-8GtkG", fen: "8/6kp/5n2/5P2/2R2KPP/4r3/8/5B2 b - - 8 65"            , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 8GtkG · r1357 · pop98
  { id: "lichess-8tvZ3", fen: "8/8/7p/R7/B5pk/2r5/6PK/8 b - - 0 38"                  , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 8tvZ3 · r1178 · pop94
  { id: "lichess-9d0wI", fen: "Q7/8/8/8/6pk/R2N4/3r2PK/8 b - - 0 42"                 , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess 9d0wI · r958 · pop97
  { id: "lichess-9wdHo", fen: "r4rk1/3K1Npp/4Q3/8/8/8/8/8 w - - 5 55"                , sideToMove: "w", mateIn: 3, theme: "Smothered Mate"        , level: 5 }, // lichess 9wdHo · r1272 · pop85
  { id: "lichess-a2dqo", fen: "8/5RP1/2r5/8/8/1k6/3BbP2/1K6 b - - 6 50"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess a2dqo · r1345 · pop100
  { id: "lichess-A8ngd", fen: "8/8/p4pk1/6p1/PP4K1/2R3P1/5r2/8 b - - 0 46"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess A8ngd · r1124 · pop93
  { id: "lichess-apDJC", fen: "k7/P1K5/PP6/4p1p1/6P1/8/8/3q4 w - - 0 57"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess apDJC · r1112 · pop98
  { id: "lichess-ApGA7", fen: "7k/5K2/1n4PP/8/8/P7/8/2q5 w - - 0 62"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess ApGA7 · r1101 · pop93
  { id: "lichess-aqOcc", fen: "4k3/R7/2p1p3/3nP3/2K5/5r2/8/6R1 b - - 3 30"           , sideToMove: "b", mateIn: 3, theme: "Hook Mate"             , level: 5 }, // lichess aqOcc · r1231 · pop96
  { id: "lichess-audeK", fen: "8/R4pkp/8/5PK1/8/8/8/1r6 w - - 2 42"                  , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess audeK · r976 · pop100
  { id: "lichess-avrb7", fen: "7k/5Kn1/4p1pP/1q6/8/p7/8/8 w - - 0 56"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess avrb7 · r1132 · pop86
  { id: "lichess-AXka1", fen: "3r3k/2R3R1/q6P/8/8/3r4/5P1K/8 w - - 9 64"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess AXka1 · r1093 · pop94
  { id: "lichess-AzQXm", fen: "k7/2K5/PP2p3/8/8/8/8/5q2 w - - 0 54"                  , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess AzQXm · r1195 · pop100
  { id: "lichess-AZxXs", fen: "8/3k1r2/3P4/2Q5/2Pn4/8/P5P1/6K1 b - - 0 43"           , sideToMove: "b", mateIn: 3, theme: "Anastasia's Mate"      , level: 5 }, // lichess AZxXs · r982 · pop93
  { id: "lichess-BbLo7", fen: "8/PR6/8/8/5ppk/2P2P2/r5PK/8 b - - 2 43"               , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess BbLo7 · r971 · pop93
  { id: "lichess-BddQR", fen: "6k1/6p1/8/5r2/4Q3/8/2q2PPP/4R1K1 b - - 5 37"          , sideToMove: "b", mateIn: 3, theme: "Back-Rank Mate"        , level: 5 }, // lichess BddQR · r1132 · pop100
  { id: "lichess-bEBUP", fen: "8/5k2/7R/8/3n4/6BP/2r3PK/8 b - - 6 38"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess bEBUP · r1155 · pop100
  { id: "lichess-BhFft", fen: "8/1r5p/7k/1r2Q1p1/8/7P/6PK/8 w - - 2 45"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess BhFft · r1290 · pop95
  { id: "lichess-bJvkA", fen: "2Q5/p7/8/8/PP1PP3/6p1/5k1p/7K b - - 0 64"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess bJvkA · r1061 · pop100
  { id: "lichess-bNhnW", fen: "2Q5/p7/2Pp4/P7/8/6p1/5k1p/7K b - - 0 50"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess bNhnW · r1125 · pop95
  { id: "lichess-BP2iK", fen: "4qk2/7K/5p2/4b3/8/4RQ2/5P2/8 b - - 9 56"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess BP2iK · r1381 · pop100
  { id: "lichess-bpzwy", fen: "8/8/1R6/1P6/8/3k2NP/1r1n2PK/8 b - - 2 52"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess bpzwy · r1234 · pop94
  { id: "lichess-bt5j8", fen: "8/8/1p6/8/1P1k4/P1r3r1/2R1RK2/8 b - - 1 54"           , sideToMove: "b", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess bt5j8 · r1330 · pop94
  { id: "lichess-buiUq", fen: "8/6pk/5p1p/5PP1/R6P/3r4/8/6K1 w - - 1 48"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess buiUq · r886 · pop99
  { id: "lichess-C7jTX", fen: "8/8/p7/5PRP/kp6/7r/KP6/8 b - - 0 58"                  , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess C7jTX · r1148 · pop96
  { id: "lichess-CffjS", fen: "8/PR6/6k1/8/6pp/7P/r5PK/8 b - - 3 42"                 , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess CffjS · r853 · pop91
  { id: "lichess-cjqAD", fen: "7k/2R3p1/3r4/2p2PPK/2r5/8/8/8 w - - 0 48"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess cjqAD · r984 · pop95
  { id: "lichess-cn3RB", fen: "5rk1/5pp1/8/3N4/p7/5r2/3K4/4R3 w - - 0 37"            , sideToMove: "w", mateIn: 3, theme: "Anastasia's Mate"      , level: 5 }, // lichess cn3RB · r1004 · pop93
  { id: "lichess-CSISm", fen: "2Q5/8/8/8/8/6p1/5k1p/7K b - - 0 47"                   , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess CSISm · r1103 · pop97
  { id: "lichess-cwJPw", fen: "3R4/1k6/8/6P1/P7/r2n4/5PKP/8 b - - 3 45"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess cwJPw · r1040 · pop97
  { id: "lichess-cyTcM", fen: "8/4R3/R5p1/1p2n1k1/1P6/3r4/6PK/8 b - - 8 40"          , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess cyTcM · r968 · pop94
  { id: "lichess-D1pqC", fen: "8/6pk/1R6/6PK/8/8/8/2r5 w - - 3 63"                   , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess D1pqC · r1137 · pop100
  { id: "lichess-D7qT7", fen: "8/8/4r3/6B1/1p5P/1Npk4/P7/3K4 b - - 9 59"             , sideToMove: "b", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess D7qT7 · r1322 · pop97
  { id: "lichess-DHULn", fen: "2r5/1R6/8/8/1P3p2/PK3nk1/3r4/7Q b - - 9 45"           , sideToMove: "b", mateIn: 3, theme: "Anastasia's Mate"      , level: 5 }, // lichess DHULn · r1074 · pop98
  { id: "lichess-Di995", fen: "3Q4/8/8/8/8/P5p1/5k1p/7K b - - 0 65"                  , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Di995 · r1085 · pop100
  { id: "lichess-DlCmM", fen: "8/8/8/7p/4RNpk/P6P/3r2PK/8 b - - 1 48"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess DlCmM · r959 · pop96
  { id: "lichess-duz9n", fen: "8/7p/8/3Nk3/6P1/1r6/3R1nPK/8 b - - 2 37"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess duz9n · r1181 · pop92
  { id: "lichess-Dv1rk", fen: "8/8/5pk1/6p1/6K1/1R2P1P1/5r2/8 b - - 0 54"            , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Dv1rk · r1057 · pop93
  { id: "lichess-Dyszy", fen: "8/4K1pk/1R6/1R6/8/8/rp6/2r5 w - - 6 59"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Dyszy · r891 · pop96
  { id: "lichess-ECAnZ", fen: "8/6pk/7p/5q2/3Q2P1/2P4K/7P/8 b - - 0 50"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess ECAnZ · r1120 · pop98
  { id: "lichess-EoJjt", fen: "1Q6/6pp/5k2/6RK/3r4/P6P/8/8 b - - 0 68"               , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess EoJjt · r971 · pop97
  { id: "lichess-evmZJ", fen: "8/8/3R3p/2r3pk/5n2/7P/6PK/8 w - - 10 48"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess evmZJ · r977 · pop100
  { id: "lichess-eYCCS", fen: "8/3B4/2P5/7p/2r2ppk/3R4/6PK/8 b - - 1 58"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess eYCCS · r828 · pop96
  { id: "lichess-eyjvR", fen: "4r1k1/5ppp/8/8/4qQ2/6P1/5R1K/8 w - - 7 40"            , sideToMove: "w", mateIn: 3, theme: "Back-Rank Mate"        , level: 5 }, // lichess eyjvR · r1084 · pop90
  { id: "lichess-fEqLq", fen: "k1r5/7R/4p3/8/1Q2P3/1P6/2r5/1K6 b - - 3 48"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess fEqLq · r867 · pop87
  { id: "lichess-fH27A", fen: "5r2/3R4/8/8/P1Nnk3/6P1/6P1/6K1 b - - 9 45"            , sideToMove: "b", mateIn: 3, theme: "Anastasia's Mate"      , level: 5 }, // lichess fH27A · r912 · pop100
  { id: "lichess-fKO5Y", fen: "8/R5R1/5r1p/6Pk/8/6P1/5r2/6K1 b - - 0 35"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess fKO5Y · r927 · pop93
  { id: "lichess-fSSOH", fen: "6k1/5p2/3p1P2/8/B5K1/8/1R6/q7 w - - 0 53"             , sideToMove: "w", mateIn: 3, theme: "Pillsburys Mate"       , level: 5 }, // lichess fSSOH · r1038 · pop94
  { id: "lichess-Fv9TR", fen: "R7/6pk/5n2/5KPp/7r/7P/8/8 w - - 0 51"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Fv9TR · r1034 · pop100
  { id: "lichess-G1bAI", fen: "4r3/3k1p2/5P1R/2R5/8/1r6/7K/8 b - - 0 40"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess G1bAI · r1045 · pop97
  { id: "lichess-G4ldC", fen: "8/5p2/2R5/r4pkp/8/6P1/6KP/8 w - - 2 41"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess G4ldC · r1160 · pop97
  { id: "lichess-gHk8S", fen: "8/8/p1pQ4/8/1P3ppk/4q3/8/7K w - - 4 98"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess gHk8S · r869 · pop91
  { id: "lichess-GSy2M", fen: "3r4/1R6/7R/p7/2k3P1/r6P/7K/8 b - - 0 35"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess GSy2M · r991 · pop94
  { id: "lichess-gVsgH", fen: "8/5p1k/4p1p1/6K1/1BR3P1/5r2/8/8 b - - 4 53"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess gVsgH · r1190 · pop100
  { id: "lichess-hABVX", fen: "8/5pkp/1R6/4nPK1/8/2r4P/8/8 w - - 2 43"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess hABVX · r1119 · pop98
  { id: "lichess-hhSiV", fen: "2Q5/p7/1p6/8/3P4/1P4p1/P4k1p/7K b - - 0 51"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess hhSiV · r985 · pop96
  { id: "lichess-hOzw0", fen: "4r2k/5RR1/4p1K1/r7/8/8/p1P5/8 w - - 2 38"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess hOzw0 · r1262 · pop100
  { id: "lichess-I0muB", fen: "Q7/1N6/8/8/8/6p1/5k1p/7K b - - 0 57"                  , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess I0muB · r1050 · pop100
  { id: "lichess-i7pao", fen: "8/6Bp/2kp4/3n4/8/r7/1R3PKP/8 b - - 3 33"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess i7pao · r1002 · pop95
  { id: "lichess-iAnJY", fen: "B7/8/4b3/R7/5kpp/8/1r3PP1/6K1 b - - 1 48"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess iAnJY · r936 · pop100
  { id: "lichess-iTuHZ", fen: "5k2/5N1P/6K1/4p3/8/3n4/8/1q6 w - - 0 57"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess iTuHZ · r1448 · pop99
  { id: "lichess-J128B", fen: "8/r3N2k/7P/6PK/8/8/8/8 w - - 13 57"                   , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess J128B · r1102 · pop100
  { id: "lichess-ja3cD", fen: "5Q2/8/8/8/8/1p6/p1k5/K7 b - - 0 60"                   , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess ja3cD · r1007 · pop88
  { id: "lichess-jgrSV", fen: "8/5K1k/6p1/5PP1/q7/8/1p6/8 w - - 0 50"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess jgrSV · r939 · pop94
  { id: "lichess-jOEOJ", fen: "8/5pkp/8/2R2PK1/6P1/3r4/8/8 w - - 3 44"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess jOEOJ · r820 · pop93
  { id: "lichess-jTjHR", fen: "Q7/8/8/1R6/2p5/2B1k3/1PP2p2/3K4 b - - 0 46"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess jTjHR · r987 · pop95
  { id: "lichess-jUEab", fen: "8/8/1k1pR2R/8/3r4/6rP/KPP5/8 b - - 2 50"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess jUEab · r794 · pop97
  { id: "lichess-KfqIP", fen: "7k/pp3K1P/6P1/8/8/8/P7/2nq4 w - - 0 45"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess KfqIP · r995 · pop97
  { id: "lichess-Kl3Tv", fen: "8/5R2/2p5/8/5npp/1PP5/P4k1K/8 b - - 1 50"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Kl3Tv · r1066 · pop100
  { id: "lichess-kROOk", fen: "7k/5K1P/4p1P1/8/8/8/8/4q3 w - - 0 71"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess kROOk · r982 · pop99
  { id: "lichess-Kwe1W", fen: "8/5R1p/6k1/6r1/8/5RP1/6K1/r7 w - - 1 40"              , sideToMove: "w", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess Kwe1W · r998 · pop91
  { id: "lichess-L6ahb", fen: "7k/1pp5/3P2KP/4N3/3P4/8/8/q7 w - - 0 40"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess L6ahb · r1341 · pop100
  { id: "lichess-Ll6FX", fen: "7k/4R1p1/8/4n3/1P1N4/2r5/6PK/8 b - - 6 38"            , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Ll6FX · r950 · pop100
  { id: "lichess-lM1Ju", fen: "8/8/p7/5r2/5nR1/2k5/6P1/R5K1 b - - 6 46"              , sideToMove: "b", mateIn: 3, theme: "Anastasia's Mate"      , level: 5 }, // lichess lM1Ju · r886 · pop97
  { id: "lichess-LwKbz", fen: "8/8/1N1P4/5Q2/8/5pp1/1P3k2/7K b - - 7 58"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess LwKbz · r1176 · pop93
  { id: "lichess-LyPOq", fen: "3Q4/8/6p1/8/4P2P/1p6/p1k5/K7 b - - 0 60"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess LyPOq · r1123 · pop95
  { id: "lichess-mhCOY", fen: "7k/5K2/p5P1/3p4/3P4/8/8/q7 w - - 0 47"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess mhCOY · r945 · pop95
  { id: "lichess-mHF8C", fen: "5r1k/6pp/5q2/8/1Q6/8/6PP/2R3K1 b - - 2 46"            , sideToMove: "b", mateIn: 3, theme: "Back-Rank Mate"        , level: 5 }, // lichess mHF8C · r1106 · pop100
  { id: "lichess-mnUVZ", fen: "8/5p1k/Q3p1p1/3p2K1/6P1/p4r2/8/8 b - - 3 55"          , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess mnUVZ · r1184 · pop96
  { id: "lichess-MpcVM", fen: "5R2/6k1/r5r1/5R2/8/p4K2/7P/8 w - - 0 67"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess MpcVM · r1177 · pop93
  { id: "lichess-MR7hu", fen: "8/Q7/5P2/p3p3/8/P2n1k1K/2r5/8 b - - 8 51"             , sideToMove: "b", mateIn: 3, theme: "Hook Mate"             , level: 5 }, // lichess MR7hu · r1374 · pop94
  { id: "lichess-muB0w", fen: "8/4Q2p/5ppk/8/5q1P/5P1K/6P1/8 w - - 4 37"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess muB0w · r1170 · pop100
  { id: "lichess-n0sOf", fen: "3r3k/8/5KB1/8/8/6R1/1r4p1/8 w - - 4 61"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess n0sOf · r1348 · pop98
  { id: "lichess-N3rOc", fen: "8/1R4pk/5p1p/6PP/7K/8/8/3r4 w - - 1 59"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess N3rOc · r1079 · pop100
  { id: "lichess-N61VX", fen: "8/8/8/2R5/ppn5/8/K1k5/8 b - - 1 88"                   , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess N61VX · r909 · pop99
  { id: "lichess-Nc2F2", fen: "1R6/8/8/8/6pk/8/r5PK/8 b - - 7 47"                    , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Nc2F2 · r895 · pop94
  { id: "lichess-NmRHz", fen: "4k3/2R4p/8/6B1/5p2/7P/r4bPK/8 b - - 1 44"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess NmRHz · r1007 · pop100
  { id: "lichess-NRldf", fen: "1r4BQ/8/8/8/5pp1/5k2/8/6K1 b - - 0 57"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess NRldf · r1115 · pop94
  { id: "lichess-nxeG9", fen: "7k/5P1b/2K1N3/4P3/8/7q/8/6q1 w - - 0 62"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess nxeG9 · r1351 · pop93
  { id: "lichess-o1tEh", fen: "4Q3/8/7p/5p1P/5P2/1p6/p1k5/K7 b - - 0 55"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess o1tEh · r1059 · pop100
  { id: "lichess-O5aOP", fen: "8/P5R1/8/1k6/r7/6Pp/4rR1P/6K1 b - - 2 49"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess O5aOP · r1345 · pop100
  { id: "lichess-oer7b", fen: "8/2R5/1p5p/1k6/1P6/1KP5/8/7r w - - 9 44"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess oer7b · r1150 · pop93
  { id: "lichess-OHUhK", fen: "8/8/2R1B3/r5k1/5pp1/6P1/5PKP/8 b - - 1 34"            , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess OHUhK · r940 · pop100
  { id: "lichess-OI8jZ", fen: "8/6pk/2R4p/5N2/6PK/r6P/8/8 b - - 4 54"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess OI8jZ · r953 · pop94
  { id: "lichess-OJdJS", fen: "8/8/5p1k/6p1/6K1/6P1/5r2/4Q3 b - - 12 59"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess OJdJS · r1227 · pop98
  { id: "lichess-OVk4Y", fen: "8/6pk/R6p/6P1/pr5P/6K1/8/3b4 w - - 1 40"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess OVk4Y · r1272 · pop100
  { id: "lichess-OYJvw", fen: "8/R7/1B6/5r2/P3k3/8/1P4PP/2n3K1 b - - 0 41"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess OYJvw · r907 · pop98
  { id: "lichess-P1vhP", fen: "8/7R/4rkp1/8/5PP1/5K2/8/4b3 w - - 1 53"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess P1vhP · r971 · pop100
  { id: "lichess-p2dmS", fen: "8/5K1k/1p5p/2b3P1/p7/8/8/8 w - - 0 47"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess p2dmS · r921 · pop95
  { id: "lichess-P5PrX", fen: "8/2R5/8/6kp/2P3p1/6K1/6P1/5r2 b - - 0 42"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess P5PrX · r1130 · pop100
  { id: "lichess-p7H6B", fen: "8/5kp1/1R5p/4pN2/6PK/r6P/8/8 b - - 5 41"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess p7H6B · r1241 · pop94
  { id: "lichess-PlRrc", fen: "8/7R/1pk5/1n6/8/PN6/KP4r1/8 b - - 4 63"               , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess PlRrc · r1001 · pop94
  { id: "lichess-plvyS", fen: "R7/7k/4rp2/5N1K/4P1P1/5P2/2r5/8 b - - 1 37"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess plvyS · r1159 · pop96
  { id: "lichess-pNiQd", fen: "8/5k2/2R5/2pK1P2/1r5p/1P3R2/2r5/8 b - - 2 47"         , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess pNiQd · r1281 · pop97
  { id: "lichess-pYx3W", fen: "8/4R2p/r6k/5K2/6P1/1p5P/p7/8 w - - 0 50"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess pYx3W · r1333 · pop96
  { id: "lichess-PZOs9", fen: "5Q2/8/7p/8/4P3/1p4N1/p1k5/K7 b - - 0 47"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess PZOs9 · r1067 · pop100
  { id: "lichess-QaDE2", fen: "8/4P3/2b3p1/6P1/2B5/kp6/8/K7 b - - 0 55"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess QaDE2 · r963 · pop90
  { id: "lichess-qBTRn", fen: "r7/6k1/6p1/4R3/4PPR1/6K1/r7/8 b - - 6 55"             , sideToMove: "b", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess qBTRn · r1163 · pop95
  { id: "lichess-qNr75", fen: "5r2/1k6/8/4p3/R7/6K1/5r2/2R5 w - - 0 63"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess qNr75 · r1198 · pop94
  { id: "lichess-QNvU2", fen: "8/2k5/8/6B1/7P/3rn3/2p3PK/R7 b - - 5 56"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess QNvU2 · r1193 · pop92
  { id: "lichess-QOdLy", fen: "8/8/r3pN2/4R2p/6pk/8/6PK/8 b - - 1 50"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess QOdLy · r947 · pop100
  { id: "lichess-qqlbA", fen: "8/8/2R5/6pk/5n1P/4rP2/6PK/8 w - - 0 45"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess qqlbA · r1072 · pop100
  { id: "lichess-Qrd02", fen: "8/5K1k/2p4p/6P1/8/3r4/1p5P/8 w - - 0 46"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Qrd02 · r762 · pop97
  { id: "lichess-QSQLu", fen: "7Q/8/8/4P3/8/1p2P3/p1k5/K7 b - - 0 60"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess QSQLu · r1116 · pop96
  { id: "lichess-qwNA5", fen: "8/6pk/R7/1p4PK/p7/8/8/4r3 w - - 7 46"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess qwNA5 · r1151 · pop96
  { id: "lichess-QyzNY", fen: "4N3/7p/6p1/6k1/p5P1/6K1/5P2/r7 w - - 0 49"            , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess QyzNY · r1004 · pop91
  { id: "lichess-Ra2C1", fen: "2r5/PR6/8/8/8/3pk1P1/3R2P1/4K3 b - - 0 44"            , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Ra2C1 · r1119 · pop89
  { id: "lichess-RcJYL", fen: "5k2/5r2/8/2P1R3/7r/8/8/3R2K1 b - - 0 49"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess RcJYL · r1179 · pop100
  { id: "lichess-rKGwN", fen: "8/k1K5/p7/PPP5/8/r7/8/8 w - - 0 53"                   , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess rKGwN · r1083 · pop100
  { id: "lichess-rnLT5", fen: "7k/5K1P/6P1/p1p5/P7/1P6/8/3q4 w - - 0 55"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess rnLT5 · r1090 · pop93
  { id: "lichess-rpRtr", fen: "2Q5/p7/8/8/P7/6p1/5k1p/7K b - - 0 62"                 , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess rpRtr · r977 · pop91
  { id: "lichess-Rqeoa", fen: "8/8/rR5p/2P5/6pk/8/6PK/8 b - - 3 46"                  , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Rqeoa · r1109 · pop92
  { id: "lichess-RRBqG", fen: "8/1P6/2RR4/4p3/8/2P2k2/4rP2/5K1b b - - 2 45"          , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess RRBqG · r1380 · pop100
  { id: "lichess-Rrm9E", fen: "6k1/5R2/4p1p1/3pP1r1/2r5/8/5R2/5K2 w - - 3 43"        , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Rrm9E · r1205 · pop99
  { id: "lichess-rY8jn", fen: "7k/5K1P/6P1/2p1p3/4P3/8/8/2q5 w - - 0 47"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess rY8jn · r1107 · pop100
  { id: "lichess-S2gmP", fen: "1b6/6pk/7p/5KPP/3r4/8/P1R5/8 w - - 3 44"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess S2gmP · r981 · pop97
  { id: "lichess-s82G4", fen: "8/k1K5/P7/1PN5/2P4p/8/5q2/8 w - - 0 56"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess s82G4 · r966 · pop96
  { id: "lichess-SA3eo", fen: "8/8/1R2R3/p4pk1/4p3/5rP1/6r1/1K6 w - - 1 42"          , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess SA3eo · r1256 · pop100
  { id: "lichess-Sa8aJ", fen: "8/p1R3pk/8/5PPK/3b4/8/4r3/8 w - - 5 44"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Sa8aJ · r1123 · pop100
  { id: "lichess-sIRO2", fen: "4r2k/4r1p1/3Q2P1/5K2/8/8/8/8 w - - 1 42"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess sIRO2 · r1141 · pop95
  { id: "lichess-SmBL6", fen: "5Q2/8/8/8/8/1p2P3/p1k5/K7 b - - 0 61"                 , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess SmBL6 · r1151 · pop93
  { id: "lichess-sqBRb", fen: "5k2/2R5/8/4nN2/p6P/r7/5PPK/8 b - - 0 41"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess sqBRb · r1024 · pop100
  { id: "lichess-TcM9e", fen: "8/P7/2B5/2p5/2P2p2/r5kp/5R2/6K1 b - - 2 64"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess TcM9e · r1091 · pop90
  { id: "lichess-tlMoc", fen: "8/R5pk/8/6Kp/4N3/Pb5r/2p5/8 w - - 0 43"               , sideToMove: "w", mateIn: 3, theme: "Arabian Mate"          , level: 5 }, // lichess tlMoc · r1113 · pop94
  { id: "lichess-TNcmj", fen: "8/8/8/1K6/5Q2/5pBk/2n5/3q4 w - - 4 62"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess TNcmj · r1111 · pop100
  { id: "lichess-trKgc", fen: "7k/3R1K2/8/6P1/7P/8/8/2q5 w - - 0 59"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess trKgc · r1087 · pop100
  { id: "lichess-Tuzwy", fen: "8/4r1pk/1R2N3/p6n/8/r7/3K4/8 w - - 4 44"              , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Tuzwy · r1263 · pop100
  { id: "lichess-TW6Ia", fen: "7k/5R2/4NK2/4PP2/8/8/8/1q5r w - - 0 60"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess TW6Ia · r1058 · pop100
  { id: "lichess-U1hlX", fen: "8/6p1/2R2npk/6N1/7P/1r6/6PK/8 b - - 6 41"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess U1hlX · r826 · pop93
  { id: "lichess-UgKOP", fen: "6k1/6p1/8/R4P1B/7P/p6r/1b3K2/8 w - - 2 39"            , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess UgKOP · r921 · pop100
  { id: "lichess-VBYSX", fen: "k7/P1K5/1P6/6p1/6P1/8/8/5q2 w - - 0 66"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess VBYSX · r963 · pop99
  { id: "lichess-VfV14", fen: "5Q2/8/8/6p1/6P1/pp6/2k5/K7 b - - 0 61"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess VfV14 · r1112 · pop100
  { id: "lichess-WiCel", fen: "5r2/8/6R1/R5p1/6k1/8/2r3P1/6K1 b - - 24 60"           , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess WiCel · r1122 · pop99
  { id: "lichess-wKTcG", fen: "4r1k1/6b1/7R/p5N1/5P1Q/8/1q6/5K2 w - - 1 45"          , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess wKTcG · r1260 · pop94
  { id: "lichess-wNCEG", fen: "1Q6/5pk1/4p3/7p/7N/3q2PK/7P/8 b - - 10 57"            , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess wNCEG · r1083 · pop95
  { id: "lichess-x73fD", fen: "8/P1R5/5k1n/8/5N2/r7/6PK/8 b - - 2 52"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess x73fD · r775 · pop94
  { id: "lichess-xaZuO", fen: "8/r6p/2R5/6pk/5n2/5P1P/5KP1/8 w - - 5 42"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess xaZuO · r867 · pop98
  { id: "lichess-XD87m", fen: "2Q5/8/8/8/P1P5/6p1/5k1p/7K b - - 0 58"                , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess XD87m · r1062 · pop98
  { id: "lichess-XY1B9", fen: "8/1R6/pp2k3/8/8/3n3r/KP1R4/8 b - - 2 46"              , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess XY1B9 · r1100 · pop93
  { id: "lichess-y6WTZ", fen: "8/2R4p/6p1/7k/6pP/5P1K/r7/8 w - - 0 39"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess y6WTZ · r978 · pop95
  { id: "lichess-y9VP8", fen: "2Q5/8/8/8/8/1P4p1/P4k2/7K b - - 0 51"                 , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess y9VP8 · r1020 · pop90
  { id: "lichess-Yh1mA", fen: "8/5R2/6k1/6r1/4KR2/6r1/8/8 w - - 1 44"                , sideToMove: "w", mateIn: 3, theme: "Epaulette Mate"        , level: 5 }, // lichess Yh1mA · r1332 · pop94
  { id: "lichess-yq6Ra", fen: "k7/P1K5/1P4p1/4p1P1/8/8/8/3q4 w - - 0 54"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess yq6Ra · r1076 · pop97
  { id: "lichess-zSMy5", fen: "7k/5K1P/6P1/8/p7/8/P7/2q5 w - - 0 60"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess zSMy5 · r990 · pop98
  { id: "lichess-zvotQ", fen: "k7/2K5/1P6/5p1p/8/8/7P/5q2 w - - 0 44"                , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess zvotQ · r967 · pop89
  { id: "lichess-Zyuev", fen: "8/8/8/8/1ppR4/P7/K1k5/8 b - - 0 58"                   , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 5 }, // lichess Zyuev · r986 · pop90
  { id: "lichess-1NmoC", fen: "2k5/2P5/2K3p1/8/1P1p4/8/8/8 w - - 0 57"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess 1NmoC · r787 · pop95
  { id: "lichess-5nrLl", fen: "3k4/3P3p/2K5/2P5/8/p7/8/8 w - - 1 46"                 , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess 5nrLl · r1092 · pop100
  { id: "lichess-9OAoI", fen: "8/2P5/8/8/5p2/3pk2p/P3N2P/5K2 b - - 0 56"             , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess 9OAoI · r1111 · pop96
  { id: "lichess-EHPqe", fen: "5rk1/5pp1/2N5/8/4n1q1/8/5R2/1B3K2 w - - 6 47"         , sideToMove: "w", mateIn: 3, theme: "Anastasia's Mate"      , level: 6 }, // lichess EHPqe · r1008 · pop94
  { id: "lichess-iYtIh", fen: "3k4/3P4/3K2p1/8/4P3/2p5/8/8 w - - 0 60"               , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess iYtIh · r615 · pop100
  { id: "lichess-RRLe5", fen: "8/8/2k5/7R/6R1/2p3p1/r4b2/3K4 w - - 0 52"             , sideToMove: "w", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess RRLe5 · r1297 · pop100
  { id: "lichess-S8SFh", fen: "6N1/8/8/8/2p5/2k5/1p6/1K6 b - - 1 49"                 , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess S8SFh · r1145 · pop100
  { id: "lichess-wRUsa", fen: "Q7/8/5kpK/7p/7P/8/2p5/8 b - - 0 49"                   , sideToMove: "b", mateIn: 3, theme: "Checkmate in 3"        , level: 6 }, // lichess wRUsa · r1014 · pop94
];

export function getPuzzleById(id: string | null | undefined): ChessPuzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
