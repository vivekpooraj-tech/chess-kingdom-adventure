import { Chess, type Square } from "chess.js";

/**
 * Chess Mind Watch — the ONE data layer, shared by every world. Official, documented, public Lichess endpoints only (no scraping, no
 * secrets, no account, no proxy): they send CORS headers, so the browser calls them directly.
 *   GET /api/tv/channels                    live TV game per channel (Top Rated, Rapid, Blitz, Classical, Bullet)
 *   GET /api/broadcast?nb=N                 official broadcasts (NDJSON); each carries its rounds with `ongoing`
 *   GET /api/broadcast/round/{id}.pgn       a broadcast round's games, as PGN
 *   GET /game/export/{id}                   one game (JSON): players, ratings, status, moves
 * Shapes and paths were checked against the official OpenAPI spec (github.com/lichess-org/api, doc/specs): TvGame / BroadcastWithRounds /
 * BroadcastRoundInfo / GameJson, and the Access-Control-Allow-Origin header on each of the four endpoints. Two documented behaviours matter:
 * ongoing games from /game/export are delayed by 3 moves (an anti-cheat rule of the API), so TV games are labelled as slightly behind; and the
 * broadcast PGN endpoint lists the `study:read` scope in the spec, which is for private broadcasts: only public ones are ever requested here.
 * Read-only by construction: nothing here (or in the Watch UI) can submit a move.
 */
export const LICHESS = "https://lichess.org";

export type WatchPlayer = { name: string; title?: string; rating?: number };

export type TvEntry = { channel: string; gameId: string; player: WatchPlayer };

export type BroadcastCard = {
  tourId: string;
  name: string;
  tier?: number;
  description?: string;
  roundId: string;
  roundName: string;
  roundUrl?: string;
};

export type WatchGame = {
  /** Stable key within its source (TV game id, or "<roundId>:<index>"). */
  key: string;
  white: WatchPlayer;
  black: WatchPlayer;
  fen: string;
  lastMove?: { from: Square; to: Square };
  moves: string[];
  /** True while the game is still being played. */
  live: boolean;
  /** Human text for the status line: "In progress", "White won — checkmate", "Draw", … */
  statusText: string;
  event?: string;
  /** Standard chess only; anything else is shown as unsupported rather than guessed at. */
  unsupported?: boolean;
  /** Set when the source is documented to run a few moves behind (Lichess delays ongoing TV games by 3 moves). */
  delayNote?: string;
};

/** /api/tv/channels keys (camelCase in the real response) -> the label Watch shows. `best` is Lichess TV's top-rated game. */
const TV_CHANNELS = { best: "Top Rated", rapid: "Rapid", blitz: "Blitz", classical: "Classical", bullet: "Bullet" } as const;
export type TvChannel = (typeof TV_CHANNELS)[keyof typeof TV_CHANNELS];

async function getText(path: string, signal: AbortSignal, accept?: string): Promise<string> {
  const res = await fetch(`${LICHESS}${path}`, { signal, headers: accept ? { Accept: accept } : undefined });
  if (!res.ok) throw new Error(`lichess ${res.status}`);
  return res.text();
}

export async function fetchTv(signal: AbortSignal): Promise<TvEntry[]> {
  const data = JSON.parse(await getText("/api/tv/channels", signal, "application/json")) as Record<string, any>;
  const out: TvEntry[] = [];
  for (const [key, channel] of Object.entries(TV_CHANNELS)) {
    const e = data?.[key];
    if (!e || typeof e.gameId !== "string") continue;
    const name = e.user?.name ?? e.user?.id;
    if (typeof name !== "string") continue;
    out.push({
      channel,
      gameId: e.gameId,
      player: { name, title: e.user?.title, rating: typeof e.rating === "number" ? e.rating : undefined },
    });
  }
  return out;
}

export async function fetchLiveBroadcasts(signal: AbortSignal): Promise<BroadcastCard[]> {
  const text = await getText("/api/broadcast?nb=30&live=true", signal, "application/x-ndjson");
  const out: BroadcastCard[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let b: any;
    try {
      b = JSON.parse(line);
    } catch {
      continue;
    }
    const tour = b?.tour;
    if (!tour?.id || !tour?.name) continue;
    const rounds: any[] = Array.isArray(b.rounds) ? b.rounds : b.round ? [b.round] : [];
    // The round that is being played right now. Nothing is inferred from start times: only Lichess's own `ongoing` flag counts as live.
    const live = rounds.filter((r) => r?.ongoing === true && !r?.finished).pop();
    if (!live?.id) continue;
    out.push({
      tourId: String(tour.id),
      name: String(tour.name),
      tier: typeof tour.tier === "number" ? tour.tier : undefined,
      description: typeof tour.description === "string" ? tour.description : undefined,
      roundId: String(live.id),
      roundName: String(live.name ?? "Live round"),
      roundUrl: typeof live.url === "string" ? live.url : undefined,
    });
  }
  return out.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
}

