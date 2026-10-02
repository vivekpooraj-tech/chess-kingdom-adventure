"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPlayedGames, type PlayedGameRow } from "@/lib/supabase/queries";
import { buildOverview, MIN_GAMES_FOR_RATE, type PlayerOverview } from "@/lib/stats/playerStats";
import { getTimeControl } from "@/content/timeControls";
import { useWorld, useWorldResolved } from "@/lib/world/WorldContext";

const RECENT_LIMIT = 4;
const HISTORY_LIMIT = 200;

type Loaded = { games: PlayedGameRow[]; overview: PlayerOverview };

/** Opponents are never named — same child-safety rule as /games. */
function opponentLabel(g: PlayedGameRow): string {
  if (g.tournamentId) return "Tournament game";
  if (g.matchType === "random") return "Online opponent";
  return "Friend match";
}

function resultWord(result: PlayedGameRow["result"]): string {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  return "Draw";
}

function shortDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Classic Pro Home's Career Ledger + Recent Duels.
 *
 * Every figure comes from finished online_games via the same helpers /stats
 * and /games use. Only fetched once the world is known to be Classic, so the
 * other worlds' Home never pays for it.
 */
export function ClassicCareer({ childId, rating }: { childId: string; rating: number | null }) {
  const world = useWorld();
  const resolved = useWorldResolved();
  const active = resolved && world === "classic";
  const [data, setData] = useState<Loaded | "loading" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getPlayedGames(createClient(), childId, HISTORY_LIMIT)
      .then((games) => {
        if (!cancelled) setData({ games, overview: buildOverview(games, rating) });
      })
      .catch(() => {
        if (!cancelled) setData("error");
      });
    return () => {
      cancelled = true;
    };
  }, [active, childId, rating]);

  if (data === "error") return null;

  const loading = data === "loading";
  const overview = loading ? null : data.overview;
  const recent = loading ? [] : data.games.slice(0, RECENT_LIMIT);
  const record = overview?.record;

  const scoreValue =
    overview?.rate.kind === "ok" ? `${Math.round(overview.rate.value * 100)}%` : "—";
  const scoreNote =
    overview?.rate.kind === "insufficient"
      ? `After ${MIN_GAMES_FOR_RATE} games`
      : overview?.rate.kind === "none"
        ? "No games yet"
        : "Score rate";
  const peakValue = overview?.peak.kind === "ok" ? String(overview.peak.value) : "—";

  return (
    <>
      <section className="ch-section ch-ledger" aria-labelledby="ch-ledger-title" aria-busy={loading}>
        <div className="ch-section__head">
          <h2 id="ch-ledger-title" className="ch-label">Career ledger</h2>
          <Link href="/stats" className="ch-link">Full stats</Link>
        </div>
        <dl className="ch-card ch-ledger__grid">
          <div>
            <dt>Rating</dt>
            <dd>{typeof rating === "number" ? rating : "—"}</dd>
          </div>
          <div>
            <dt>Peak</dt>
            <dd>{loading ? "…" : peakValue}</dd>
          </div>
          <div>
            <dt>Games</dt>
            <dd>{loading ? "…" : record?.games ?? 0}</dd>
          </div>
          <div>
            <dt>W · D · L</dt>
            <dd className="ch-ledger__record">
              {loading || !record ? "…" : `${record.wins} · ${record.draws} · ${record.losses}`}
            </dd>
          </div>
          <div>
            <dt>{loading ? "Score rate" : scoreNote}</dt>
            <dd>{loading ? "…" : scoreValue}</dd>
          </div>
          <div>
            <dt>Win streak</dt>
            <dd>{loading ? "…" : overview?.streak ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="ch-section ch-duels" aria-labelledby="ch-duels-title" aria-busy={loading}>
        <div className="ch-section__head">
          <h2 id="ch-duels-title" className="ch-label">Recent duels</h2>
          <Link href="/games" className="ch-link">All games</Link>
        </div>
        {loading ? (
          <div className="ch-card h-[136px] animate-pulse" aria-hidden="true" />
        ) : recent.length === 0 ? (
          <div className="ch-card ch-duels__empty">
            <p>No finished games yet. Your rated and friend games will be recorded here.</p>
            <Link href="/matchmaking" className="ch-link">Play your first game</Link>
          </div>
        ) : (
          <ol className="ch-card ch-duels__list">
            {recent.map((g) => {
              const word = resultWord(g.result);
              const tc = g.timeControl ? getTimeControl(g.timeControl) : null;
              const delta =
                typeof g.ratingBefore === "number" && typeof g.ratingAfter === "number"
                  ? g.ratingAfter - g.ratingBefore
                  : null;
              return (
                <li key={g.id}>
                  <Link href={`/online/${g.id}`} className="ch-duel" data-result={g.result}>
                    <span className="ch-duel__result">{word}</span>
                    <span className="ch-duel__copy">
                      <span className="ch-duel__who">{opponentLabel(g)}</span>
                      <span className="ch-meta">
                        {g.color === "w" ? "White" : "Black"} ·{" "}
                        {tc ? `${tc.description} ${tc.label}` : "Untimed"} · {shortDate(g.playedAt)}
                      </span>
                    </span>
                    {delta !== null && (
                      <span className="ch-duel__delta" data-sign={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
