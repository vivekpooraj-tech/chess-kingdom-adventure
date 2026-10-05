"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPlayedGames, localDateString, type PlayedGameRow } from "@/lib/supabase/queries";
import { buildOverview, MIN_GAMES_FOR_RATE, type PlayerOverview } from "@/lib/stats/playerStats";
import { useWorld, useWorldResolved } from "@/lib/world/WorldContext";

/**
 * Client islands of the Master Training Atelier Home. Each shows only real data and is fetched
 * only once the world is known to be Atelier, so Enchanted Kingdom and Classic Pro never pay for it
 * (same approach as ClassicCareer).
 */

function useAtelierActive(): boolean {
  const world = useWorld();
  const resolved = useWorldResolved();
  return resolved && world === "atelier";
}

// useLayoutEffect warns during server rendering; this hook is a plain effect there.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function partOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Runs while the HTML is parsed — before first paint and before React hydrates — so a hard load never shows a
// wrong part of day. React is told to leave this one text node alone (suppressHydrationWarning), and a layout
// effect keeps it right on client-side navigations (where no server HTML, and so no script, is involved).
const GREETING_SCRIPT = `(function(){var e=document.getElementById("at-greeting-part");if(!e)return;var h=new Date().getHours();e.textContent=h<12?"Good morning":h<18?"Good afternoon":"Good evening"})()`;

/** "Good evening, Leo." — the part of day comes from the viewer's own clock (the server cannot know it). */
export function AtelierGreeting({ name }: { name: string }) {
  const [part, setPart] = useState("Good evening");
  useIsoLayoutEffect(() => {
    setPart(partOfDay());
  }, []);
  return (
    <h1 className="at-greeting">
      <span id="at-greeting-part" suppressHydrationWarning>
        {part}
      </span>
      , <em>{name}</em>.
      <script dangerouslySetInnerHTML={{ __html: GREETING_SCRIPT }} />
    </h1>
  );
}

type Loaded = { games: PlayedGameRow[]; overview: PlayerOverview };

/** Rating series (oldest -> newest) from the games' real recorded ratings. */
function ratingSeries(games: PlayedGameRow[]): number[] {
  return [...games]
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
    .map((g) => g.ratingAfter)
    .filter((v): v is number => typeof v === "number")
    .slice(-24);
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 200;
  const h = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`);
  return (
    <svg className="at-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Rating over your last ${values.length} rated results`}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Training Performance / Your Form — rating, peak, games, score rate and the rating line. */
export function AtelierForm({ childId, rating }: { childId: string; rating: number | null }) {
  const active = useAtelierActive();
  const [data, setData] = useState<Loaded | "loading" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getPlayedGames(createClient(), childId, 200)
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

  const loading = data === "loading";
  const overview = typeof data === "object" ? data.overview : null;
  const series = typeof data === "object" ? ratingSeries(data.games) : [];
  const rate =
    overview?.rate.kind === "ok" ? `${Math.round(overview.rate.value * 100)}%` : "—";
  const rateNote =
    overview?.rate.kind === "insufficient"
      ? `After ${MIN_GAMES_FOR_RATE} games`
      : overview?.rate.kind === "none"
        ? "No games yet"
        : "Score rate";
  const peak = overview?.peak.kind === "ok" ? String(overview.peak.value) : "—";
  const dash = (v: string | number) => (loading || data === "error" ? "…" : v);

  return (
    <section className="at-card at-form" aria-labelledby="at-form-title" aria-busy={loading}>
      <div className="at-card__head">
        <div>
          <p className="at-eyebrow">Training performance</p>
          <h2 id="at-form-title" className="at-h2">Your form</h2>
        </div>
        <Link href="/stats" className="at-link">Full stats</Link>
      </div>
      <dl className="at-stats">
        <div>
          <dt>Rating</dt>
          <dd>{typeof rating === "number" ? rating : "—"}</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{dash(peak)}</dd>
        </div>
        <div>
          <dt>Games</dt>
          <dd>{dash(overview?.record.games ?? 0)}</dd>
        </div>
        <div>
          <dt>{loading ? "Score rate" : rateNote}</dt>
          <dd>{dash(rate)}</dd>
        </div>
      </dl>
      {series.length >= 2 ? (
        <div className="at-trend">
          <span className="at-eyebrow">Rating trend</span>
          <Sparkline values={series} />
        </div>
      ) : (
        !loading && <p className="at-note">Your rating line appears after a couple of rated games.</p>
      )}
    </section>
  );
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Training Momentum — streak plus the last seven days, from real per-day Chess Mind activity. */
export function AtelierMomentum({ childId, streak }: { childId: string; streak: number }) {
  const active = useAtelierActive();
  const [dates, setDates] = useState<Set<string> | "loading" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const since = new Date(Date.now() - 7 * 86_400_000);
    createClient()
      .from("child_chess_mind_activity")
      .select("activity_date")
      .eq("child_id", childId)
      .gte("activity_date", localDateString(since))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setDates("error");
        else setDates(new Set((data ?? []).map((r) => r.activity_date as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [active, childId]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    return { key: localDateString(d), label: DAY_LABELS[d.getDay()], today: i === 6 };
  });
  const have = typeof dates === "object" && "has" in dates ? dates : null;
  const activeCount = have ? days.filter((d) => have.has(d.key)).length : null;

  return (
    <section className="at-card at-momentum" aria-labelledby="at-momentum-title">
      <p className="at-eyebrow">Consistency</p>
      <h2 id="at-momentum-title" className="at-h2">Training momentum</h2>
      <p className="at-momentum__big">
        <span>{streak}</span> day{streak === 1 ? "" : "s"} in a row
      </p>
      <ol className="at-week" aria-label="Chess Mind activity over the last seven days">
        {days.map((d) => {
          const on = have ? have.has(d.key) : false;
          return (
            <li key={d.key} className={`at-week__day${on ? " is-on" : ""}${d.today ? " is-today" : ""}`}>
              <span className="at-week__dot" aria-hidden="true" />
              <span className="at-week__label">{d.label}</span>
              <span className="sr-only">{on ? "trained" : "no training"}{d.today ? ", today" : ""}</span>
            </li>
          );
        })}
      </ol>
      <p className="at-note">
        {activeCount === null ? "Loading this week…" : `${activeCount} of the last 7 days trained.`}
      </p>
    </section>
  );
}
