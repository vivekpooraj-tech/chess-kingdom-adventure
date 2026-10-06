import Link from "next/link";
import { ChevronRightIcon, ComputerIcon, GlobeIcon, PersonAddIcon, ShieldIcon, TrophyIcon } from "@/components/nav/icons";
import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { PLAY_COPY, PLAY_DESTINATION_ORDER, PLAY_ROUTES, type PlayDestinationId } from "./playLanding";

/**
 * Enchanted Kingdom — the Play landing as a quest board ("Choose Your Quest").
 * Presentation only: every card is a link to the same shared destination the other worlds use.
 * Styles: `.pl-en-*` in app/worlds.css (teal / purple / gold / coral on a deep magical ground).
 */

const ICON: Record<PlayDestinationId, (p: { className?: string }) => JSX.Element> = {
  computer: ComputerIcon,
  online: ShieldIcon,
  tournament: TrophyIcon,
  world: GlobeIcon,
};

export function EnchantedPlay() {
  const copy = PLAY_COPY.enchanted;
  return (
    <div className="pl-en">
      <header className="pl-en__head world-enter">
        <p className="world-kicker">{copy.kicker}</p>
        <h1 className="pl-en__title">{copy.title}</h1>
        <p className="pl-en__lede">{copy.lede}</p>
      </header>

      <ul className="pl-en__quests" aria-label="Quests">
        {PLAY_DESTINATION_ORDER.map((id, i) => {
          const Icon = ICON[id];
          return (
            <li key={id} className={`world-enter world-enter-delay-${Math.min(i, 2)}`}>
              <Link href={PLAY_ROUTES[id]} className={`pl-en-quest pl-en-quest--${id}`}>
                <span className="pl-en-quest__medal" aria-hidden="true">
                  <Icon className="h-7 w-7" />
                </span>
                <span className="pl-en-quest__text">
                  <span className="pl-en-quest__title">{copy.destinations[id].title}</span>
                  <span className="pl-en-quest__desc">{copy.destinations[id].description}</span>
                </span>
                <ChevronRightIcon className="pl-en-quest__go h-5 w-5" />
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="pl-en-invite" aria-labelledby="pl-en-invite-title">
        <div className="pl-en-invite__head">
          <span className="pl-en-quest__medal pl-en-quest__medal--small" aria-hidden="true">
            <PersonAddIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="pl-en-invite-title" className="pl-en-invite__title">{copy.invite.title}</h2>
            <p className="pl-en-invite__desc">{copy.invite.description}</p>
          </div>
        </div>
        <InviteFriendButton />
      </section>

      <section className="pl-en-today" aria-labelledby="pl-en-today-title">
        <h2 id="pl-en-today-title" className="pl-en-today__title">{copy.today}</h2>
        <div className="pl-en-today__grid">
          <DailyChallengeCard />
          <Link href={PLAY_ROUTES.tactics} className="pl-en-row">
            <span className="pl-en-row__copy">
              <span className="pl-en-row__label">{copy.tactics.label}</span>
              <span className="pl-en-row__title">{copy.tactics.title}</span>
            </span>
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
          <Link href={PLAY_ROUTES.puzzles} className="pl-en-more">{copy.morePuzzles}</Link>
        </div>
      </section>
    </div>
  );
}
