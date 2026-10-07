"use client";

import Link from "next/link";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { DISCOVER_SECTIONS, type DiscoverSection } from "@/content/discoverIndex";

/**
 * /discover in three world presentations. ONE data source (content/discoverIndex.ts), three compositions:
 *   Enchanted: discoveries as destinations: a featured first discovery, then the rest as adventure cards; coming-soon ones are sealed.
 *   Atelier:   a curated resource room: the first as the lead, the rest as a numbered index; coming-soon rows are quiet.
 *   Classic:   a library: the available collections as shelf tiles, the forthcoming ones as ruled lines.
 * Presentation only: sections, copy and routes are identical in every world. Styles: `.dc-*` in app/world-discover.css, one section
 * per world (`.dc-en`, `.dc-at`, `.dc-cl`).
 */

const available = DISCOVER_SECTIONS.filter((s) => s.href && !s.soon);
const coming = DISCOVER_SECTIONS.filter((s) => s.soon || !s.href);
const pad = (n: number) => String(n).padStart(2, "0");
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

function Back() {
  return (
    <Link href="/home" className="dc-back">
      Back to Home
    </Link>
  );
}

function Soon() {
  return <span className="dc-soon">SOON</span>;
}

/* ------------------------------ Enchanted ------------------------------ */
function Enchanted() {
  const [first, ...rest] = available;
  return (
    <div className="dc dc-en">
      <header className="dc-en__head world-enter">
        <p className="world-kicker">Explore</p>
        <h1 className="dc-en__title">Discover</h1>
        <p className="dc-en__lede">Where chess came from, and the stories behind the pieces.</p>
      </header>

      {first && (
        <Link href={first.href!} className="dc-en-feature world-enter">
          <span className="dc-en-feature__orb" aria-hidden="true">{first.emoji}</span>
          <span className="dc-en-feature__text">
            <span className="dc-en-feature__label">Start exploring</span>
            <span className="dc-en-feature__title">{first.title}</span>
            <span className="dc-en-feature__desc">{first.description}</span>
          </span>
          <span className="dc-en-feature__cta" aria-hidden="true">→</span>
        </Link>
      )}

      <ul className="dc-en-grid" aria-label="More to discover">
        {rest.map((s: DiscoverSection, i) => (
          <li key={s.id} className="world-enter">
            <Link href={s.href!} className={`dc-en-card dc-en-card--${i % 2}`}>
              <span className="dc-en-card__medal" aria-hidden="true">{s.emoji}</span>
              <span className="dc-en-card__text">
                <span className="dc-en-card__title">{s.title}</span>
                <span className="dc-en-card__desc">{s.description}</span>
              </span>
              <span className="dc-en-card__go" aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
        {coming.map((s) => (
          <li key={s.id}>
            <div className="dc-en-card dc-en-card--soon">
              <span className="dc-en-card__medal" aria-hidden="true">{s.emoji}</span>
              <span className="dc-en-card__text">
                <span className="dc-en-card__title">{s.title}</span>
                <span className="dc-en-card__desc">{s.description}</span>
              </span>
              <Soon />
            </div>
          </li>
        ))}
      </ul>
      <Back />
    </div>
  );
}

/* ------------------------------- Atelier -------------------------------- */
function Atelier() {
  const [first, ...rest] = available;
  return (
    <div className="dc dc-at">
      <header className="dc-at-mast">
        <p className="dc-at-eyebrow">Explore</p>
        <h1 className="dc-at-title">Discover</h1>
        <p className="dc-at-lede">Where chess came from, and the stories behind the pieces.</p>
      </header>

      <div className="dc-at-grid">
        {first && (
          <Link href={first.href!} className="dc-at-lead">
            <span className="dc-at-eyebrow">01 · Start here</span>
            <span className="dc-at-lead__title">{first.title}</span>
            <span className="dc-at-lead__desc">{first.description}</span>
            <span className="dc-at-cta">
              Open <span aria-hidden="true">→</span>
            </span>
          </Link>
        )}

        <ol className="dc-at-index" aria-label="More to discover">
          {rest.map((s, i) => (
            <li key={s.id}>
              <Link href={s.href!} className="dc-at-row">
                <span className="dc-at-row__no" aria-hidden="true">{pad(i + 2)}</span>
                <span className="dc-at-row__text">
                  <span className="dc-at-row__title">{s.title}</span>
                  <span className="dc-at-row__desc">{s.description}</span>
                </span>
                <span className="dc-at-row__go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
          {coming.map((s, i) => (
            <li key={s.id}>
              <div className="dc-at-row dc-at-row--soon">
                <span className="dc-at-row__no" aria-hidden="true">{pad(rest.length + i + 2)}</span>
                <span className="dc-at-row__text">
                  <span className="dc-at-row__title">{s.title}</span>
                  <span className="dc-at-row__desc">{s.description}</span>
                </span>
                <Soon />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <Back />
    </div>
  );
}

/* ------------------------------- Classic -------------------------------- */
function Classic() {
  return (
    <div className="dc dc-cl">
      <header className="dc-cl-top">
        <p className="world-kicker">Library</p>
        <h1 className="dc-cl-title">Discover</h1>
        <p className="dc-cl-lede">Where chess came from, and the stories behind the pieces.</p>
      </header>

      <section aria-labelledby="dc-cl-available">
        <h2 id="dc-cl-available" className="dc-cl-label">Collections</h2>
        <ul className="dc-cl-shelf">
          {available.map((s, i) => (
            <li key={s.id}>
              <Link href={s.href!} className="dc-cl-tile">
                <span className="dc-cl-tile__no" aria-hidden="true">{ROMAN[i]}</span>
                <span className="dc-cl-tile__emoji" aria-hidden="true">{s.emoji}</span>
                <span className="dc-cl-tile__title">{s.title}</span>
                <span className="dc-cl-tile__desc">{s.description}</span>
                <span className="dc-cl-tile__go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {coming.length > 0 && (
        <section aria-labelledby="dc-cl-forthcoming">
          <h2 id="dc-cl-forthcoming" className="dc-cl-label">Forthcoming</h2>
          <ul className="dc-cl-list">
            {coming.map((s) => (
              <li key={s.id} className="dc-cl-row">
                <span className="dc-cl-row__text">
                  <span className="dc-cl-row__title">{s.title}</span>
                  <span className="dc-cl-row__desc">{s.description}</span>
                </span>
                <Soon />
              </li>
            ))}
          </ul>
        </section>
      )}
      <Back />
    </div>
  );
}

export function DiscoverBody() {
  return <WorldBranch classic={<Classic />} atelier={<Atelier />} other={<Enchanted />} />;
}
