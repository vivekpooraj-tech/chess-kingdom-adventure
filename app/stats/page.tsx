import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  resolveActiveChild,
  getPlayedGames,
  getRecentGameReviews,
  getSkillSignals,
  getPuzzleAccuracyStats,
} from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { Screen } from "@/components/layout/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PrimaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import { getTimeControl } from "@/content/timeControls";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { buildChessBrainView } from "@/lib/learner/chessBrain";
import { ChessBrainPanel } from "@/components/learner/ChessBrainPanel";
import { OllieNote } from "@/components/ollie/OllieNote";
import { StatBlock, SplitBar, EmptySection, formatRate, recordLine } from "@/components/stats/StatBlocks";
import {
  buildOverview,
  byColor,
  byTimeControl,
  byOpening,
  withinDays,
  ok,
  type GameRecord,
  type Stat,
} from "@/lib/stats/playerStats";
import { buildRecommendation, ollieStatsNote } from "@/lib/stats/recommendation";

export const metadata = {
  title: "Your Chess · Chess Mind",
  description: "What your games actually show — and what to practise next.",
};

/**
 * Stats & Insights.
 *
 * Answers "what kind of player am I, and what should I do about it" from data
 * the app genuinely records. The interesting engineering is in what it refuses
 * to say: every figure arrives as a Stat<T> carrying its own evidence state,
 * and comparative claims are significance-tested in lib/stats/playerStats.ts
 * before they reach this file.
 *
 * Two things deliberately absent:
 *
 *  - Game-phase insights ("most of your mistakes are in the middlegame").
 *    child_game_reviews stores biggest_moment_ply but no per-mistake phase,
 *    and ply cannot separate a middlegame from an endgame. The data does not
 *    support the claim, so the section does not exist.
 *  - A skill scorecard. lib/learner/chessBrain.ts already reads the skill
 *    signals; it is embedded here rather than reimplemented, so the two can
 *    never disagree about the same player.
 *
 * Server component. The period filter is a query parameter rather than client
 * state, so the whole page stays server-rendered with no hydration cost.
 */

