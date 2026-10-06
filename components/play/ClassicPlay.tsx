import Link from "next/link";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { PLAY_COPY, PLAY_DESTINATION_ORDER, PLAY_ROUTES } from "./playLanding";

/**
 * Classic Pro — the Play landing as a championship club's match desk ("Play").
 * Four equal, rectangular tiles under a thin masthead; obsidian and graphite, ivory type, one accent rule per tile
 * (emerald for play against the computer and online, burgundy for the tournament, muted champagne for the world).
 * Presentation only: the same shared destinations as every other world. Styles: `.pl-cl-*` in app/worlds.css.
 */

const ACCENT = { computer: "emerald", online: "emerald", tournament: "burgundy", world: "champagne" } as const;

export function ClassicPlay() {
  const copy = PLAY_COPY.classic;
  return (
    <div className="pl-cl">
      <header className="pl-cl-top">
        <p className="world-kicker">{copy.kicker}</p>
        <h1 className="pl-cl-title">{copy.title}</h1>
        <p className="pl-cl-lede">{copy.lede}</p>
      </header>

      <ul className="pl-cl-grid" aria-label="Ways to play">
        {PLAY_DESTINATION_ORDER.map((id) => (
          <li key={id}>
            <Link href={PLAY_ROUTES[id]} className={`pl-cl-tile pl-cl-tile--${ACCENT[id]}`}>
              <span className="pl-cl-tile__title">{copy.destinations[id].title}</span>
              <span className="pl-cl-tile__desc">{copy.destinations[id].description}</span>
              <span className="pl-cl-tile__go" aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="pl-cl-invite" aria-labelledby="pl-cl-invite-title">
        <div className="pl-cl-invite__head">
          <h2 id="pl-cl-invite-title" className="pl-cl-h2">{copy.invite.title}</h2>
          <p className="pl-cl-note">{copy.invite.description}</p>
        </div>
        <InviteFriendButton />
      </section>

      <section className="pl-cl-today" aria-labelledby="pl-cl-today-title">
        <h2 id="pl-cl-today-title" className="pl-cl-label">{copy.today}</h2>
        <div className="pl-cl-today__grid">
          <DailyChallengeCard variant="classic" />
          <Link href={PLAY_ROUTES.tactics} className="pl-cl-row">
            <span className="pl-cl-row__copy">
              <span className="pl-cl-label">{copy.tactics.label}</span>
              <span className="pl-cl-row__title">{copy.tactics.title}</span>
            </span>
            <span aria-hidden="true" className="pl-cl-tile__go">→</span>
          </Link>
          <Link href={PLAY_ROUTES.puzzles} className="pl-cl-more">{copy.morePuzzles}</Link>
        </div>
      </section>
    </div>
  );
}
