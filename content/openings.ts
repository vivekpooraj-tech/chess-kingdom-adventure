/**
 * Curated opening database. Every `moves` sequence here was played through
 * chess.js and verified to be legal and to produce exactly this SAN
 * sequence (not hand-typed and trusted) — see the verification script used
 * to build this list (and re-run for Phase 9B's additions). Curated and
 * checked, not exhaustive — see lib/openings/recognitionEngine.ts for how
 * an unrecognized line is handled (returns null, not a guess).
 */
export interface OpeningVariation {
  id: string;
  name: string;
  moves: string[];
}

export interface OpeningDef {
  id: string;
  name: string;
  alternativeName?: string;
  ecoCode: string;
  moves: string[];
  variations?: OpeningVariation[];
  isGambit: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  description: string;
  /** 3-5 concrete, accurate ideas — not padding. */
  keyIdeas: string[];
  commonPlans: { white: string; black: string };
  /** 1-2 real beginner mistakes, described plainly (not "bad move" judgments). */
  commonMistakes: string[];
  /** Every opening now has a real Academy detail page — id always equals `id`. */
  academyLessonId: string;
}

/** First move family, derived from the real move data rather than stored
 * separately (so it can never drift out of sync) — used for Explorer filters. */
export function getOpeningFamily(opening: OpeningDef): "e4" | "d4" | "c4" | "nf3" {
  const first = opening.moves[0];
  if (first === "e4") return "e4";
  if (first === "d4") return "d4";
  if (first === "c4") return "c4";
  return "nf3";
}

