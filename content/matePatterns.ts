/**
 * What each named checkmate pattern in the puzzle library actually IS.
 *
 * The Trainer already labels every puzzle with its theme, but solving a
 * "Smothered Mate" and being told only "Checkmate — you found it" teaches the
 * child nothing they can reuse. Naming the pattern and explaining it in one
 * sentence turns a solved puzzle into a pattern they can recognise on a real
 * board, which is the whole point of tactics practice.
 *
 * INCLUSION RULE: an entry exists only where the pattern's definition is
 * unambiguous and I am confident it is correct. Several themes in the library
 * (Pillsbury's, Vukovic, Kill Box, Triangle, Rook Box, and the generic
 * "Queen & Rook"-style labels) are deliberately absent rather than described
 * loosely — the UI simply omits the explanation when a theme isn't here.
 * A confidently-worded wrong definition is worse than no definition: children
 * learning a pattern for the first time have no way to catch the error, and
 * this app's whole credibility rests on never telling them something untrue
 * about chess.
 *
 * The generic "Checkmate in 1/2/3" themes are intentionally not here either —
 * they name a puzzle's length, not a pattern.
 */

export interface MatePattern {
  /** One sentence a 7-12 year old can follow. */
  description: string;
  /** What to look for next time — the transferable half. */
  recognise: string;
}

export const MATE_PATTERNS: Record<string, MatePattern> = {
  "Back-Rank Mate": {
    description:
      "The king is stuck on its back row because its own pawns block the squares in front of it, and a rook or queen mates along that row.",
    recognise: "A king that hasn't made a escape square for itself is always in danger on the back rank.",
  },
  "Smothered Mate": {
    description:
      "The king is completely hemmed in by its own pieces, so only a knight — which jumps over everything — can reach it.",
    recognise: "When a king is surrounded by its own army, look for a knight check.",
  },
  "Anastasia's Mate": {
    description:
      "A knight takes away the king's escape squares while a rook mates along the file or row next to it, pinning the king against the edge.",
    recognise: "A knight near the enemy king plus a rook that can swing across is a mating pair.",
  },
  "Opera Mate": {
    description:
      "A rook mates on the back row while a bishop guards it from a distance, and the king's own pieces block its escape.",
    recognise: "A bishop on a long diagonal can defend the rook that delivers mate.",
  },
  "Arabian Mate": {
    description:
      "In the corner, a rook gives mate right next to the king while a knight both defends the rook and covers the escape square.",
    recognise: "Rook and knight work beautifully together against a king in the corner.",
  },
  "Epaulette Mate": {
    description:
      "The king's escape squares on either side are blocked by its own rooks — like shoulder pads — so a queen can mate from in front.",
    recognise: "When a king is boxed in by its own pieces, a direct check can be mate.",
  },
  "Boden's Mate": {
    description:
      "Two bishops on crossing diagonals catch a castled king whose own pieces take away its escape squares.",
    recognise: "Two bishops pointing at a castled king are dangerous even without other pieces.",
  },
  "Double Bishop Mate": {
    description:
      "Two bishops on neighbouring diagonals trap the king against the edge of the board with nowhere to run.",
    recognise: "Bishops are strongest as a pair when the enemy king is near the edge.",
  },
  "Hook Mate": {
    description:
      "A rook gives check, a knight defends the rook, and a pawn covers the king's last escape square — the three hook together.",
    recognise: "A pawn can be the piece that takes away the final flight square.",
  },
  "Dovetail Mate": {
    description:
      "A queen mates the king from right beside it, while the king's own pieces block the two diagonal squares it would run to.",
    recognise: "A queen can mate up close when friendly pieces are in the king's way.",
  },
  "Swallowstail Mate": {
    description:
      "The king's diagonal escape squares are blocked by its own pieces, so a queen mates it directly from the front.",
    recognise: "Crowded pieces around a king turn a normal check into mate.",
  },
  "Corner Mate": {
    description:
      "The king is trapped in the corner, a rook delivers mate, and a knight covers the one square it could have used.",
    recognise: "Kings in the corner have very few squares — check what covers each one.",
  },
  "Blind Swine Mate": {
    description:
      "Two rooks side by side on the seventh row sweep along it, and the king cannot escape the two of them.",
    recognise: "Doubled rooks on the seventh rank are one of the strongest attacking setups.",
  },
  "Rook Ladder": {
    description:
      "Two rooks take turns giving check, each one cutting off a row, walking the king to the edge until it is mated.",
    recognise: "Rooks push a lone king backwards one row at a time — no other pieces needed.",
  },
  "Corridor Mate": {
    description:
      "The king is stuck in a narrow corridor made by its own pieces, and is mated along it.",
    recognise: "Look for kings that only have one line to move along.",
  },
  "Cornered King": {
    description: "The king has been forced into the corner where it simply runs out of squares.",
    recognise: "Driving a king toward the corner shrinks its options every move.",
  },
  "Queen Mating Net": {
    description:
      "The queen takes squares away from the king step by step until it has nowhere left, then the king is mated.",
    recognise: "A queen alone can shrink a king's box — but needs the king's help to finish.",
  },
  "King & Rook Mate": {
    description:
      "The classic endgame: the rook cuts the king off and your own king walks up to take away the last squares.",
    recognise: "Rook mates need your king's help — the two work as a team.",
  },
  "Queen & King": {
    description:
      "The queen boxes the king in and your king comes up to support the final check.",
    recognise: "Keep the queen a knight's move away to avoid stalemate while boxing the king in.",
  },
};

/** The pattern for a theme, or null when we have nothing accurate to say. */
export function getMatePattern(theme: string | undefined | null): MatePattern | null {
  if (!theme) return null;
  return MATE_PATTERNS[theme] ?? null;
}
