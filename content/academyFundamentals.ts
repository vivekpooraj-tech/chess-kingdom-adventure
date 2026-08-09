export interface FundamentalsTopic {
  id: string;
  title: string;
  explanation: string;
  /** When set, shown on a small read-only board as a real, verified
   * illustrative position — not decoration, an accurate example of the
   * concept being explained. */
  exampleFen?: string;
  exampleCaption?: string;
}

export const FUNDAMENTALS_TOPICS: FundamentalsTopic[] = [
  {
    id: "board",
    title: "The Board",
    explanation:
      "Chess is played on an 8x8 grid of 64 squares, alternating light and dark. Each player starts with a light square in the bottom-right corner. The board is always set up the same way — memorizing that orientation is the first step to reading any position at a glance.",
  },
  {
    id: "coordinates",
    title: "Coordinates",
    explanation:
      "Every square has an address: a letter (a-h) for its file (column) and a number (1-8) for its rank (row) — like e4 or g7. White's pieces start on ranks 1-2, Black's on ranks 7-8. Coordinates are how every move ever played gets written down and studied.",
  },
  {
    id: "pieces",
    title: "The Pieces",
    explanation:
      "Six piece types, each moving differently: the King (must be protected), Queen (moves any direction, any distance), Rook (straight lines), Bishop (diagonals), Knight (L-shaped jumps), and Pawn (forward, captures diagonally). See the Piece Library for a full breakdown of each.",
  },
  {
    id: "legal-moves",
    title: "Legal Moves",
    explanation:
      "A move is only legal if it follows that piece's movement pattern AND doesn't leave your own King in check. Pieces (except the Knight) can't jump over other pieces — they're blocked by anything in their path.",
  },
  {
    id: "check",
    title: "Check",
    explanation:
      "A King is \"in check\" when it's under direct attack. The player in check must get out of it immediately on their very next move — by moving the King to safety, blocking the attack with another piece, or capturing the attacking piece.",
    exampleFen: "4k3/8/8/8/8/8/8/4R1K1 b - - 0 1",
    exampleCaption: "White's rook attacks straight down the e-file — Black's King is in check and must respond.",
  },
  {
    id: "checkmate",
    title: "Checkmate",
    explanation:
      "Checkmate is check with no way out — the King can't move to safety, nothing can block the attack, and the attacker can't be captured. The moment checkmate happens, the game ends immediately. That's the entire goal of chess.",
    exampleFen: "4R1k1/5ppp/8/8/8/8/8/6K1 b - - 0 1",
    exampleCaption: "A classic \"back-rank mate\" — the King's own pawns block every escape square.",
  },
  {
    id: "castling",
    title: "Castling",
    explanation:
      "A special one-time move where the King slides two squares toward a Rook, and that Rook hops to the square right next to the King — done in a single move. It's the only time a player moves two pieces at once, and the main way to get the King to safety early in the game. Requires: neither piece has moved yet, no pieces between them, and the King isn't in check or passing through check.",
    exampleFen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    exampleCaption: "Both sides still have full castling rights — Kings and Rooks untouched, path clear.",
  },
  {
    id: "en-passant",
    title: "En Passant",
    explanation:
      "A special pawn capture. If an enemy pawn rushes two squares forward and lands right beside your pawn, your pawn can capture it as though it had only moved one square — but only on the very next move, or the chance is gone forever. French for \"in passing.\"",
    exampleFen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
    exampleCaption: "Black's pawn just rushed two squares to d5. White can capture it on d6, en passant.",
  },
  {
    id: "promotion",
    title: "Promotion",
    explanation:
      "A pawn that survives the journey all the way to the far end of the board transforms into any other piece — almost always a Queen, since it's the most powerful. This is how a single humble pawn can turn a losing position into a winning one.",
    exampleFen: "k7/4P3/8/8/8/8/8/4K3 w - - 0 1",
    exampleCaption: "White's pawn is one square from promoting — pushing to e8 turns it into a Queen.",
  },
];
