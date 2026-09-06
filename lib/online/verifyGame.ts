import { Chess } from "chess.js";

/**
 * Authoritative reconstruction of an online game from its stored moves.
 *
 * Pure: no I/O, no database. Given the move list the server holds, this replays
 * the game from the standard starting position and reports what is actually
 * true of the resulting position. It is the piece that lets the server stop
 * believing the client.
 *
 * Two things made that necessary:
 *
 *   * submit_online_move writes the client's p_fen and p_san straight into the
 *     row with no validation, so the stored position is whatever the client
 *     said it was.
 *   * finish_online_game_by_result takes p_winner verbatim, so a participant
 *     could declare themselves the winner of a live rated game. That was
 *     demonstrated with zero moves played.
 *
 * Replaying is what makes both safe. An illegal move stream cannot be replayed,
 * and a claimed checkmate either exists in the reconstructed position or does
 * not. Postgres cannot do this — there is no chess engine in the database — so
 * it happens in the Next.js server, which already has chess.js.
 */

export type Termination =
  | "ongoing"
  | "checkmate"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move";

export interface VerifiedGame {
  /** True when every stored move replayed legally from the start position. */
  legal: boolean;
  /** Index of the first move that would not replay, when legal is false. */
  illegalAtPly?: number;
  /** The position reached, in FEN. */
  fen: string;
  /** Whose turn it is in the reconstructed position. */
  turn: "w" | "b";
  termination: Termination;
  /**
   * The winning colour when the position itself decides the game, otherwise
   * null. Only checkmate produces a winner; every other termination is a draw.
   */
  winner: "w" | "b" | null;
  /** True when the position is drawn by any supported rule. */
  isDraw: boolean;
  /** Number of plies replayed. */
  plies: number;
}

/**
 * Replay `moves` (SAN, in order) from the initial position.
 *
 * Never throws: an illegal or malformed move stream is a result to report, not
 * an exception to handle at every call site.
 */
export function verifyGame(moves: readonly string[]): VerifiedGame {
  const game = new Chess();
  let plies = 0;

  for (let i = 0; i < moves.length; i++) {
    const san = moves[i];
    let ok = false;
    try {
      ok = Boolean(game.move(san));
    } catch {
      ok = false;
    }
    if (!ok) {
      return {
        legal: false,
        illegalAtPly: i,
        fen: game.fen(),
        turn: game.turn(),
        termination: "ongoing",
        winner: null,
        isDraw: false,
        plies,
      };
    }
    plies++;
  }

  return { legal: true, ...describePosition(game), plies };
}

function describePosition(game: Chess): Omit<VerifiedGame, "legal" | "plies" | "illegalAtPly"> {
  const turn = game.turn() as "w" | "b";
  const base = { fen: game.fen(), turn };

  if (game.isCheckmate()) {
    // The side to move is mated, so the other side won.
    return { ...base, termination: "checkmate", winner: turn === "w" ? "b" : "w", isDraw: false };
  }
  if (game.isStalemate()) {
    return { ...base, termination: "stalemate", winner: null, isDraw: true };
  }
  if (game.isInsufficientMaterial()) {
    return { ...base, termination: "insufficient_material", winner: null, isDraw: true };
  }
  if (game.isThreefoldRepetition()) {
    return { ...base, termination: "threefold_repetition", winner: null, isDraw: true };
  }
  // chess.js exposes the fifty-move rule only through isDraw() once the other
  // specific cases are excluded, so it is inferred rather than asked for.
  if (game.isDraw()) {
    return { ...base, termination: "fifty_move", winner: null, isDraw: true };
  }
  return { ...base, termination: "ongoing", winner: null, isDraw: false };
}

/** The colour a given player had, from the host's colour. */
export function colorOf(
  childId: string,
  hostChildId: string,
  hostColor: "w" | "b"
): "w" | "b" | null {
  if (childId === hostChildId) return hostColor;
  return hostColor === "w" ? "b" : "w";
}

export type CompletionIntent = "resign" | "claim_result" | "accept_draw";

export interface CompletionDecision {
  /** Whether the server will finish the game. */
  allowed: boolean;
  /** 'w' | 'b' | 'draw' — decided by the server, never supplied by the client. */
  winner: "w" | "b" | "draw" | null;
  reason: string;
}

/**
 * Decide the outcome of a completion request.
 *
 * The client sends an INTENT, never a winner. Everything that determines who
 * won is derived here from the replayed position and from who is asking.
 */
export function decideCompletion(params: {
  intent: CompletionIntent;
  verified: VerifiedGame;
  /** Colour of the player making the request. */
  requesterColor: "w" | "b";
  /** True when the opponent has an outstanding draw offer on the game row. */
  opponentOfferedDraw: boolean;
}): CompletionDecision {
  const { intent, verified, requesterColor, opponentOfferedDraw } = params;

  if (!verified.legal) {
    return {
      allowed: false,
      winner: null,
      reason: `move ${verified.illegalAtPly} does not replay legally`,
    };
  }

  if (intent === "resign") {
    // A resignation is always the requester's own loss, so it needs no board
    // evidence — but the winner is derived from who asked, never sent by them.
    return {
      allowed: true,
      winner: requesterColor === "w" ? "b" : "w",
      reason: "resignation",
    };
  }

  if (intent === "accept_draw") {
    if (!opponentOfferedDraw) {
      return { allowed: false, winner: null, reason: "no outstanding draw offer to accept" };
    }
    return { allowed: true, winner: "draw", reason: "draw by agreement" };
  }

  // claim_result: the position must actually be over. This is the branch that
  // used to be a free win.
  if (verified.termination === "checkmate") {
    return { allowed: true, winner: verified.winner, reason: "checkmate" };
  }
  if (verified.isDraw) {
    return { allowed: true, winner: "draw", reason: verified.termination };
  }
  return { allowed: false, winner: null, reason: "the game is still in progress" };
}