function replay(sans: string[]): { fen: string; lastMove?: { from: Square; to: Square }; moves: string[]; ok: boolean } {
  const chess = new Chess();
  let last: { from: Square; to: Square } | undefined;
  for (const san of sans) {
    try {
      const m = chess.move(san);
      last = { from: m.from, to: m.to };
    } catch {
      return { fen: chess.fen(), lastMove: last, moves: chess.history(), ok: false };
    }
  }
  return { fen: chess.fen(), lastMove: last, moves: chess.history(), ok: true };
}

function sideName(p: any): WatchPlayer {
  const user = p?.user;
  return {
    name: user?.name ?? user?.id ?? (p?.aiLevel ? `Stockfish level ${p.aiLevel}` : "Anonymous"),
    title: user?.title,
    rating: typeof p?.rating === "number" ? p.rating : undefined,
  };
}

// GameStatusName in the spec: created, started, aborted, mate, resign, stalemate, timeout, draw, outoftime, cheat, noStart, unknownFinish,
// insufficientMaterialClaim, variantEnd.
const STATUS_TEXT: Record<string, string> = {
  mate: "checkmate",
  resign: "resignation",
  timeout: "time out",
  outoftime: "time out",
  stalemate: "stalemate",
  draw: "draw agreed",
  aborted: "game aborted",
  cheat: "game closed",
  noStart: "game did not start",
  insufficientMaterialClaim: "insufficient material",
  unknownFinish: "finished",
  variantEnd: "variant end",
};

export async function fetchTvGame(gameId: string, signal: AbortSignal): Promise<WatchGame> {
  const g = JSON.parse(
    await getText(`/game/export/${encodeURIComponent(gameId)}?clocks=false&evals=false&opening=false`, signal, "application/json"),
  );
  const live = g.status === "started" || g.status === "created";
  const sans: string[] = typeof g.moves === "string" && g.moves ? g.moves.split(" ") : [];
  const r = replay(sans);
  let statusText = "In progress";
  if (!live) {
    const how = STATUS_TEXT[g.status] ?? String(g.status ?? "finished");
    statusText = g.winner ? `${g.winner === "white" ? "White" : "Black"} won — ${how}` : g.status === "draw" || g.status === "stalemate" ? `Draw — ${how}` : `Finished — ${how}`;
  }
  return {
    key: String(g.id ?? gameId),
    white: sideName(g.players?.white),
    black: sideName(g.players?.black),
    fen: r.fen,
    lastMove: r.lastMove,
    moves: r.moves,
    live,
    statusText,
    event: typeof g.perf === "string" ? g.perf[0].toUpperCase() + g.perf.slice(1) : undefined,
    unsupported: (g.variant && g.variant !== "standard") || !r.ok || undefined,
    delayNote: live ? "Shown a few moves behind, as Lichess requires for games in progress." : undefined,
  };
}

function parsePlayer(h: Record<string, string>, side: "White" | "Black"): WatchPlayer {
  const elo = parseInt(h[`${side}Elo`] ?? "", 10);
  const title = h[`${side}Title`];
  return { name: h[side] || "Unknown", title: title || undefined, rating: Number.isFinite(elo) ? elo : undefined };
}

/** A broadcast round: every game in it, newest position of each. */
export async function fetchBroadcastRound(roundId: string, signal: AbortSignal): Promise<WatchGame[]> {
  const text = await getText(`/api/broadcast/round/${encodeURIComponent(roundId)}.pgn?clocks=false&comments=false`, signal, "application/x-chess-pgn");
  const chunks = text.replace(/\r\n/g, "\n").split(/\n\n(?=\[Event )/).map((c) => c.trim()).filter(Boolean);
  const games: WatchGame[] = [];
  chunks.forEach((chunk, i) => {
    const chess = new Chess();
    try {
      chess.loadPgn(chunk);
    } catch {
      return;
    }
    const h = chess.header() as Record<string, string>;
    const result = h.Result ?? "*";
    const live = result === "*";
    const verbose = chess.history({ verbose: true });
    const last = verbose[verbose.length - 1];
    games.push({
      key: `${roundId}:${i}`,
      white: parsePlayer(h, "White"),
      black: parsePlayer(h, "Black"),
      fen: chess.fen(),
      lastMove: last ? { from: last.from, to: last.to } : undefined,
      moves: verbose.map((m) => m.san),
      live,
      statusText: live ? "In progress" : result === "1-0" ? "White won" : result === "0-1" ? "Black won" : "Draw",
      event: h.Event,
      unsupported: h.Variant && h.Variant !== "Standard" ? true : undefined,
    });
  });
  return games;
}
