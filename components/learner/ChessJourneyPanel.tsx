import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import {
  describeDirection,
  MIN_RATED_GAMES_FOR_TREND,
  type ChessJourney,
  type Direction,
} from "@/lib/learner/chessJourney";

/**
 * "Your Chess Journey" — the answer to "am I improving?".
 *
 * A server component: everything it renders is already resolved by the page,
 * so none of this costs the browser any JavaScript. The sparkline is a handful
 * of inline SVG points rather than a charting library, which would have been
 * far more bytes than the graph is worth.
 *
 * Shows nothing it cannot support. Below the sample thresholds in
 * chessJourney.ts it says how many games are left instead of drawing a shape
 * from three data points — a graph implies a finding, and inventing one is the
 * fastest way to make every other number here untrustworthy.
 */

const DIRECTION_STYLE: Record<Direction, string> = {
  improving: "border-premium-gold/30 bg-premium-gold/10 text-premium-gold",
  steady: "border-white/10 bg-premium-navyLight/50 text-premium-ivory/80",
  dipping: "border-white/10 bg-premium-navyLight/50 text-premium-ivory/80",
};

/** Arrow as well as colour — direction must not be conveyed by hue alone. */
const DIRECTION_MARK: Record<Direction, string> = {
  improving: "▲",
  steady: "▬",
  dipping: "▼",
};

function Sparkline({ series }: { series: number[] }) {
  const w = 120;
  const h = 32;
  const min = Math.min(...series);
  const max = Math.max(...series);
  // A flat run would divide by zero and also genuinely has no shape to draw;
  // render it as a centre line rather than a spike.
  const span = max - min || 1;
  const step = series.length > 1 ? w / (series.length - 1) : 0;
  const pts = series
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label={`Rating over the last ${series.length} rated games, from ${min} to ${max}.`}
      className="flex-none overflow-visible"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChessJourneyPanel({ journey }: { journey: ChessJourney }) {
  if (journey.isEmpty) return null;

  const { rating, accuracy, ratedGamesNeeded } = journey;

  return (
    <section
      aria-label="Your Chess Journey"
      className="w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <p className={`${TEXT.meta} text-premium-gold`}>Your Chess Journey</p>
        <p className={`${TEXT.caption} normal-case`}>
          How you&apos;ve changed — from your rated games and reviews, not a score.
        </p>
      </div>

      {/* Started but not enough for a direction: say what unlocks it. */}
      {rating === null && ratedGamesNeeded !== null && (
        <p className={TEXT.body}>
          {ratedGamesNeeded} more rated {ratedGamesNeeded === 1 ? "game" : "games"} and I&apos;ll start
          tracking how your rating is moving. Ratings swing a lot early on, so it takes about{" "}
          {MIN_RATED_GAMES_FOR_TREND} to mean anything.
        </p>
      )}

      {rating && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-classic-display text-2xl text-premium-ivory">
                {rating.current}
                <span className={`${TEXT.caption} normal-case ml-2`}>rating</span>
              </p>
              <p className={`${TEXT.caption} normal-case mt-0.5`}>
                {rating.record.wins}W · {rating.record.losses}L · {rating.record.draws}D over the last{" "}
                {rating.gamesInWindow} rated games · best {rating.best}
              </p>
            </div>
            <span className={`text-premium-gold ${rating.direction === "steady" ? "opacity-60" : ""}`}>
              <Sparkline series={rating.series} />
            </span>
          </div>

          <p
            className={`rounded-premiumBtn border px-3 py-2 font-classic-body text-sm ${DIRECTION_STYLE[rating.direction]}`}
          >
            <span aria-hidden="true">{DIRECTION_MARK[rating.direction]}</span>{" "}
            {describeDirection(rating.direction, "rating")}{" "}
            {rating.change > 0 ? `+${rating.change}` : rating.change} points in this stretch.
          </p>
        </div>
      )}

      {accuracy && (
        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
          <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            Game accuracy
          </p>
          <p className={TEXT.body}>
            <span aria-hidden="true">{DIRECTION_MARK[accuracy.direction]}</span>{" "}
            {describeDirection(accuracy.direction, "accuracy")} You&apos;re averaging{" "}
            {accuracy.recent}% across your recent reviewed games, against {accuracy.previous}% before
            that.
          </p>
        </div>
      )}

      <Link
        href="/chess-mind"
        className="self-start font-classic-body text-sm font-semibold text-premium-gold underline underline-offset-2 min-h-[44px] flex items-center"
      >
        See what to work on next →
      </Link>
    </section>
  );
}
