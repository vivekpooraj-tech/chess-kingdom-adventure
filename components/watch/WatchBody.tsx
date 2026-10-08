"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LiveBadge, Notice } from "./Parts";
import { CalendarView } from "./CalendarView";
import { RoundView, TvGameView } from "./GameView";
import { useWorld } from "@/lib/world/WorldContext";
import { usePolled } from "@/lib/watch/usePolled";
import { fetchBroadcasts, fetchTv, type BroadcastCard, type TvEntry, type UpcomingEvent } from "@/lib/watch/lichess";
import { whenLabel } from "@/lib/watch/format";

/**
 * /watch — a calm chess-TV page in three world presentations: LIVE NOW, UPCOMING, and a link to the calendar. Nothing else.
 * ONE data layer (lib/watch), ONE structure, three looks (.wt--enchanted / .wt--atelier / .wt--classic in app/world-watch.css). Free for
 * everyone and read-only. Routes (all /watch, so the one bottom-nav Watch button owns them):
 *   /watch · /watch?view=calendar · /watch?tv=<gameId> · /watch?round=<roundId>&g=<n>
 */
const COPY = {
  enchanted: { title: "Watch a Chess Adventure", kicker: "Watch" },
  atelier: { title: "Live Chess", kicker: "Watch" },
  classic: { title: "Live Chess", kicker: "Watch" },
} as const;

const ORNAMENT = { live: "🔴", upcoming: "📅" } as const;
const MAX_LIVE = 3;
const MAX_UPCOMING = 3;

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

function LiveCard({ href, kind, title, sub, title2 }: { href: string; kind: "tv" | "broadcast"; title: string; sub: string; title2?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="wt-card" data-kind={kind}>
        <span className="wt-card__top">
          <LiveBadge />
        </span>
        <span className="wt-card__main">{title2 ?? title}</span>
        <span className="wt-card__sub">{sub}</span>
        <span className="wt-card__go" aria-hidden="true">Watch Live →</span>
        <span className="wt-sr">Watch live: {title}</span>
      </Link>
    </li>
  );
}

function BroadcastItem({ b }: { b: BroadcastCard }) {
  return <LiveCard href={`/watch?round=${encodeURIComponent(b.roundId)}&g=0`} kind="broadcast" title={b.name} sub={b.roundName} />;
}

function TvItem({ e }: { e: TvEntry }) {
  return (
    <LiveCard
      href={`/watch?tv=${encodeURIComponent(e.gameId)}`}
      kind="tv"
      title={e.player.name}
      sub="Live game"
      title2={
        <>
          {e.player.title && <abbr className="wt-title" title={e.player.title}>{e.player.title}</abbr>}
          {e.player.name}
          {e.player.rating !== undefined && <span className="wt-rating">{e.player.rating}</span>}
        </>
      }
    />
  );
}

export function UpcomingRow({ u, now }: { u: UpcomingEvent; now: number }) {
  return (
    <li className="wt-up">
      <span className="wt-up__name">{u.name}</span>
      <time className="wt-up__when" dateTime={new Date(u.startsAt).toISOString()}>
        {whenLabel(u.startsAt, now)}
      </time>
    </li>
  );
}

function Home() {
  const world = useWorld();
  const tv = usePolled(fetchTv, 30000);
  const bc = usePolled((s) => fetchBroadcasts(s, 40), 60000);
  const now = Date.now();

  const top = (tv.data ?? []).filter((e) => e.channel === "Top Rated");
  const liveBroadcasts = (bc.data?.live ?? []).slice(0, MAX_LIVE);
  const upcoming = (bc.data?.upcoming ?? []).slice(0, MAX_UPCOMING);
  const liveCount = liveBroadcasts.length + top.length;

  const liveLoading = bc.status === "loading" && tv.status === "loading";
  const liveFailed = liveCount === 0 && bc.data === null && tv.data === null && bc.status === "error" && tv.status === "error";
  const liveEmpty = !liveLoading && !liveFailed && liveCount === 0 && (bc.data !== null || tv.data !== null);
  const upLoading = bc.status === "loading";
  const upFailed = bc.status === "error" && bc.data === null;
  const retryAll = () => { tv.retry(); bc.retry(); };

  return (
    <>
      <Section id="live" label="Live now" orn="live" world={world}>
        {liveLoading && <Notice title="Finding live chess..." />}
        {liveFailed && <Notice tone="error" title="Live chess is temporarily unavailable." onRetry={retryAll} />}
        {liveEmpty && <p className="wt-empty">No live games right now.</p>}
        {liveCount > 0 && (
          <ul className="wt-grid">
            {liveBroadcasts.map((b) => <BroadcastItem key={b.roundId} b={b} />)}
            {top.slice(0, 1).map((e) => <TvItem key={e.gameId} e={e} />)}
          </ul>
        )}
      </Section>

      <Section id="upcoming" label="Upcoming" orn="upcoming" world={world}>
        {upLoading && <p className="wt-empty" role="status">Finding upcoming events...</p>}
        {upFailed && <Notice tone="error" title="Couldn't load upcoming events." onRetry={bc.retry} />}
        {bc.data && upcoming.length === 0 && <p className="wt-empty">No upcoming chess events right now.</p>}
        {upcoming.length > 0 && (
          <>
            <ul className="wt-uplist">{upcoming.map((u) => <UpcomingRow key={u.tourId} u={u} now={now} />)}</ul>
            <Link href="/watch?view=calendar" className="wt-more" data-cal>
              View Calendar →
            </Link>
          </>
        )}
      </Section>
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
  if (params.get("view") === "calendar") return <div className={`wt wt--${world}`}><CalendarView /></div>;

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
