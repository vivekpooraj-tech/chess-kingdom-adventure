export type MinigameEngine =
  | "drag_to_target"
  | "timed_reaction"
  | "pattern_match"
  | "maze_navigate"
  | "board_click_sequence"
  | "memory_flip";

export type Piece = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king" | "mixed";

export interface MinigameCatalogEntry {
  id: string;
  name: string;
  engine: MinigameEngine;
  piece: Piece;
  skillTag: string;
  difficulty: 1 | 2 | 3;
}

/**
 * 50 mini-game variants across 6 reusable mechanic engines (per the
 * Technical Architecture doc: one engine, many configs — not one codebase
 * per game). Each entry is a config, not a new component. Roughly balanced
 * across the six crystal pieces plus a "mixed" band for late-course review
 * content (Days 21-30).
 *
 * `id` is a stable content key — safe to reference from lesson_steps.config
 * in the DB schema. Add/remove entries here to resize the catalog; nothing
 * else in the codebase needs to change.
 */
export const MINIGAME_CATALOG: MinigameCatalogEntry[] = [
  // Pawn (7)
  { id: "pawn-race", name: "Pawn Race", engine: "drag_to_target", piece: "pawn", skillTag: "pawn_movement", difficulty: 1 },
  { id: "pawn-double-step", name: "Pawn Sprint", engine: "drag_to_target", piece: "pawn", skillTag: "pawn_double_step", difficulty: 1 },
  { id: "pawn-capture", name: "Guard the Diagonal", engine: "board_click_sequence", piece: "pawn", skillTag: "pawn_capture", difficulty: 2 },
  { id: "pawn-en-passant", name: "Sneaky Slip-By", engine: "board_click_sequence", piece: "pawn", skillTag: "en_passant", difficulty: 3 },
  { id: "pawn-promotion", name: "Crown the Champion", engine: "drag_to_target", piece: "pawn", skillTag: "promotion", difficulty: 2 },
  { id: "pawn-wall", name: "Build the Wall", engine: "pattern_match", piece: "pawn", skillTag: "pawn_structure", difficulty: 2 },
  { id: "pawn-race-timed", name: "Pawn Village Sprint", engine: "timed_reaction", piece: "pawn", skillTag: "pawn_movement", difficulty: 2 },

  // Knight (9)
  { id: "knight-jump", name: "Knight Jump", engine: "drag_to_target", piece: "knight", skillTag: "knight_movement", difficulty: 1 },
  { id: "knight-maze", name: "Knight's Forest Maze", engine: "maze_navigate", piece: "knight", skillTag: "knight_movement", difficulty: 2 },
  { id: "knight-fork-spot", name: "Spot the Fork", engine: "pattern_match", piece: "knight", skillTag: "fork_pattern", difficulty: 2 },
  { id: "knight-fork-execute", name: "Fork the Foes", engine: "board_click_sequence", piece: "knight", skillTag: "fork_pattern", difficulty: 3 },
  { id: "knight-tour", name: "Knight's Grand Tour", engine: "maze_navigate", piece: "knight", skillTag: "knight_movement", difficulty: 3 },
  { id: "knight-vs-time", name: "Knight Jump Time Attack", engine: "timed_reaction", piece: "knight", skillTag: "knight_movement", difficulty: 2 },
  { id: "knight-memory", name: "Knight Memory Match", engine: "memory_flip", piece: "knight", skillTag: "knight_movement", difficulty: 1 },
  { id: "knight-outpost", name: "Find the Outpost", engine: "pattern_match", piece: "knight", skillTag: "knight_outpost", difficulty: 3 },
  { id: "knight-escape", name: "Knight's Great Escape", engine: "maze_navigate", piece: "knight", skillTag: "knight_movement", difficulty: 2 },

  // Bishop (7)
  { id: "bishop-laser", name: "Bishop Laser", engine: "drag_to_target", piece: "bishop", skillTag: "bishop_movement", difficulty: 1 },
  { id: "bishop-diagonal-catch", name: "Diagonal Catch", engine: "timed_reaction", piece: "bishop", skillTag: "bishop_movement", difficulty: 2 },
  { id: "bishop-pin-spot", name: "Spot the Pin", engine: "pattern_match", piece: "bishop", skillTag: "pin_pattern", difficulty: 2 },
  { id: "bishop-pin-execute", name: "Pin the Guard", engine: "board_click_sequence", piece: "bishop", skillTag: "pin_pattern", difficulty: 3 },
  { id: "bishop-pair", name: "Bishop Pair Power", engine: "pattern_match", piece: "bishop", skillTag: "bishop_pair", difficulty: 3 },
  { id: "bishop-color-sort", name: "Light Square, Dark Square", engine: "memory_flip", piece: "bishop", skillTag: "bishop_movement", difficulty: 1 },
  { id: "bishop-maze", name: "Bishop's Crystal Cave", engine: "maze_navigate", piece: "bishop", skillTag: "bishop_movement", difficulty: 2 },

  // Rook (7)
  { id: "rook-charge", name: "Rook's Castle Charge", engine: "drag_to_target", piece: "rook", skillTag: "rook_movement", difficulty: 1 },
  { id: "rook-corridor", name: "Corridor Sprint", engine: "timed_reaction", piece: "rook", skillTag: "rook_movement", difficulty: 2 },
  { id: "rook-open-file", name: "Find the Open File", engine: "pattern_match", piece: "rook", skillTag: "open_file", difficulty: 2 },
  { id: "rook-castling", name: "Castle the King", engine: "board_click_sequence", piece: "rook", skillTag: "castling", difficulty: 2 },
  { id: "rook-doubling", name: "Double Up the Rooks", engine: "pattern_match", piece: "rook", skillTag: "rook_doubling", difficulty: 3 },
  { id: "rook-maze", name: "Rook's Straight Shot", engine: "maze_navigate", piece: "rook", skillTag: "rook_movement", difficulty: 1 },
  { id: "rook-back-rank", name: "Back Rank Watch", engine: "pattern_match", piece: "rook", skillTag: "back_rank_mate", difficulty: 3 },

  // Queen (7)
  { id: "queen-rescue", name: "Queen Rescue", engine: "drag_to_target", piece: "queen", skillTag: "queen_movement", difficulty: 1 },
  { id: "queen-power-sweep", name: "Queen's Power Sweep", engine: "timed_reaction", piece: "queen", skillTag: "queen_movement", difficulty: 2 },
  { id: "queen-fork", name: "Queen Fork Finder", engine: "pattern_match", piece: "queen", skillTag: "fork_pattern", difficulty: 3 },
  { id: "queen-safety", name: "Keep the Queen Safe", engine: "board_click_sequence", piece: "queen", skillTag: "queen_safety", difficulty: 2 },
  { id: "queen-maze", name: "Queen's Crystal Chase", engine: "maze_navigate", piece: "queen", skillTag: "queen_movement", difficulty: 2 },
  { id: "queen-mate-pattern", name: "Queen + King Mate", engine: "pattern_match", piece: "queen", skillTag: "queen_king_mate", difficulty: 3 },
  { id: "queen-memory", name: "Queen's Memory Vault", engine: "memory_flip", piece: "queen", skillTag: "queen_movement", difficulty: 1 },

  // King (7)
  { id: "king-safety-walk", name: "King's Careful Walk", engine: "drag_to_target", piece: "king", skillTag: "king_movement", difficulty: 1 },
  { id: "king-check-spot", name: "Spot the Check", engine: "pattern_match", piece: "king", skillTag: "check_recognition", difficulty: 1 },
  { id: "king-checkmate-spot", name: "Spot the Checkmate", engine: "pattern_match", piece: "king", skillTag: "checkmate_recognition", difficulty: 2 },
  { id: "king-escape-check", name: "Escape the Check", engine: "board_click_sequence", piece: "king", skillTag: "check_response", difficulty: 2 },
  { id: "king-opposition", name: "King Face-Off", engine: "pattern_match", piece: "king", skillTag: "king_opposition", difficulty: 3 },
  { id: "king-castle-race", name: "Race to Castle", engine: "timed_reaction", piece: "king", skillTag: "castling", difficulty: 2 },
  { id: "king-safety-maze", name: "King's Safe Room Maze", engine: "maze_navigate", piece: "king", skillTag: "king_safety", difficulty: 2 },

  // Mixed / review (6) — later-course content combining multiple pieces
  { id: "mixed-checkmate-1move", name: "One-Move Checkmate!", engine: "pattern_match", piece: "mixed", skillTag: "checkmate_recognition", difficulty: 2 },
  { id: "mixed-tactic-spotter", name: "Tactic Spotter", engine: "pattern_match", piece: "mixed", skillTag: "tactics_mixed", difficulty: 3 },
  { id: "mixed-opening-race", name: "Opening Move Race", engine: "timed_reaction", piece: "mixed", skillTag: "opening_principles", difficulty: 2 },
  { id: "mixed-board-vision", name: "Full Board Vision", engine: "memory_flip", piece: "mixed", skillTag: "board_awareness", difficulty: 2 },
  { id: "mixed-endgame-maze", name: "Endgame Escape Maze", engine: "maze_navigate", piece: "mixed", skillTag: "basic_endgames", difficulty: 3 },
  { id: "mixed-boss-prep", name: "Boss Battle Warm-Up", engine: "board_click_sequence", piece: "mixed", skillTag: "tactics_mixed", difficulty: 3 },
];

export function getMinigamesForSkill(skillTag: string): MinigameCatalogEntry[] {
  return MINIGAME_CATALOG.filter((g) => g.skillTag === skillTag);
}

export function getMinigamesByPiece(piece: Piece): MinigameCatalogEntry[] {
  return MINIGAME_CATALOG.filter((g) => g.piece === piece);
}
