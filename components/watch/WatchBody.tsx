"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LiveBadge, Notice } from "./Parts";
import { RoundView, TvGameView } from "./GameView";
import { useWorld } from "@/lib/world/WorldContext";
import { usePolled } from "@/lib/watch/usePolled";
import { fetchLiveBroadcasts, fetchTv, type BroadcastCard, type TvEntry } from "@/lib/watch/lichess";

/**
 * /watch — live chess from Lichess, in three world presentations.
 * ONE data layer (lib/watch), ONE set of sections, three looks: Enchanted (an adventure of glowing cards), Atelier (an editorial,
 * ruled programme), Classic (a refined broadcast board). Presentation only: the world changes the title, the section ornaments and the CSS
 * (.wt--enchanted / .wt--atelier / .wt--classic in app/world-watch.css); data, routes and behaviour are identical. Free for everyone.
 *
 * Routes (all /watch, so the one bottom-nav Watch button owns them):  /watch · /watch?tv=<gameId> · /watch?round=<roundId>&g=<n>
 */
const COPY = {
  enchanted: { title: "Watch a Chess Adventure", kicker: "Watch" },
  atelier: { title: "Live Chess", kicker: "Watch" },
  classic: { title: "Live Chess", kicker: "Watch" },
} as const;

const ORNAMENT = { live: "🔴", tournaments: "🏆", rapid: "⚡", featured: "🌟" } as const;

function Section({
  id,
  label,
  orn,
  world,
  children,
}: {
  id: string;
  label: string;
  orn: keyof typeof ORNAMENT;
  world: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wt-section" aria-labelledby={`wt-${id}`}>
      <h2 className="wt-h2" id={`wt-${id}`}>
        {world === "enchanted" && <span aria-hidden="true" className="wt-orn">{ORNAMENT[orn]}</span>}
        {label}
      </h2>
      {children}
    </section>
  );
}

function TvCard({ e }: { e: TvEntry }) {
  return (
    <li>
      <Link href={`/watch?tv=${encodeURIComponent(e.gameId)}`} className="wt-card" data-kind="tv">
        <span className="wt-card__top">
          <span className="wt-card__channel">{e.channel === "Top Rated" ? "Lichess TV" : e.channel}</span>
          <LiveBadge />
        </span>
        <span className="wt-card__main">
          {e.player.title && <abbr className="wt-title" title={e.player.title}>{e.player.title}</abbr>}
          {e.player.name}
          {e.player.rating !== undefined && <span className="wt-rating">{e.player.rating}</span>}
        </span>
        <span className="wt-card__sub">Live game · tap to watch</span>
      </Link>
    </li>
  );
}

function BroadcastItem({ b }: { b: BroadcastCard }) {
  return (
    <li>
      <Link href={`/watch?round=${encodeURIComponent(b.roundId)}&g=0`} className="wt-card" data-kind="broadcast">
        <span className="wt-card__top">
          <span className="wt-card__channel">Live Broadcast</span>
          <LiveBadge />
        </span>
        <span className="wt-card__main">{b.name}</span>
        <span className="wt-card__sub">{b.roundName}</span>
      </Link>
    </li>
  );
}

function Home() {
  const world = useWorld();
  const tv = usePolled(fetchTv, 30000);
  const bc = usePolled(fetchLiveBroadcasts, 60000);

  const loading = tv.status === "loading" && bc.status === "loading";
  const tvList = tv.data ?? [];
  const bcList = bc.data ?? [];
  const nothingYet = tv.data === null && bc.data === null;
  const bothFailed = tv.status === "error" && bc.status === "error" && nothingYet;
  const byChannel = (...names: string[]) => tvList.filter((e) => names.includes(e.channel));
  const top = byChannel("Top Rated");
  const rapid = byChannel("Rapid", "Blitz");
  const featured = byChannel("Classical", "Bullet");
  const anything = top.length + bcList.length + rapid.length + featured.length > 0;
  const settled = tv.data !== null && bc.data !== null;
  const partial = (tv.status === "error" && tv.data === null) !== (bc.status === "error" && bc.data === null);

  return (
    <>
      {loading && <Notice title="Finding live chess..." />}
      {bothFailed && <Notice tone="error" title="Live chess is temporarily unavailable." onRetry={() => { tv.retry(); bc.retry(); }} />}
      {partial && (
        <Notice tone="error" title="Some live chess is temporarily unavailable." onRetry={tv.status === "error" ? tv.retry : bc.retry} />
      )}
      {top.length > 0 && (
        <Section id="live" label="Live now" orn="live" world={world}>
          <ul className="wt-grid">{top.map((e) => <TvCard key={e.gameId} e={e} />)}</ul>
        </Section>
      )}
      {bcList.length > 0 && (
        <Section id="tournaments" label="Tournaments" orn="tournaments" world={world}>
          <ul className="wt-grid">{bcList.map((b) => <BroadcastItem key={b.roundId} b={b} />)}</ul>
        </Section>
      )}
      {rapid.length > 0 && (
        <Section id="rapid" label="Rapid & blitz" orn="rapid" world={world}>
          <ul className="wt-grid">{rapid.map((e) => <TvCard key={e.gameId} e={e} />)}</ul>
        </Section>
      )}
      {featured.length > 0 && (
        <Section id="featured" label="Featured" orn="featured" world={world}>
          <ul className="wt-grid">{featured.map((e) => <TvCard key={e.gameId} e={e} />)}</ul>
        </Section>
      )}
      {settled && !anything && (
        <Notice title="No live broadcasts right now.">Check back soon for more chess.</Notice>
      )}
      <p className="wt-credit">
        Live games and broadcasts from{" "}
        <a href="https://lichess.org" target="_blank" rel="noopener noreferrer">
          Lichess
        </a>
        . Watching is free.
      </p>
    </>
  );
}

export function WatchBody() {
  const world = useWorld();
  const params = useSearchParams();
  const tv = params.get("tv");
  const round = params.get("round");
  const g = parseInt(params.get("g") ?? "0", 10);
  const copy = COPY[world];

  if (tv) return <div className={`wt wt--${world}`}><TvGameView id={tv} /></div>;
  if (round) return <div className={`wt wt--${world}`}><RoundView id={round} index={Number.isFinite(g) ? g : 0} /></div>;

  return (
    <div className={`wt wt--${world}`}>
      <header className="wt-head">
        <p className="wt-kicker">{copy.kicker}</p>
        <h1 className="wt-title-h1">{copy.title}</h1>
        <p className="wt-sub">Watch chess happening around the world.</p>
      </header>
      <Home />
    </div>
  );
}