const PERIODS = [
  { id: "7", days: 7, label: "7 days" },
  { id: "30", days: 30, label: "30 days" },
  { id: "90", days: 90, label: "90 days" },
  { id: "all", days: null, label: "All time" },
] as const;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child;
  if (!child) redirect("/choose-child");

  const [allGames, reviews, signals, puzzleStats] = await Promise.all([
    getPlayedGames(supabase, child.id),
    getRecentGameReviews(supabase, child.id, 100).catch(() => []),
    getSkillSignals(supabase, child.id).catch(() => ({})),
    getPuzzleAccuracyStats(supabase, child.id).catch(() => null),
  ]);

  const selected = PERIODS.find((p) => p.id === searchParams.period) ?? PERIODS[3];
  const games: GameRecord[] = withinDays(allGames, selected.days);

  const overview = buildOverview(games, child.rating ?? null);
  const colors = byColor(games);
  const timeControls = byTimeControl(games, (id) => (id ? getTimeControl(id).description : null));
  const openings = byOpening(
    reviews.map((r) => ({
      openingName: r.openingName ?? null,
      result: (r.result as "win" | "loss" | "draw" | null) ?? null,
    }))
  );

  const profile = deriveLearnerProfile(signals, reviews);
  const brain = buildChessBrainView(signals, reviews, profile);

  const weakerColor =
    colors.claim === null
      ? null
      : (colors.white.rate ?? 0) > (colors.black.rate ?? 0)
        ? ("b" as const)
        : ("w" as const);

  const firstTryRate =
    puzzleStats && puzzleStats.totalAttempts > 0
      ? puzzleStats.firstTryCorrect / puzzleStats.totalAttempts
      : null;

  const recommendation = buildRecommendation({
    brain,
    colorClaim: colors.claim,
    weakerColor,
    puzzleAttempts: puzzleStats?.totalAttempts ?? 0,
    puzzleFirstTryRate: firstTryRate,
    totalGames: games.length,
  });

  const trendValue = overview.trend.kind === "ok" ? overview.trend.value : null;
  const ollie = ollieStatsNote({ trend: trendValue, games: games.length, recommendation });

  const trendStat: Stat<string> =
    overview.trend.kind === "ok"
      ? ok(
          overview.trend.value === "improving"
            ? "Improving"
            : overview.trend.value === "declining"
              ? "Dipping"
              : "Steady"
        )
      : overview.trend;

  return (
    <Screen maxWidth="compact">
      <header className="flex flex-col gap-2">
        <h1 className={TEXT.display}>Your Chess</h1>
        <p className={TEXT.body}>
          What your games actually show. Figures appear once there are enough games to mean
          something — anything still building says so.
        </p>
      </header>

      {/* Period filter — links, not client state, so the page stays static. */}
      <nav aria-label="Time period" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const active = p.id === selected.id;
          return (
            <Link
              key={p.id}
              href={`/stats?period=${p.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center rounded-premiumBtn border px-4 font-classic-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 ${
                active
                  ? "border-premium-gold bg-premium-gold/15 text-premium-ivory"
                  : "border-white/12 bg-premium-navy/70 text-premium-ivory/75 hover:border-premium-gold/30"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      {games.length === 0 ? (
        <EmptySection>
          {allGames.length === 0
            ? "No finished games recorded yet. Play a game and this page starts filling in."
            : `No games in the last ${selected.label.toLowerCase()}. Try a longer period.`}
        </EmptySection>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader title="Overview" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="Games" stat={ok(overview.record.games)} />
              <StatBlock
                label="Score rate"
                stat={overview.rate}
                format={(v) => formatRate(v as number)}
              />
              <StatBlock label="Recent form" stat={trendStat} />
              <StatBlock
                label="Peak rating"
                stat={overview.peak}
                fallbackNote="No rated games yet"
              />
            </div>
            <p className={TEXT.caption}>
              {recordLine(overview.record)}
              {overview.rated.games > 0
                ? ` · ${overview.rated.games} rated`
                : " · none rated yet"}
              {overview.streak >= 2 ? ` · ${overview.streak} wins in a row` : ""}
            </p>
          </section>

          {ollie && <OllieNote>{ollie}</OllieNote>}

          {recommendation && (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Your next best practice" />
              <PrimaryCard className="flex flex-col gap-2 border-premium-gold/30">
                <p className="font-classic-display text-lg text-premium-ivory">
                  {recommendation.title}
                </p>
                <p className={TEXT.body}>{recommendation.evidence}</p>
                <Link
                  href={recommendation.href}
                  className="mt-1 inline-flex min-h-[44px] items-center font-classic-body text-sm text-premium-gold underline underline-offset-4"
                >
                  {recommendation.cta} →
                </Link>
              </PrimaryCard>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionHeader title="White and Black" />
            <PrimaryCard className="flex flex-col gap-4">
              <SplitBar row={colors.white} />
              <SplitBar row={colors.black} />
              {colors.claim ? (
                <p className={TEXT.body}>{colors.claim}</p>
              ) : (
                <p className={TEXT.caption}>
                  No meaningful difference between your colours — which is the normal result.
                </p>
              )}
            </PrimaryCard>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="By time control" />
            {timeControls.length === 0 ? (
              <EmptySection>
                None of your games recorded a time control yet.
              </EmptySection>
            ) : (
              <PrimaryCard className="flex flex-col gap-4">
                {timeControls.map((row) => (
                  <SplitBar key={row.key} row={row} />
                ))}
              </PrimaryCard>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Openings" />
            {openings.rows.length === 0 ? (
              <EmptySection>
                Openings are recorded when you run a Game Review. Review a game and they appear
                here.
              </EmptySection>
            ) : (
              <PrimaryCard className="flex flex-col gap-3">
                {openings.rows.slice(0, 6).map((o) => (
                  <div key={o.name} className="flex items-baseline justify-between gap-3">
                    <span className="font-classic-body text-sm text-premium-ivory">{o.name}</span>
                    <span className={TEXT.caption}>
                      {o.rate === null
                        ? `${recordLine(o.record)} · too few to rate`
                        : `${recordLine(o.record)} · ${formatRate(o.rate)}`}
                    </span>
                  </div>
                ))}
                {openings.best && openings.worst && (
                  <p className={`${TEXT.body} border-t border-white/10 pt-3`}>
                    Your strongest is {openings.best.name}; your weakest is {openings.worst.name}.
                    Both are measured across reviewed games only.
                  </p>
                )}
                {openings.allBelowThreshold && (
                  <p className={`${TEXT.caption} border-t border-white/10 pt-3`}>
                    Not enough games in any one opening yet to call it strong or weak.
                  </p>
                )}
              </PrimaryCard>
            )}
          </section>
        </>
      )}

      {/* The existing Chess Brain, not a second opinion about the same player. */}
      <ChessBrainPanel view={brain} />

      <section className="flex flex-col gap-2">
        <SectionHeader title="Keep going" />
        <div className="flex flex-col gap-2">
          <Link
            href="/games"
            className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
          >
            Your games and reviews <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/play"
            className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
          >
            Play a game <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/puzzles/tactics"
            className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
          >
            Tactics trainer <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/learn"
            className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
          >
            Courses <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </Screen>
  );
}
