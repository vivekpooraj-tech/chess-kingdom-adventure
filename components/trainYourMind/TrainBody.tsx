"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { FlameIcon } from "@/components/nav/icons";
import { backLabel } from "@/lib/navigation/destinations";
import type { ChessMindCategory } from "@/content/chessMindCategories";
import type { UnlockedBonus } from "@/lib/chessMind/kingdomUnlocks";
import type { WorldVoice } from "@/lib/trainYourMind/worldVoice";
import type { UsageSnapshot } from "@/lib/trainYourMind/dailyUsage";
import type { TrainModule } from "@/lib/trainYourMind/dailyLimitRules";
import { levelProgress, statusLabel, type ProgressState } from "@/lib/trainYourMind/progression";
import { isTrainCategory } from "@/lib/trainYourMind/curriculum";

/**
 * Train Your Mind in three world presentations. The page (app/chess-mind/page.tsx) owns ALL data and logic (the child, the server's daily
 * counts, progression, streak, Ollie's notes); this component only lays the same real values out three ways:
 *   Enchanted: quest cards (a featured daily quest, then the eight paths as a grid of quests).
 *   Atelier:   an editorial session (today's session as the lead, the eight disciplines as a numbered index).
 *   Classic:   a study desk (today's challenge, then the eight disciplines as ruled tiles).
 * Nothing here changes categories, limits, progression or routes. Styles: `.tm-*` in app/world-train.css, one section per world
 * (`.tm-en`, `.tm-at`, `.tm-cl`).
 */

