"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WatchBoard } from "./WatchBoard";
import { LiveBadge, Notice, PlayerLine } from "./Parts";
import { usePolled } from "@/lib/watch/usePolled";
import { fetchBroadcastRound, fetchTvGame, type WatchGame } from "@/lib/watch/lichess";

function BackToWatch() {
  return (
    <Link href="/watch" className="wt-back">
      ← Back to Watch
    </Link>
  );
}

function MoveList({ moves }: { moves: string[] }) {
  if (!moves.length) return <p className="wt-muted">No moves yet.</p>;
  const pairs: string[][] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push(moves.slice(i, i + 2));
  return (
    <ol className="wt-moves" aria-label="Moves">
      {pairs.map((p, i) => (
        <li key={i}>
          <span className="wt-moves__n">{i + 1}.</span> {p[0]} {p[1] ?? ""}
        </li>
      ))}
    </ol>
  );
}

/** The live board, players, status and moves for one game. Read-only. */
function GameStage({ game, stale }: { game: WatchGame; stale: boolean }) {
  return (
    <div className="wt-stage">
      <div className="wt-stage__board">
        <div className="wt-stage__side">
          <PlayerLine p={game.black} />
        </div>
        {game.unsupported ? (
          <Notice title="This game can’t be shown here.">It uses a chess variant or position Chess Mind doesn’t display yet.</Notice>
        ) : (
          <WatchBoard
            fen={game.fen}
            lastMove={game.lastMove}
            label={`Live board. ${game.white.name} (White) against ${game.black.name} (Black). ${game.moves.length} moves played.`}
          />
        )}
        <div className="wt-stage__side">
          <PlayerLine p={game.white} />
        </div>
      </div>
      <div className="wt-stage__info">
        <div className="wt-stage__status">
          <LiveBadge live={game.live} />
          <p aria-live="polite">{game.statusText}</p>
        </div>
        {game.delayNote && <p className="wt-muted">{game.delayNote}</p>}
        {stale && game.live && (
          <p className="wt-stale" role="status">
            Connection lost — reconnecting…
          </p>
        )}
        <MoveList moves={game.moves} />
      </div>
    </div>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="wt-game" aria-label={title}>
      <BackToWatch />
      <h1 className="wt-game__title">{title}</h1>
      {children}
    </section>
  );
}

export function TvGameView({ id }: { id: string }) {
  const [finished, setFinished] = useState(false);
  const r = usePolled((s) => fetchTvGame(id, s), finished ? 0 : 3000, true, id);
  useEffect(() => {
    if (r.data && !r.data.live) setFinished(true);
  }, [r.data]);

  if (r.status === "loading") return <Frame title="Live game"><Notice title="Finding live chess..." /></Frame>;
  if (!r.data)
    return (
      <Frame title="Live game">
        <Notice tone="error" title="Live chess is temporarily unavailable." onRetry={r.retry} />
      </Frame>
    );
  return (
    <Frame title={r.data.event ? `Live game · ${r.data.event}` : "Live game"}>
      <GameStage game={r.data} stale={r.stale} />
    </Frame>
  );
}

export function RoundView({ id, index }: { id: string; index: number }) {
  const [allDone, setAllDone] = useState(false);
  const r = usePolled((s) => fetchBroadcastRound(id, s), allDone ? 0 : 6000, true, id);
  useEffect(() => {
    if (r.data && r.data.length > 0 && r.data.every((g) => !g.live)) setAllDone(true);
  }, [r.data]);

  if (r.status === "loading") return <Frame title="Live broadcast"><Notice title="Finding live chess..." /></Frame>;
  if (!r.data)
    return (
      <Frame title="Live broadcast">
        <Notice tone="error" title="Live chess is temporarily unavailable." onRetry={r.retry} />
      </Frame>
    );
  const games = r.data;
  if (!games.length)
    return (
      <Frame title="Live broadcast">
        <Notice title="No games in this broadcast yet.">Check back soon for more chess.</Notice>
      </Frame>
    );
  const sel = Math.min(Math.max(index, 0), games.length - 1);
  const game = games[sel];
  const liveCount = games.filter((g) => g.live).length;
  return (
    <Frame title={game.event ?? "Live broadcast"}>
      {liveCount === 0 && <p className="wt-muted">This broadcast has ended.</p>}
      <GameStage game={game} stale={r.status === "error"} />
      <nav className="wt-roundlist" aria-label="Games in this broadcast">
        <h2 className="wt-h2">Games ({games.length})</h2>
        <ul>
          {games.map((g, i) => (
            <li key={g.key}>
              <Link
                href={`/watch?round=${encodeURIComponent(id)}&g=${i}`}
                replace
                scroll={false}
                aria-current={i === sel ? "true" : undefined}
                className="wt-roundlist__item"
              >
                <span className="wt-roundlist__names">
                  {g.white.name} <span aria-hidden="true">–</span>
                  <span className="wt-sr"> versus </span> {g.black.name}
                </span>
                <span className="wt-roundlist__state">{g.live ? <LiveBadge /> : g.statusText}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Frame>
  );
}
