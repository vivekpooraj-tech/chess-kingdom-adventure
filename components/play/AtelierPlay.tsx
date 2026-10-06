import Link from "next/link";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { PLAY_COPY, PLAY_DESTINATION_ORDER, PLAY_ROUTES, type PlayDestinationId } from "./playLanding";

/**
 * Master Training Atelier — the Play landing as a private training studio ("Match Training").
 * One lead session, then a numbered index of the others, set in thin rules: editorial, not a card grid.
 * Presentation only: the same shared destinations as every other world. Styles: `.pl-at-*` in app/worlds.css
 * (warm graphite, deep plum, oxblood, ivory, chartreuse for the one primary action, muted copper).
 */

export function AtelierPlay() {
  const copy = PLAY_COPY.atelier;
  const [lead, ...rest] = PLAY_DESTINATION_ORDER as readonly PlayDestinationId[];
  return (
    <div className="pl-at">
      <header className="pl-at-mast">
        <p className="pl-at-eyebrow">{copy.kicker}</p>
        <h1 className="pl-at-title">
          Match <em>Training</em>
        </h1>
        <p className="pl-at-lede">{copy.lede}</p>
      </header>

      <div className="pl-at-lead-grid">
        <Link href={PLAY_ROUTES[lead]} className="pl-at-lead">
          <span className="pl-at-eyebrow">01 · Computer</span>
          <span className="pl-at-lead__title">{copy.destinations[lead].title}</span>
          <span className="pl-at-lead__desc">{copy.destinations[lead].description}</span>
          <span className="pl-at-cta">
            Begin session <span aria-hidden="true">→</span>
          </span>
        </Link>

        <ol className="pl-at-index" aria-label="More ways to play">
          {rest.map((id, i) => (
            <li key={id}>
              <Link href={PLAY_ROUTES[id]} className="pl-at-row">
                <span className="pl-at-row__no" aria-hidden="true">{String(i + 2).padStart(2, "0")}</span>
                <span className="pl-at-row__text">
                  <span className="pl-at-row__title">{copy.destinations[id].title}</span>
                  <span className="pl-at-row__desc">{copy.destinations[id].description}</span>
                </span>
                <span className="pl-at-row__go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <section className="pl-at-invite" aria-labelledby="pl-at-invite-title">
        <div className="pl-at-invite__head">
          <p className="pl-at-eyebrow">Private</p>
          <h2 id="pl-at-invite-title" className="pl-at-h2">{copy.invite.title}</h2>
          <p className="pl-at-note">{copy.invite.description}</p>
        </div>
        <InviteFriendButton />
      </section>

      <section className="pl-at-today" aria-labelledby="pl-at-today-title">
        <div className="pl-at-today__head">
          <p className="pl-at-eyebrow">{copy.today}</p>
          <h2 id="pl-at-today-title" className="sr-only">{copy.today}</h2>
        </div>
        <div className="pl-at-today__grid">
          <DailyChallengeCard variant="atelier" />
          <Link href={PLAY_ROUTES.tactics} className="pl-at-row pl-at-row--solo">
            <span className="pl-at-row__text">
              <span className="pl-at-eyebrow">{copy.tactics.label}</span>
              <span className="pl-at-row__title">{copy.tactics.title}</span>
            </span>
            <span className="pl-at-row__go" aria-hidden="true">→</span>
          </Link>
          <Link href={PLAY_ROUTES.puzzles} className="pl-at-more">{copy.morePuzzles}</Link>
        </div>
      </section>
    </div>
  );
}
