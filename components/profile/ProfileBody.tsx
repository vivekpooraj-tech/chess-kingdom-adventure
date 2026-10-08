"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { Avatar } from "@/components/ui/Avatar";
import { FlameIcon } from "@/components/nav/icons";
import { ModePicker } from "@/components/mode/ModePicker";

/**
 * Profile in three world presentations. The page (app/profile/page.tsx, a server component) owns ALL data and logic: the child, every
 * query, the avatar / zone / piece set / board skin lookups. This component only lays the same real values out three ways, and places the
 * shared components the page passes in (the Chess Journey panel, the achievements, the For Parents entry) without touching them:
 *   Enchanted: a Kingdom identity card, medal stats and quest-style customise cards.
 *   Atelier:   a player dossier: a large editorial name, a ruled record, customisation as an index.
 *   Classic:   a player record: spacious identity, a ledger of figures, ruled customisation.
 * The Chess Mind Experience selector (components/mode/ModePicker, the same control and the same state as More) sits under Customize.
 * Nothing here changes data, links or behaviour. Styles: `.pf-*` in app/world-profile.css, one section per world.
 */

export interface ProfileBodyProps {
  name: string;
  avatar: { emoji: string; colorFrom: string; colorTo: string };
  zone: { emoji: string; name: string } | null;
  day: { current: number; total: number; percent: number };
  streak: number;
  rating: number;
  todayRatingChange: number;
  pieces: { emoji: string; name: string };
  board: { emoji: string; name: string };
  stats: { emoji: string; value: string; label: string }[];
  openings: {
    discovered: number;
    gambits: number;
    studied: number;
    total: number;
    recent: { id: string; name: string; isGambit: boolean }[];
  };
  /** Shared, already-built components from the page: rendered as they are. */
  journey: ReactNode;
  achievements: ReactNode;
  parents: ReactNode;
}