export interface TrainBodyProps {
  voice: WorldVoice;
  loaded: boolean;
  categories: ChessMindCategory[];
  stats: Record<string, number>;
  progress: Record<string, ProgressState>;
  usage: Partial<Record<TrainModule, UsageSnapshot>> | null;
  streak: number;
  dailyCategory: ChessMindCategory | undefined;
  dailyDoneToday: boolean;
  continueCategory: ChessMindCategory | undefined;
  bonuses: UnlockedBonus[];
  /** Ollie's note and the Chess Brain panel: shared real-data components, placed by each world. */
  extras: ReactNode;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Level + progress for one training path: a name and a few small steps, no dashboards. */
export function TrainStatus({
  state,
  category,
  fallbackScore,
}: {
  state: ProgressState | null;
  category: Parameters<typeof statusLabel>[1];
  fallbackScore: number;
}) {
  const label = statusLabel(state, category);
  if (!state || state.attempts === 0) {
    return (
      <p className="tm-status tm-status--new">
        {fallbackScore > 0 ? "Pick up where you left off — now with levels" : "Not started · begins at Foundation"}
      </p>
    );
  }
  const p = levelProgress(state);
  return (
    <div className="tm-status">
      <p className="tm-status__label">
        {label}
        {state.mastered ? " ★" : ""}
      </p>
      {!state.mastered && (
        <span className="tm-steps" aria-label={`${p.have} of ${p.need} to the next level`}>
          {Array.from({ length: p.need }, (_, i) => (
            <span key={i} className={i < p.have ? "on" : ""} />
          ))}
        </span>
      )}
    </div>
  );
}

/** "n / 3 today" for one category (free accounts only): the server's count. */
export function UsageLine({ usage }: { usage: UsageSnapshot | null }) {
  if (!usage || usage.isPremium || usage.limit === null) return null;
  const done = usage.usedToday >= usage.limit;
  const used = Math.min(usage.usedToday, usage.limit);
  return (
    <p className={`tm-usage${done ? " is-done" : ""}`}>
      <span className="tm-pips" aria-hidden="true">
        {Array.from({ length: usage.limit }, (_, i) => (
          <span key={i} className={i < used ? "on" : ""} />
        ))}
      </span>
      {used} / {usage.limit} today{done ? " · done for today" : ""}
    </p>
  );
}

function FreeNote({ usage, loaded }: Pick<TrainBodyProps, "usage" | "loaded">) {
  if (!(loaded && usage && !Object.values(usage).some((u) => u?.isPremium))) return null;
  return (
    <p className="tm-note" role="status">
      Free training: 3 exercises per category, every day.
    </p>
  );
}

function Streak({ streak, loaded }: Pick<TrainBodyProps, "streak" | "loaded">) {
  if (!(loaded && streak > 0)) return null;
  return (
    <div className="tm-streak">
      <FlameIcon className="h-4 w-4" />
      <span>{streak}-day streak</span>
    </div>
  );
}

function Bonuses({ bonuses }: Pick<TrainBodyProps, "bonuses">) {
  if (bonuses.length === 0) return null;
  return (
    <div className="tm-bonus">
      <p className="tm-bonus__title">Kingdom Bonuses Unlocked</p>
      {bonuses.map((b) => (
        <Link key={b.zoneId} href="/home" className="tm-bonus__link">
          {b.label} →
        </Link>
      ))}
    </div>
  );
}

function Back() {
  return (
    <Link href="/learn" className="tm-back">
      {backLabel("LEARN")}
    </Link>
  );
}

/** The data every row needs, resolved once. */
function rowData(p: TrainBodyProps, cat: ChessMindCategory) {
  return {
    usage: p.usage?.[cat.id as TrainModule] ?? null,
    score: p.stats[cat.id] ?? 0,
    state: p.progress[cat.id] ?? null,
  };
}

function Meta({ p, cat }: { p: TrainBodyProps; cat: ChessMindCategory }) {
  const { usage, score, state } = rowData(p, cat);
  return (
    <>
      <UsageLine usage={usage} />
      {isTrainCategory(cat.id) && <TrainStatus state={state} category={cat.id} fallbackScore={score} />}
    </>
  );
}

/* ------------------------------ Enchanted ------------------------------ */
function Enchanted(p: TrainBodyProps) {
  const { dailyCategory: daily, continueCategory: cont } = p;
  return (
    <div className="tm tm-en">
      <header className="tm-en__head world-enter">
        <p className="world-kicker">Chess Mind</p>
        <h1 className="tm-en__title">{p.voice.title}</h1>
        <p className="tm-en__lede">{p.voice.subtitle}</p>
        <p className="tm-en__caption">{p.voice.caption}</p>
      </header>
      <FreeNote usage={p.usage} loaded={p.loaded} />
      <Streak streak={p.streak} loaded={p.loaded} />
      {p.extras}

      {daily?.href && (
        <Link href={daily.href} className="tm-en-daily world-enter">
          <span className="tm-en-daily__orb" aria-hidden="true">{daily.emoji}</span>
          <span className="tm-en-daily__text">
            <span className="tm-en-daily__label">Today&apos;s Challenge {p.dailyDoneToday ? "· Done ✓" : ""}</span>
            <span className="tm-en-daily__title">{daily.title}</span>
          </span>
          <span className="tm-en-daily__cta">Start</span>
        </Link>
      )}
      {cont?.href && (
        <Link href={cont.href} className="tm-en-cont">
          <span aria-hidden="true">{cont.emoji}</span>
          <span className="tm-en-cont__text">
            <span className="tm-en-cont__label">Continue Training</span>
            <span className="tm-en-cont__title">{cont.title}</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <Bonuses bonuses={p.bonuses} />

      <ul className="tm-en-grid" aria-label="Training paths">
        {p.categories.map((cat, i) => (
          <li key={cat.id} className={`world-enter world-enter-delay-${Math.min(i % 3, 2)}`}>
            {cat.href ? (
              <Link href={cat.href} className={`tm-en-card tm-en-card--${i % 4}`}>
                <span className="tm-en-card__medal" aria-hidden="true">{cat.emoji}</span>
                <span className="tm-en-card__text">
                  <span className="tm-en-card__title">{cat.title}</span>
                  <span className="tm-en-card__desc">{cat.description}</span>
                  <Meta p={p} cat={cat} />
                </span>
                <span className="tm-en-card__go" aria-hidden="true">→</span>
              </Link>
            ) : (
              <div className="tm-en-card tm-en-card--soon">
                <span className="tm-en-card__medal" aria-hidden="true">{cat.emoji}</span>
                <span className="tm-en-card__text">
                  <span className="tm-en-card__title">{cat.title}</span>
                  <span className="tm-en-card__desc">{cat.description}</span>
                </span>
                <span className="tm-soon">SOON</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Back />
    </div>
  );
}

/* ------------------------------- Atelier -------------------------------- */
function Atelier(p: TrainBodyProps) {
  const { dailyCategory: daily, continueCategory: cont } = p;
  return (
    <div className="tm tm-at">
      <header className="tm-at-mast">
        <p className="tm-at-eyebrow">Chess Mind</p>
        <h1 className="tm-at-title">
          Train Your <em>Mind</em>
        </h1>
        <p className="tm-at-lede">{p.voice.subtitle}</p>
        <p className="tm-at-caption">{p.voice.caption}</p>
        <FreeNote usage={p.usage} loaded={p.loaded} />
        <Streak streak={p.streak} loaded={p.loaded} />
      </header>

      <div className="tm-at-grid">
        <div className="tm-at-side">
          {daily?.href && (
            <Link href={daily.href} className="tm-at-lead">
              <span className="tm-at-eyebrow">Today&apos;s session {p.dailyDoneToday ? "· Done ✓" : ""}</span>
              <span className="tm-at-lead__title">{daily.title}</span>
              <span className="tm-at-lead__desc">{daily.description}</span>
              <span className="tm-at-cta">
                Begin <span aria-hidden="true">→</span>
              </span>
            </Link>
          )}
          {cont?.href && (
            <Link href={cont.href} className="tm-at-cont">
              <span className="tm-at-eyebrow">Continue training</span>
              <span className="tm-at-cont__title">{cont.title}</span>
              <span aria-hidden="true" className="tm-at-cont__go">→</span>
            </Link>
          )}
          <Bonuses bonuses={p.bonuses} />
          {p.extras}
        </div>

        <ol className="tm-at-index" aria-label="Training disciplines">
          {p.categories.map((cat, i) => (
            <li key={cat.id}>
              {cat.href ? (
                <Link href={cat.href} className="tm-at-row">
                  <span className="tm-at-row__no" aria-hidden="true">{pad(i + 1)}</span>
                  <span className="tm-at-row__text">
                    <span className="tm-at-row__title">{cat.title}</span>
                    <span className="tm-at-row__desc">{cat.description}</span>
                    <Meta p={p} cat={cat} />
                  </span>
                  <span className="tm-at-row__go" aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="tm-at-row tm-at-row--soon">
                  <span className="tm-at-row__no" aria-hidden="true">{pad(i + 1)}</span>
                  <span className="tm-at-row__text">
                    <span className="tm-at-row__title">{cat.title}</span>
                    <span className="tm-at-row__desc">{cat.description}</span>
                  </span>
                  <span className="tm-soon">SOON</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <Back />
    </div>
  );
}

/* ------------------------------- Classic -------------------------------- */
function Classic(p: TrainBodyProps) {
  const { dailyCategory: daily, continueCategory: cont } = p;
  return (
    <div className="tm tm-cl">
      <header className="tm-cl-top">
        <p className="world-kicker">Chess Mind</p>
        <h1 className="tm-cl-title">{p.voice.title}</h1>
        <p className="tm-cl-lede">{p.voice.subtitle}</p>
        <p className="tm-cl-caption">{p.voice.caption}</p>
      </header>
      <FreeNote usage={p.usage} loaded={p.loaded} />
      <Streak streak={p.streak} loaded={p.loaded} />
      {p.extras}

      {daily?.href && (
        <Link href={daily.href} className="tm-cl-daily">
          <span className="tm-cl-label">Today&apos;s Challenge {p.dailyDoneToday ? "· Done ✓" : ""}</span>
          <span className="tm-cl-daily__title">{daily.title}</span>
          <span className="tm-cl-daily__desc">{daily.description}</span>
          <span className="tm-cl-cta">
            Start <span aria-hidden="true">→</span>
          </span>
        </Link>
      )}
      {cont?.href && (
        <Link href={cont.href} className="tm-cl-cont">
          <span className="tm-cl-label">Continue Training</span>
          <span className="tm-cl-cont__title">{cont.title}</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <Bonuses bonuses={p.bonuses} />

      <section aria-labelledby="tm-cl-disciplines">
        <h2 id="tm-cl-disciplines" className="tm-cl-label">Disciplines</h2>
        <ul className="tm-cl-grid">
          {p.categories.map((cat, i) => (
            <li key={cat.id}>
              {cat.href ? (
                <Link href={cat.href} className="tm-cl-tile">
                  <span className="tm-cl-tile__no" aria-hidden="true">{pad(i + 1)}</span>
                  <span className="tm-cl-tile__title">{cat.title}</span>
                  <span className="tm-cl-tile__desc">{cat.description}</span>
                  <Meta p={p} cat={cat} />
                </Link>
              ) : (
                <div className="tm-cl-tile tm-cl-tile--soon">
                  <span className="tm-cl-tile__no" aria-hidden="true">{pad(i + 1)}</span>
                  <span className="tm-cl-tile__title">{cat.title}</span>
                  <span className="tm-cl-tile__desc">{cat.description}</span>
                  <span className="tm-soon">SOON</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Back />
    </div>
  );
}

export function TrainBody(props: TrainBodyProps) {
  return <WorldBranch classic={<Classic {...props} />} atelier={<Atelier {...props} />} other={<Enchanted {...props} />} />;
}