export const OPENINGS: OpeningDef[] = [
  // ======================= 1.e4 =======================
  {
    id: "italian",
    name: "Italian Game",
    ecoCode: "C50",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "One of the oldest recorded openings — White develops the bishop straight at the f7 square, aiming for quick, natural development.",
    keyIdeas: [
      "The bishop on c4 eyes the weak f7 square, the one square only the king defends at the start.",
      "Both sides develop knights before bishops — a natural, principled setup.",
      "Leads to open, tactical positions where quick development matters.",
    ],
    commonPlans: {
      white: "Castle quickly, then look for ways to open the center or attack f7 before Black finishes developing.",
      black: "Mirror White's development (...Bc5 or ...Nf6) and castle to safety before the position opens up.",
    },
    commonMistakes: [
      "Moving the same piece twice in the opening instead of bringing new pieces out.",
      "Chasing the bishop on c4 with ...b5 or similar pawn moves too early, weakening the king's side.",
    ],
    academyLessonId: "italian",
  },
  {
    id: "evans-gambit",
    name: "Evans Gambit",
    ecoCode: "C51",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "A sharp branch of the Italian Game — White offers a pawn to open lines and grab the center fast, favoring attacking play over material.",
    keyIdeas: [
      "White gives up a pawn (b4) to gain time by attacking the bishop on c5.",
      "The point is a faster center (c3 and d4 next) and open lines for the attack, not the pawn itself.",
      "Very sharp and tactical — small mistakes by either side can be decisive.",
    ],
    commonPlans: {
      white: "Follow up with c3 and d4 to build a big center, then attack before Black's king reaches safety.",
      black: "Return the pawn at the right moment to finish development safely rather than clinging to material.",
    },
    commonMistakes: [
      "Black grabbing extra pawns instead of finishing development — falling further behind while under attack.",
      "White playing the gambit without following up energetically, ending up just a pawn down for nothing.",
    ],
    academyLessonId: "evans-gambit",
  },
  {
    id: "ruy-lopez",
    name: "Ruy Lopez",
    alternativeName: "Spanish Opening",
    ecoCode: "C60",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "Named after a 16th-century Spanish priest who studied it — pressures the knight defending e5 and is still one of the most respected openings at every level.",
    keyIdeas: [
      "The bishop on b5 pins the knight on c6, which is the only defender of Black's e5 pawn.",
      "White usually doesn't win the pawn immediately — the pressure is long-term, not a quick trick.",
      "Leads to rich, strategic middlegames rather than immediate tactics.",
    ],
    commonPlans: {
      white: "Castle, support the center with c3 and d4, and keep long-term pressure on Black's position.",
      black: "Play ...a6 to ask the bishop a question, then develop solidly and contest the center.",
    },
    commonMistakes: [
      "Black playing ...f6 to defend e5, which badly weakens the king and blocks the knight on g8.",
      "White trading the bishop for the knight too early without a clear follow-up plan.",
    ],
    academyLessonId: "ruy-lopez",
  },
  {
    id: "scotch",
    name: "Scotch Game",
    ecoCode: "C44",
    moves: ["e4", "e5", "Nf3", "Nc6", "d4"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "White strikes the center immediately with d4, trading a central pawn for faster piece activity and open lines.",
    keyIdeas: [
      "White opens the center right away instead of building up slowly.",
      "Leads to open positions where piece activity matters more than pawn structure.",
      "Simple and direct — a good practical choice for players who like clear plans.",
    ],
    commonPlans: {
      white: "Use the extra central space and active pieces to create quick threats before Black regroups.",
      black: "Trade down to a comfortable position or strike back in the center with ...d5 when possible.",
    },
    commonMistakes: [
      "Developing pieces without a plan once the center opens, letting the opponent seize the initiative.",
    ],
    academyLessonId: "scotch",
  },
  {
    id: "kings-gambit",
    name: "King's Gambit",
    ecoCode: "C30",
    moves: ["e4", "e5", "f4"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "One of the oldest gambits in chess — White sacrifices the f-pawn to lure Black's e-pawn away and build a big center, in exchange for sharp, attacking chances.",
    keyIdeas: [
      "White trades a wing pawn (f4) for faster development and an open f-file to attack along.",
      "Extremely sharp — both sides need to know concrete lines, not just general principles.",
      "Was hugely popular historically; modern top-level players use it more rarely but it's fully sound.",
    ],
    commonPlans: {
      white: "Open the f-file, develop quickly, and aim threats at Black's king before it reaches safety.",
      black: "Return the extra pawn at a good moment to finish development and neutralize the attack.",
    },
    commonMistakes: [
      "White pushing the attack without finishing development first, running out of firepower.",
      "Black holding onto every extra pawn while falling dangerously behind in development.",
    ],
    academyLessonId: "kings-gambit",
  },
  {
    id: "vienna",
    name: "Vienna Game",
    ecoCode: "C25",
    moves: ["e4", "e5", "Nc3"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "A flexible alternative to 1...Nf3 — White develops the queenside knight first, keeping options open for a later f4 attack or a quieter setup.",
    keyIdeas: [
      "Keeps the f-pawn free to potentially play f4 later, similar in spirit to the King's Gambit.",
      "Flexible move order — can transpose into several other e4 openings.",
      "Less theoretical than the Italian or Ruy Lopez, good for players who like fewer memorized lines.",
    ],
    commonPlans: {
      white: "Develop naturally and decide between a kingside pawn storm (f4) or calm piece play based on Black's setup.",
      black: "Develop solidly and be ready to meet an eventual f4 push with a solid central structure.",
    },
    commonMistakes: [
      "Assuming this always leads to a King's Gambit-style attack — it's just as often a quiet positional game.",
    ],
    academyLessonId: "vienna",
  },
  {
    id: "four-knights",
    name: "Four Knights Game",
    ecoCode: "C46",
    moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "Both sides develop their knights before anything else — one of the most symmetrical, principled openings in chess.",
    keyIdeas: [
      "Textbook development — knights before bishops, nothing wasted.",
      "Very symmetrical, so small differences in follow-up moves matter a lot.",
      "A great opening for learning solid opening principles without memorizing sharp lines.",
    ],
    commonPlans: {
      white: "Continue developing (Bb5 or Bc4) and look for a small, lasting edge from being a tempo ahead.",
      black: "Match White's development and stay alert for the moment to break symmetry favorably.",
    },
    commonMistakes: [
      "Breaking symmetry too early with an unnecessary pawn move instead of continuing development.",
    ],
    academyLessonId: "four-knights",
  },
  {
    id: "sicilian",
    name: "Sicilian Defense",
    ecoCode: "B20",
    moves: ["e4", "c5"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "Statistically Black's best-scoring reply to 1.e4 — fights for the center asymmetrically instead of mirroring White's pawn.",
    keyIdeas: [
      "Black avoids mirroring White's center pawn, aiming for unbalanced, fighting positions.",
      "Very sharp and deeply studied at the top level — dozens of distinct variations branch off from here.",
      "Both sides usually castle on opposite sides in many lines, leading to attacking races.",
    ],
    commonPlans: {
      white: "Often plays d4 next to open the center, then develops actively against Black's kingside.",
      black: "Strikes back in the center later (often with ...d5) and counterattacks on the queenside.",
    },
    commonMistakes: [
      "Black playing too passively — the Sicilian is a fighting defense and needs active follow-up, not just ...c5 and nothing else.",
    ],
    academyLessonId: "sicilian",
  },
  {
    id: "smith-morra",
    name: "Smith-Morra Gambit",
    ecoCode: "B21",
    moves: ["e4", "c5", "d4", "cxd4", "c3"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "A gambit against the Sicilian — White gives up a pawn for a big lead in development and open lines toward Black's king.",
    keyIdeas: [
      "White accepts giving up the c-pawn's structure to open the c-file and get pieces out fast.",
      "A popular surprise weapon against players who aren't prepared for it specifically.",
      "Requires accurate follow-up — the compensation is real but not automatic.",
    ],
    commonPlans: {
      white: "Develop rapidly, use the open c-file, and create direct threats before Black consolidates.",
      black: "Return the pawn if needed to finish development safely rather than defending passively.",
    },
    commonMistakes: [
      "Black accepting the gambit pawn and then trying to hold onto every extra pawn instead of developing.",
    ],
    academyLessonId: "smith-morra",
  },
  {
    id: "french",
    name: "French Defense",
    ecoCode: "C00",
    moves: ["e4", "e6"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "A solid, resilient defense — Black prepares ...d5 to challenge the center, accepting a slightly cramped position for a very sturdy pawn structure.",
    keyIdeas: [
      "Black's light-squared bishop often gets stuck behind its own pawn chain — a known, well-studied trade-off.",
      "The resulting pawn structures are very solid and hard to attack directly.",
      "Leads to strategic, structure-based middlegames rather than early tactics.",
    ],
    commonPlans: {
      white: "Gain space with e5 (locking the center) and attack on the kingside where more space usually helps.",
      black: "Undermine White's center with ...c5 or ...f6 at the right moment, and free the problem bishop.",
    },
    commonMistakes: [
      "Black leaving the light-squared bishop stuck for the whole game instead of finding a way to activate or trade it.",
    ],
    academyLessonId: "french",
  },
  {
    id: "caro-kann",
    name: "Caro-Kann Defense",
    ecoCode: "B10",
    moves: ["e4", "c6"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "Similar in spirit to the French Defense, but Black's light-squared bishop gets out before the pawn chain locks it in — known for being extremely solid.",
    keyIdeas: [
      "Black prepares ...d5 like the French, but plans to develop the light-squared bishop BEFORE playing ...e6.",
      "Very solid and low-risk — a favorite of players who value safety over sharp complications.",
      "Leads to sound, if sometimes slightly passive, positions for Black.",
    ],
    commonPlans: {
      white: "Take space in the center and look for a long-term edge, since Black's setup is very hard to attack directly.",
      black: "Finish development soundly, trade pieces when favorable, and aim for a solid, equal middlegame.",
    },
    commonMistakes: [
      "Black playing ...e6 before getting the light-squared bishop out, falling into the same trap the Caro-Kann is designed to avoid.",
    ],
    academyLessonId: "caro-kann",
  },
  {
    id: "danish-gambit",
    name: "Danish Gambit",
    ecoCode: "C21",
    moves: ["e4", "e5", "d4", "exd4", "c3"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "White offers not one but two pawns to blast open the center and rocket pieces into the attack — high risk, high reward.",
    keyIdeas: [
      "White can offer a SECOND pawn (after ...dxc3) to get both bishops out on powerful diagonals fast.",
      "The attack has to work quickly — if it doesn't, White is simply down material with little to show for it.",
      "One of the sharpest gambits in serious over-the-board play.",
    ],
    commonPlans: {
      white: "Rush both bishops to active diagonals and create immediate threats before Black's king finds safety.",
      black: "Return material at the right moment to finish development and defuse the attack.",
    },
    commonMistakes: [
      "Black grabbing every offered pawn without developing — exactly what the gambit is hoping for.",
    ],
    academyLessonId: "danish-gambit",
  },
  {
    id: "pirc",
    name: "Pirc Defense",
    ecoCode: "B07",
    moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "Black lets White build a big center on purpose, planning to fianchetto the bishop and strike back at it later — the 1.e4 cousin of the King's Indian Defense.",
    keyIdeas: [
      "Black delays challenging the center directly, developing flexibly instead.",
      "The fianchettoed bishop on g7 aims straight down the long diagonal at White's center and queenside.",
      "A hypermodern approach — control the center with pieces, not pawns, at least at first.",
    ],
    commonPlans: {
      white: "Build a big pawn center (e4/d4, sometimes f4) and use the extra space to attack.",
      black: "Finish development, castle, then strike back at White's center with ...c5 or ...e5 at a good moment.",
    },
    commonMistakes: [
      "Black delaying the central counter-strike too long, letting White's space advantage become overwhelming.",
    ],
    academyLessonId: "pirc",
  },
  {
    id: "alekhine",
    name: "Alekhine Defense",
    ecoCode: "B02",
    moves: ["e4", "Nf6"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "A provocative reply — Black invites White's pawns forward, planning to attack the resulting overextended center later.",
    keyIdeas: [
      "Black immediately attacks e4 with a piece instead of a pawn, breaking the usual opening pattern.",
      "White often chases the knight with pawns (e5, c4, d4...), gaining space but also creating targets.",
      "A hypermodern idea: let the opponent's pawns advance, then attack them.",
    ],
    commonPlans: {
      white: "Build a big, mobile pawn center by chasing the knight, then use the space to attack.",
      black: "Develop with pressure on White's advanced pawns, aiming to prove they're overextended, not strong.",
    },
    commonMistakes: [
      "Black attacking the center before finishing development, letting White's space advantage become permanent instead of a target.",
    ],
    academyLessonId: "alekhine",
  },

  // ======================= 1.d4 =======================
  {
    id: "queens-gambit",
    name: "Queen's Gambit",
    ecoCode: "D06",
    moves: ["d4", "d5", "c4"],
    isGambit: true,
    difficulty: "intermediate",
    description:
      "Not a true sacrifice — if Black grabs the c-pawn, White can usually win it back. The real point is tempting Black's center pawn away.",
    keyIdeas: [
      "If Black takes on c4, White gets a strong, flexible center and easy piece activity to compensate.",
      "Black doesn't have to accept — declining (keeping ...d5 and ...e6) is just as common and very solid.",
      "One of the most respected, deeply studied openings in all of chess.",
    ],
    commonPlans: {
      white: "Build a strong center and develop actively, whether Black accepts or declines the pawn.",
      black: "Either return the pawn for easy development (if accepting) or build a solid structure (if declining).",
    },
    commonMistakes: [
      "Black accepting the gambit and then trying to hold the extra pawn with ...b5, which usually just creates weaknesses.",
    ],
    academyLessonId: "queens-gambit",
  },
  {
    id: "slav",
    name: "Slav Defense",
    ecoCode: "D10",
    moves: ["d4", "d5", "c4", "c6"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "Black defends the d5 pawn with a second pawn instead of a piece, keeping the light-squared bishop free to develop outside the pawn chain.",
    keyIdeas: [
      "Solves the classic \"bad bishop\" problem other Queen's Gambit defenses can run into.",
      "Very solid and well-respected at every level, from beginners to world champions.",
      "Can lead to sharp lines (if Black later takes on c4) or quiet, solid ones.",
    ],
    commonPlans: {
      white: "Develop naturally and press for a small central or spatial edge.",
      black: "Develop the light-squared bishop actively before locking the center, then equalize solidly.",
    },
    commonMistakes: [
      "Black locking the center with ...e6 too early, falling back into the exact bishop problem the Slav is meant to avoid.",
    ],
    academyLessonId: "slav",
  },
  {
    id: "kings-indian",
    name: "King's Indian Defense",
    ecoCode: "E60",
    moves: ["d4", "Nf6", "c4", "g6"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "Black lets White build a big pawn center on purpose, planning to fianchetto the bishop and strike back at it later — a hypermodern classic.",
    keyIdeas: [
      "Black controls the center with pieces first, pawns later — the core hypermodern idea.",
      "Often leads to opposite-side attacking races: White on the queenside, Black on the kingside.",
      "One of the most fighting, double-edged replies to 1.d4.",
    ],
    commonPlans: {
      white: "Expand in the center and on the queenside, aiming to attack there before Black's kingside play arrives.",
      black: "Fianchetto the bishop, castle, then launch a kingside pawn storm with ...f5.",
    },
    commonMistakes: [
      "Black playing too slowly on the kingside while White's queenside attack arrives first.",
    ],
    academyLessonId: "kings-indian",
  },
  {
    id: "queens-indian",
    name: "Queen's Indian Defense",
    ecoCode: "E12",
    moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "A flexible, solid defense — Black fianchettoes the queenside bishop to control the long diagonal and the key e4 square.",
    keyIdeas: [
      "The bishop on b7 controls e4, making it hard for White to freely expand in the center.",
      "Very solid and flexible — one of the most reliable defenses to 1.d4 at the highest level.",
      "Leads to rich strategic play rather than early tactics.",
    ],
    commonPlans: {
      white: "Develop harmoniously and look for ways to gain space without allowing easy piece activity for Black.",
      black: "Control the key central squares from a distance and stay flexible about where to place other pieces.",
    },
    commonMistakes: [
      "Black fianchettoing the bishop but then blocking its own diagonal with an early pawn move.",
    ],
    academyLessonId: "queens-indian",
  },
  {
    id: "nimzo-indian",
    name: "Nimzo-Indian Defense",
    ecoCode: "E20",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "Black pins White's knight immediately, often willing to trade the bishop for it to damage White's pawn structure.",
    keyIdeas: [
      "The pin on c3 threatens to double White's pawns if the bishop trades itself for the knight.",
      "Considered one of the soundest, most respected defenses to 1.d4 at every level.",
      "Can lead to either sharp tactical play or quiet strategic maneuvering, depending on White's response.",
    ],
    commonPlans: {
      white: "Decide whether to accept doubled pawns for the bishop pair, or avoid the trade with an early a3.",
      black: "Pressure White's center and queenside, especially if the pawns get doubled.",
    },
    commonMistakes: [
      "Black trading on c3 without a clear follow-up plan for attacking the resulting weak pawns.",
    ],
    academyLessonId: "nimzo-indian",
  },
  {
    id: "dutch",
    name: "Dutch Defense",
    ecoCode: "A80",
    moves: ["d4", "f5"],
    isGambit: false,
    difficulty: "advanced",
    description:
      "An aggressive, less common reply — Black stakes a claim on the kingside and e4 square right from move one.",
    keyIdeas: [
      "Grabs kingside space immediately, aiming for active, unbalanced play rather than symmetry.",
      "Slightly weakens the e6 and king's position in some lines — a real trade-off for the activity gained.",
      "Less deeply memorized than mainstream defenses, so it can be a good practical surprise weapon.",
    ],
    commonPlans: {
      white: "Develop soundly and look to exploit the slight weaknesses ...f5 creates around Black's king.",
      black: "Use the extra kingside space for active piece play and, in some setups, a direct kingside attack.",
    },
    commonMistakes: [
      "Black playing ...f5 without a follow-up plan, leaving the e6 and kingside squares weak for no real benefit.",
    ],
    academyLessonId: "dutch",
  },
  {
    id: "london",
    name: "London System",
    ecoCode: "D02",
    moves: ["d4", "d5", "Bf4"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "A favorite of players who want one reliable setup against almost anything — the same bishop-out, solid-structure plan works against many Black replies.",
    keyIdeas: [
      "White develops the bishop OUTSIDE the pawn chain before playing e3 — avoiding the classic \"bad bishop\" problem.",
      "The same basic setup (Bf4, e3, Nf3, Bd3 or Be2, c3) works against most things Black tries.",
      "Very low-theory — great for players who want a reliable plan without memorizing many different lines.",
    ],
    commonPlans: {
      white: "Follow the same solid setup regardless of Black's exact replies, then look for a kingside attack or central break.",
      black: "Develop actively and contest the center, since White's plan is somewhat predictable and can be prepared for.",
    },
    commonMistakes: [
      "White playing the setup on autopilot without adjusting to unusual Black replies.",
    ],
    academyLessonId: "london",
  },
  {
    id: "colle",
    name: "Colle System",
    ecoCode: "D05",
    moves: ["d4", "d5", "Nf3", "Nf6", "e3"],
    isGambit: false,
    difficulty: "beginner",
    description:
      "A quiet, solid system where White develops behind a modest pawn chain, then looks for a well-timed central break with e4.",
    keyIdeas: [
      "White builds a simple, solid structure (Nf3, e3, Bd3, c3) before deciding on a plan.",
      "The key moment is a well-prepared e4 break, which can open lines toward Black's king.",
      "Like the London System, low-theory and easy to learn the ideas of quickly.",
    ],
    commonPlans: {
      white: "Complete the setup, then time the e4 break for when it opens lines favorably.",
      black: "Develop actively and be ready to meet the e4 break without getting overrun.",
    },
    commonMistakes: [
      "White playing e4 too early, before pieces are ready to take advantage of the open lines it creates.",
    ],
    academyLessonId: "colle",
  },
  {
    id: "budapest-gambit",
    name: "Budapest Gambit",
    ecoCode: "A51",
    moves: ["d4", "Nf6", "c4", "e5"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "A surprising pawn sacrifice — Black offers a pawn immediately for quick piece activity and tactical chances against an unprepared opponent.",
    keyIdeas: [
      "Black gives up the e-pawn to get pieces out fast and create immediate tactical threats.",
      "Relies partly on surprise value — well-prepared opponents have straightforward ways to handle it.",
      "Leads to sharp, tactical positions very early in the game.",
    ],
    commonPlans: {
      white: "Return the extra pawn if needed to finish development safely and neutralize Black's activity.",
      black: "Use quick piece development to create concrete threats before White consolidates the extra pawn.",
    },
    commonMistakes: [
      "White grabbing extra material greedily instead of finishing development, walking into tactics.",
    ],
    academyLessonId: "budapest-gambit",
  },
  {
    id: "benko-gambit",
    name: "Benko Gambit",
    ecoCode: "A57",
    moves: ["d4", "Nf6", "c4", "c5", "d5", "b5"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "Black offers a queenside pawn for long-term pressure down the open a- and b-files — a strategic gambit, not a quick tactical trick.",
    keyIdeas: [
      "The compensation is positional and long-term: open files and diagonals aimed at White's queenside.",
      "Black's pressure can last well into the endgame, not just the opening and middlegame.",
      "A great practical choice for players who enjoy pressing an advantage patiently.",
    ],
    commonPlans: {
      white: "Return the pawn at some point to relieve the pressure, or defend the queenside very carefully if keeping it.",
      black: "Pile pressure on the open a- and b-files and the a1-h8 diagonal, patiently improving piece placement.",
    },
    commonMistakes: [
      "White holding onto the extra pawn passively while Black's pieces take over the entire queenside.",
    ],
    academyLessonId: "benko-gambit",
  },
  {
    id: "englund-gambit",
    name: "Englund Gambit",
    ecoCode: "A40",
    moves: ["d4", "e5"],
    isGambit: true,
    difficulty: "advanced",
    description:
      "An immediate, somewhat unconventional pawn offer against 1.d4 — mostly seen as a surprise weapon at club level rather than sound top-level theory.",
    keyIdeas: [
      "Black offers a pawn right away to unbalance the game and avoid well-known main lines.",
      "Objectively considered a bit risky — White has straightforward ways to gain an edge with careful play.",
      "Mostly valuable as a practical surprise against opponents unfamiliar with it.",
    ],
    commonPlans: {
      white: "Accept the pawn and develop soundly and carefully — the extra material should tell over time.",
      black: "Play energetically to create quick tactical chances before White consolidates the extra pawn.",
    },
    commonMistakes: [
      "White accepting the pawn but then playing too passively, giving Black's activity time to become dangerous.",
    ],
    academyLessonId: "englund-gambit",
  },

  // ======================= Other (1.c4 / 1.Nf3) =======================
  {
    id: "english",
    name: "English Opening",
    ecoCode: "A10",
    moves: ["c4"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "A flexible flank opening — White claims space on the queenside first and can transpose into many other openings depending on Black's reply.",
    keyIdeas: [
      "Extremely flexible — can transpose into Queen's Gambit, King's Indian, or entirely unique structures.",
      "White claims queenside space without committing the center pawns right away.",
      "A great choice for players who like flexible, less-memorized positions.",
    ],
    commonPlans: {
      white: "Stay flexible, often fianchettoing the king's bishop, and choose a central structure based on Black's setup.",
      black: "Contest the center directly (...e5 or ...d5) or mirror White's flexible, flank-focused approach.",
    },
    commonMistakes: [
      "Playing it on autopilot without recognizing when it has transposed into a different, well-known opening.",
    ],
    academyLessonId: "english",
  },
  {
    id: "reti",
    name: "Réti Opening",
    ecoCode: "A09",
    moves: ["Nf3", "d5", "c4"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "A hypermodern opening — White develops flexibly and pressures the center with pieces before committing central pawns.",
    keyIdeas: [
      "White delays d4/e4, instead pressuring the center from the flanks and with pieces.",
      "Very flexible — can transpose into many other openings depending on how both sides continue.",
      "A good practical choice against opponents who prefer very concrete, memorized lines.",
    ],
    commonPlans: {
      white: "Fianchetto the king's bishop, pressure d5, and choose a central structure once Black's plan is clear.",
      black: "Either defend d5 solidly or advance it, taking on the space White is content to concede for now.",
    },
    commonMistakes: [
      "Assuming this is a passive opening — the pressure is real, just delayed rather than immediate.",
    ],
    academyLessonId: "reti",
  },
  {
    id: "kings-indian-attack",
    name: "King's Indian Attack",
    ecoCode: "A07",
    moves: ["Nf3", "d5", "g3"],
    isGambit: false,
    difficulty: "intermediate",
    description:
      "White uses a King's Indian-style setup with an extra tempo — fianchetto the bishop, castle, then expand in the center or kingside.",
    keyIdeas: [
      "The same fianchetto plan as the King's Indian Defense, but played by White with an extra move.",
      "Works against almost any Black setup — one system, many opponents.",
      "Can lead to a kingside attack if Black castles short, similar in spirit to the King's Indian.",
    ],
    commonPlans: {
      white: "Fianchetto the bishop, castle, then expand with e4 or a kingside pawn storm depending on Black's setup.",
      black: "Develop soundly and contest the center directly, since White's plan is somewhat predictable.",
    },
    commonMistakes: [
      "White following the standard plan even when Black's setup calls for a different approach.",
    ],
    academyLessonId: "kings-indian-attack",
  },
];

export function getOpening(id: string): OpeningDef | undefined {
  return OPENINGS.find((o) => o.id === id);
}
