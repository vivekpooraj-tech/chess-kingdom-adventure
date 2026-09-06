/**
 * Rematch state machine.
 *
 * Pure: no network, no React. The page supplies events; this decides the state
 * and whether this client is the one that must create the game.
 *
 * The central design decision is that AN OFFER FROM BOTH SIDES IS AGREEMENT.
 * There is no separate "accept" message: clicking Rematch broadcasts your
 * offer, and when a client holds an offer from both players the rematch is on.
 * That makes the two hardest races disappear rather than needing to be handled:
 *
 *   - Both players click at the same instant. Both broadcast an offer, both
 *     end up holding two offers, both reach agreement. Nothing conflicts.
 *   - An offer arrives before or after the local click, in either order. Both
 *     orderings converge on the same state, because state is a function of
 *     which offers are held, not of the sequence they arrived in.
 *
 * Only ONE side creates the game: the player who just had Black. The other
 * waits to be told the new game's id. That guarantees a single game rather than
 * two, without a lock, a transaction or a new table — and because
 * create_invite_game seats its host as White, it swaps the colours for free.
 *
 * Offers are deliberately ephemeral — they live in a Realtime broadcast, not in
 * the database. A rematch offer that outlived a page reload would be worse than
 * useless: you would return to a game that had already been created without you,
 * or accept an offer the other player had long since walked away from.
 */

export type RematchState =
  | "idle"
  /** We have offered; waiting for them. */
  | "offered"
  /** They have offered; we have not. */
  | "received"
  /** Both have offered. The designated creator is making the game. */
  | "agreed"
  /** The new game exists and the caller should navigate to it. */
  | "ready"
  | "declined"
  | "expired";

export interface RematchContext {
  state: RematchState;
  /** Offer held from this client. */
  iOffered: boolean;
  /** Offer held from the opponent. */
  theyOffered: boolean;
  /** Set once the creator reports the new game. */
  newGameId: string | null;
}

export const INITIAL: RematchContext = {
  state: "idle",
  iOffered: false,
  theyOffered: false,
  newGameId: null,
};

/** An offer is only good for this long; a stale one must not silently commit
 *  someone to a game minutes later. */
export const OFFER_TTL_MS = 60_000;

export type RematchEvent =
  | { type: "OFFER_LOCAL" }
  | { type: "OFFER_REMOTE" }
  | { type: "DECLINE_LOCAL" }
  | { type: "DECLINE_REMOTE" }
  | { type: "CREATED"; gameId: string }
  | { type: "EXPIRE" }
  | { type: "RESET" };

/**
 * Next state. Total and deterministic: the same context and event always give
 * the same result, and unknown transitions leave the context untouched rather
 * than throwing.
 */
export function reduce(ctx: RematchContext, event: RematchEvent): RematchContext {
  switch (event.type) {
    case "RESET":
      return { ...INITIAL };

    case "CREATED": {
      // Idempotent: a duplicate or late broadcast of the same creation must not
      // move us anywhere new, and a second, different id is ignored — the first
      // game created is the game.
      if (ctx.newGameId) return ctx;
      return { ...ctx, state: "ready", newGameId: event.gameId };
    }

    case "DECLINE_LOCAL":
    case "DECLINE_REMOTE":
      // A decline after the game already exists is meaningless; do not strand
      // a player who is mid-navigation.
      if (ctx.state === "ready") return ctx;
      return { ...INITIAL, state: "declined" };

    case "EXPIRE":
      if (ctx.state === "ready" || ctx.state === "agreed") return ctx;
      if (ctx.state === "idle") return ctx;
      return { ...INITIAL, state: "expired" };

    case "OFFER_LOCAL":
    case "OFFER_REMOTE": {
      if (ctx.state === "ready") return ctx;
      const iOffered = ctx.iOffered || event.type === "OFFER_LOCAL";
      const theyOffered = ctx.theyOffered || event.type === "OFFER_REMOTE";
      // Duplicate broadcasts are common on reconnect; recomputing from the two
      // flags makes them harmless.
      const state: RematchState =
        iOffered && theyOffered ? "agreed" : iOffered ? "offered" : "received";
      return { ...ctx, iOffered, theyOffered, state };
    }

    default:
      return ctx;
  }
}

/**
 * Which player creates the rematch: the one who just played BLACK.
 *
 * Exactly one player is Black in any finished game, so this names a single
 * creator without a lock — and it delivers the colour swap for free.
 * create_invite_game always seats its host as White (verified: all existing
 * invite games have host_color 'w'), so the previous Black player becomes the
 * new host and therefore the new White. Nobody gets White twice in a row.
 */
export function isRematchCreator(myColor: "w" | "b"): boolean {
  return myColor === "b";
}

/**
 * Whether THIS client must create the new game.
 *
 * True only for the designated creator, only once agreement is reached, and
 * only while no game exists yet. The other player never creates one, which is
 * what makes duplicate creation impossible without any locking.
 */
export function shouldCreateGame(ctx: RematchContext, amCreator: boolean): boolean {
  return amCreator && ctx.state === "agreed" && ctx.newGameId === null;
}

/** The colour this player will have in the rematch. */
export function nextColorFor(myColor: "w" | "b"): "w" | "b" {
  return myColor === "w" ? "b" : "w";
}

/** Label for the rematch button / status line. */
export function describe(ctx: RematchContext): string {
  switch (ctx.state) {
    case "offered":
      return "Rematch offered — waiting for your opponent";
    case "received":
      return "Your opponent wants a rematch";
    case "agreed":
      return "Setting up the rematch…";
    case "ready":
      return "Rematch ready";
    case "declined":
      return "Rematch declined";
    case "expired":
      return "The rematch offer expired";
    default:
      return "";
  }
}
