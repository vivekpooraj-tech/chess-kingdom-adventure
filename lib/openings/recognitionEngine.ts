import { OPENINGS, OpeningDef } from "@/content/openings";

export interface OpeningMatch {
  opening: OpeningDef;
  ecoCode: string;
  isGambit: boolean;
  /** How many plies of the game matched this opening's defining line. */
  matchedPlies: number;
}

/**
 * Longest-prefix match against the curated OPENINGS list: an opening
 * "matches" if the game's move history starts with exactly that opening's
 * move sequence (SAN, in order) — not fuzzy, not probabilistic. When more
 * than one opening's sequence is a valid prefix (e.g. both Italian Game
 * and Evans Gambit match a 7-ply Evans Gambit game, since Evans Gambit's
 * line extends Italian Game's), the longer/more specific one wins. This
 * naturally handles gambits and named sub-lines as their own entries
 * without needing an explicit parent/child tree.
 *
 * Returns null if no known opening matches (most games, most of the time
 * — this is a curated, honestly-small database, not an exhaustive one).
 */
export function recognizeOpening(sanHistory: string[]): OpeningMatch | null {
  let best: OpeningMatch | null = null;

  for (const opening of OPENINGS) {
    const len = opening.moves.length;
    if (sanHistory.length < len) continue;

    const prefix = sanHistory.slice(0, len);
    const isMatch = prefix.every((move, i) => move === opening.moves[i]);
    if (!isMatch) continue;

    if (!best || len > best.matchedPlies) {
      best = { opening, ecoCode: opening.ecoCode, isGambit: opening.isGambit, matchedPlies: len };
    }
  }

  return best;
}
