import { ForParentsLink } from "@/components/nav/ForParentsLink";
import Link from "next/link";
import type { AvatarOption } from "@/lib/types";
import { ageAudience, type AgeBand } from "@/lib/learner/experienceLevel";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";
import type { DailyQuestSet } from "@/lib/quests/dailyQuests";
import { PREMIUM_HEADLINE_BENEFITS } from "@/lib/premium/capabilities";
import { TIME_CONTROLS } from "@/content/timeControls";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DailyQuestsCard } from "@/components/home/DailyQuestsCard";
import { PrimaryActionCard } from "@/components/home/PrimaryActionCard";
import { ClassicCareer } from "./ClassicCareer";

const DECK = [
  { href: "/play", glyph: "♞", title: "Blitz & Rapid", note: "Every way to play" },
  { href: "/puzzles/tactics", glyph: "♝", title: "Tactics Trainer", note: "Themed positions" },
  { href: "/games", glyph: "♜", title: "Match Vault", note: "Every finished game" },
  { href: "/stats", glyph: "♛", title: "Game Review", note: "Results & insights" },
] as const;

function categorySpan(category: "Blitz" | "Rapid"): string | null {
  const ids = TIME_CONTROLS.filter((t) => t.description === category).map((t) => t.id);
  if (ids.length === 0) return null;
  return ids.length === 1 ? `${category} ${ids[0]}` : `${category} ${ids[0]}–${ids[ids.length - 1]}`;
}

/**
 * Classic Pro Home — "a private modern chess club for serious players".
 *
 * Layout only. Every value is one the shared Home already loads (child row,
 * streak, wins, primary action, quests, premium) or that ClassicCareer reads
 * from finished games. Every link is an existing route.
 */
export function ClassicHome({
  childId,
  displayName,
  avatar,
  rating,
  streak,
  onlineWins,
  isPremium,
  primaryAction,
  questSet,
  neutralTone,
  milestones,
  ageBand,
}: {
  childId: string;
  displayName: string;
  avatar: AvatarOption | undefined;
  rating: number | null;
  streak: number;
  onlineWins: number;
  isPremium: boolean;
  primaryAction: PrimaryAction;
  questSet: DailyQuestSet;
  neutralTone: boolean;
  milestones: string[];
  /** children.age_band — decides Ask a parent (under 18 / unknown) vs Get Premium (18+). */
  ageBand?: AgeBand | null;
}) {
  const timeControls = [categorySpan("Blitz"), categorySpan("Rapid")].filter(Boolean).join(" · ");

  return (
    <div className="ch-home">
      <header className="ch-top world-enter">
        <div className="min-w-0">
          <p className="ch-kicker">Classic Pro</p>
          <h1 className="ch-brand">Chess Mind</h1>
        </div>
      </header>

      <div className="ch-cols">
        <div className="ch-col">
          <Link href="/profile" className="ch-card ch-player world-enter" aria-label={`${displayName} — open profile`}>
            <span
              className="ch-player__avatar"
              aria-hidden="true"
              style={{
                background: avatar
                  ? `linear-gradient(135deg, ${avatar.colorFrom}, ${avatar.colorTo})`
                  : undefined,
              }}
            >
              {avatar?.emoji ?? "♔"}
            </span>
            <span className="ch-player__copy">
              <span className="ch-player__name">{displayName}</span>
              <span className="ch-meta">
                {onlineWins} online {onlineWins === 1 ? "win" : "wins"}
                {streak > 0 ? ` · ${streak}-day streak` : ""}
              </span>
            </span>
            {typeof rating === "number" && (
              <span className="ch-player__rating">
                <span className="ch-label">Rating</span>
                <span className="ch-player__elo">{rating}</span>
              </span>
            )}
          </Link>

          <section className="ch-card ch-hero world-enter world-enter-delay-1" aria-labelledby="ch-hero-title">
            <p className="ch-label">Next match</p>
            <h2 id="ch-hero-title" className="ch-hero__title">Rated game</h2>
            <p className="ch-meta">
              {typeof rating === "number" ? `Playing at ${rating}` : "Rated online"}
              {timeControls ? ` · ${timeControls}` : ""}
            </p>
            <Link href="/matchmaking" className="ch-cta">
              Play now
            </Link>
            <Link href="/play" className="ch-link ch-hero__alt">
              Computer, friends &amp; tournaments
            </Link>
          </section>

          <nav aria-label="Command deck" className="ch-deck world-enter world-enter-delay-2">
            {DECK.map((d) => (
              <Link key={d.href} href={d.href} className="ch-card ch-deck__tile">
                <span className="ch-deck__glyph" aria-hidden="true">
                  {d.glyph}
                </span>
                <span className="ch-deck__title">{d.title}</span>
                <span className="ch-meta">{d.note}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="ch-col">
          <section className="ch-section" aria-label="Today">
            <DailyChallengeCard childId={childId} variant="classic" />
            <DailyQuestsCard set={questSet} neutralTone={neutralTone} embedded />
          </section>

          <section className="ch-section ch-study" aria-label="Your study">
            <PrimaryActionCard action={primaryAction} />
          </section>

          <ClassicCareer childId={childId} rating={rating} />

          <section className="ch-card ch-salon" aria-labelledby="ch-salon-title">
            <p className="ch-label ch-label--champagne">Grandmaster salon</p>
            {isPremium ? (
              <>
                <h2 id="ch-salon-title" className="ch-salon__title">Membership active</h2>
                <p className="ch-meta">Every Premium feature is open on this account.</p>
              </>
            ) : (
              <>
                <h2 id="ch-salon-title" className="ch-salon__title">Chess Mind Premium</h2>
                <ul className="ch-salon__list">
                  {PREMIUM_HEADLINE_BENEFITS.slice(0, 4).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {ageAudience(ageBand) === "adult" ? (
                  <Link href="/upgrade" className="ch-cta ch-cta--champagne">
                    Get Premium
                  </Link>
                ) : (
                  <Link href="/parent-gate?next=/upgrade" className="ch-cta ch-cta--champagne">
                    Ask a parent
                  </Link>
                )}
              </>
            )}
          </section>

          <Link href="/chess-mind" className="ch-card ch-row">
            <span className="min-w-0">
              <span className="ch-row__title">Train Your Mind</span>
              <span className="ch-meta">
                {milestones.length > 0 ? milestones.join(" · ") : "Short daily workouts, built for chess"}
              </span>
            </span>
            <span aria-hidden="true" className="ch-row__arrow">→</span>
          </Link>

          <ForParentsLink variant="classic" ageBand={ageBand} />
        </div>
      </div>
    </div>
  );
}