const delta = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Customize({ p, cls }: { p: ProfileBodyProps; cls: string }) {
  const rows = [
    { key: "pieces", title: "Change Pieces", now: p.pieces },
    { key: "board", title: "Change Board", now: p.board },
  ];
  return (
    <ul className={`${cls}-custom`} aria-label="Customize">
      {rows.map((r) => (
        <li key={r.key}>
          <Link href="/profile/customize" className={`${cls}-custom__row`}>
            <span className={`${cls}-custom__icon`} aria-hidden="true">{r.now.emoji}</span>
            <span className={`${cls}-custom__text`}>
              <span className={`${cls}-custom__title`}>{r.title}</span>
              <span className={`${cls}-custom__now`}>Currently {r.now.name}</span>
            </span>
            <span className={`${cls}-custom__go`} aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Openings({ p, cls }: { p: ProfileBodyProps; cls: string }) {
  const o = p.openings;
  return (
    <section className={`${cls}-openings`} aria-labelledby={`${cls}-openings-title`}>
      <div className={`${cls}-openings__head`}>
        <h2 id={`${cls}-openings-title`} className={`${cls}-h2`}>Openings Discovered</h2>
        <Link href="/academy/openings" className={`${cls}-link`}>Explore Openings →</Link>
      </div>
      <dl className={`${cls}-openings__figures`}>
        <div><dt>Discovered</dt><dd>{o.discovered}</dd></div>
        <div><dt>Gambits</dt><dd>{o.gambits}</dd></div>
        <div><dt>Studied</dt><dd>{o.studied}/{o.total}</dd></div>
      </dl>
      {o.recent.length > 0 && (
        <div className={`${cls}-recent`}>
          <p className={`${cls}-label`}>Recently Discovered</p>
          <ul>
            {o.recent.map((r) => (
              <li key={r.id} className={r.isGambit ? "is-gambit" : undefined}>{r.name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RatingDelta({ n, cls }: { n: number; cls: string }) {
  if (n === 0) return null;
  return <span className={`${cls}-delta ${n > 0 ? "is-up" : "is-down"}`}>{delta(n)} today</span>;
}

function DayLine({ p, cls }: { p: ProfileBodyProps; cls: string }) {
  if (p.day.total <= 0) return null;
  return (
    <div className={`${cls}-day`}>
      <p>
        <span>Day {Math.min(p.day.current, p.day.total)} of {p.day.total}</span>
        <span>{p.day.percent}%</span>
      </p>
      <span className={`${cls}-meter`} role="img" aria-label={`${p.day.percent}% of the Kingdom Story Map`}>
        <span style={{ width: `${p.day.percent}%` }} />
      </span>
    </div>
  );
}

/* ------------------------------ Enchanted ------------------------------ */
function Enchanted(p: ProfileBodyProps) {
  return (
    <div className="pf pf-en">
      <header className="pf-en-id world-enter">
        <Avatar size="lg" emoji={p.avatar.emoji} colorFrom={p.avatar.colorFrom} colorTo={p.avatar.colorTo} />
        <div className="pf-en-id__text">
          <p className="world-kicker">Your Kingdom</p>
          <h1 className="pf-en-id__name">{p.name}</h1>
          {p.zone && <p className="pf-en-id__zone"><span aria-hidden="true">{p.zone.emoji}</span> {p.zone.name}</p>}
          {p.streak > 0 && (
            <p className="pf-en-streak"><FlameIcon className="h-4 w-4" /> {p.streak}-day streak</p>
          )}
        </div>
        <DayLine p={p} cls="pf-en" />
      </header>

      <div className="pf-en-rating">
        <div>
          <p className="pf-en-label">Chess Rating</p>
          <p className="pf-en-rating__value">{p.rating.toLocaleString()}</p>
        </div>
        <RatingDelta n={p.todayRatingChange} cls="pf-en" />
      </div>

      <section className="pf-en-section" aria-labelledby="pf-en-custom">
        <h2 id="pf-en-custom" className="pf-en-label">Customize</h2>
        <Customize p={p} cls="pf-en" />
      </section>

      <ModePicker variant="profile" cls="pf-en" />

      {p.journey}

      <section className="pf-en-section" aria-labelledby="pf-en-stats">
        <h2 id="pf-en-stats" className="pf-en-label">Your Stats</h2>
        <ul className="pf-en-stats">
          {p.stats.map((s) => (
            <li key={s.label} className="pf-en-stat">
              <span className="pf-en-stat__medal" aria-hidden="true">{s.emoji}</span>
              <span className="pf-en-stat__value">{s.value}</span>
              <span className="pf-en-stat__label">{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <Openings p={p} cls="pf-en" />
      {p.achievements}
      {p.parents}
    </div>
  );
}

/* ------------------------------- Atelier -------------------------------- */
function Atelier(p: ProfileBodyProps) {
  return (
    <div className="pf pf-at">
      <header className="pf-at-mast">
        <p className="pf-at-eyebrow">Player profile</p>
        <h1 className="pf-at-name">{p.name}</h1>
        <div className="pf-at-who">
          <Avatar size="sm" emoji={p.avatar.emoji} colorFrom={p.avatar.colorFrom} colorTo={p.avatar.colorTo} />
          {p.zone && <span><span aria-hidden="true">{p.zone.emoji}</span> {p.zone.name}</span>}
          {p.streak > 0 && <span className="pf-at-streak"><FlameIcon className="h-4 w-4" /> {p.streak}-day streak</span>}
        </div>
      </header>

      <div className="pf-at-grid">
        <div className="pf-at-main">
          <div className="pf-at-rating">
            <p className="pf-at-eyebrow">Chess rating</p>
            <p className="pf-at-rating__value">{p.rating.toLocaleString()}</p>
            <RatingDelta n={p.todayRatingChange} cls="pf-at" />
          </div>
          <DayLine p={p} cls="pf-at" />
          <section aria-labelledby="pf-at-custom">
            <h2 id="pf-at-custom" className="pf-at-eyebrow">Customize</h2>
            <Customize p={p} cls="pf-at" />
          </section>
          <ModePicker variant="profile" cls="pf-at" />
        </div>

        <div className="pf-at-side">
          {p.journey}
          <section aria-labelledby="pf-at-stats">
            <h2 id="pf-at-stats" className="pf-at-eyebrow">Your stats</h2>
            <dl className="pf-at-record">
              {p.stats.map((s) => (
                <div key={s.label} className="pf-at-record__row">
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <Openings p={p} cls="pf-at" />
        </div>
      </div>

      {p.achievements}
      {p.parents}
    </div>
  );
}

/* ------------------------------- Classic -------------------------------- */
function Classic(p: ProfileBodyProps) {
  return (
    <div className="pf pf-cl">
      <header className="pf-cl-id">
        <Avatar size="lg" emoji={p.avatar.emoji} colorFrom={p.avatar.colorFrom} colorTo={p.avatar.colorTo} />
        <div className="pf-cl-id__text">
          <p className="world-kicker">Player record</p>
          <h1 className="pf-cl-id__name">{p.name}</h1>
          {p.zone && <p className="pf-cl-id__zone"><span aria-hidden="true">{p.zone.emoji}</span> {p.zone.name}</p>}
          {p.streak > 0 && <p className="pf-cl-streak"><FlameIcon className="h-4 w-4" /> {p.streak}-day streak</p>}
        </div>
      </header>

      <div className="pf-cl-rating">
        <div>
          <p className="pf-cl-label">Chess rating</p>
          <p className="pf-cl-rating__value">{p.rating.toLocaleString()}</p>
        </div>
        <RatingDelta n={p.todayRatingChange} cls="pf-cl" />
      </div>
      <DayLine p={p} cls="pf-cl" />

      <section aria-labelledby="pf-cl-custom">
        <h2 id="pf-cl-custom" className="pf-cl-label">Customize</h2>
        <Customize p={p} cls="pf-cl" />
      </section>

      <ModePicker variant="profile" cls="pf-cl" />

      {p.journey}

      <section aria-labelledby="pf-cl-stats">
        <h2 id="pf-cl-stats" className="pf-cl-label">Your stats</h2>
        <dl className="pf-cl-ledger">
          {p.stats.map((s) => (
            <div key={s.label} className="pf-cl-ledger__cell">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Openings p={p} cls="pf-cl" />
      {p.achievements}
      {p.parents}
    </div>
  );
}

export function ProfileBody(props: ProfileBodyProps) {
  return <WorldBranch classic={<Classic {...props} />} atelier={<Atelier {...props} />} other={<Enchanted {...props} />} />;
}
