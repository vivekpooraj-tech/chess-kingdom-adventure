import { TEXT } from "@/lib/designSystem";
import {
  describeTimeline,
  type ImprovementTimeline,
} from "@/lib/stats/improvementTimeline";

/**
 * Rating progression.
 *
 * Hand-drawn SVG rather than a charting library: the shape is a polyline, and
 * pulling in a chart package for it would add far more to the bundle than the
 * feature is worth. Rendered on the server, so it costs the client nothing.
 *
 * The locked state is the interesting one. Rather than drawing a two-point line
 * that always looks like a dramatic trend, it says how many more rated games
 * are needed — which is information, not decoration.
 */
export function RatingTimeline({ timeline }: { timeline: ImprovementTimeline }) {
  if (timeline.kind === "locked") {
    const remaining = timeline.need - timeline.have;
    return (
      <div className="rounded-premiumCard border border-white/10 bg-premium-navy/60 p-4 flex flex-col gap-2">
        <p className={`${TEXT.meta} text-premium-gold`}>Improvement timeline</p>
        <p className={TEXT.body}>
          {timeline.have === 0
            ? "Play rated games and your rating progression appears here."
            : `Play ${remaining} more rated ${remaining === 1 ? "game" : "games"} to unlock your rating progression.`}
        </p>
        <p className={TEXT.caption}>
          {timeline.have} of {timeline.need} rated games recorded
        </p>
      </div>
    );
  }

  const { coords, min, max, first, last, net, points } = timeline;
  const W = 300;
  const H = 72;
  const PAD = 4;
  const path = coords
    .map((c, i) => {
      const x = PAD + c.x * (W - PAD * 2);
      const y = PAD + c.y * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const summary = describeTimeline(timeline);

  return (
    <div className="rounded-premiumCard border border-white/10 bg-premium-navy/60 p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`${TEXT.meta} text-premium-gold`}>Improvement timeline</p>
        <p className={TEXT.caption}>
          {first} → {last}
          {net !== 0 ? ` (${net > 0 ? "+" : ""}${net})` : ""}
        </p>
      </div>

      {/* The line is decorative; the numbers above and the sentence below carry
          the same information for anyone who cannot see it. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[72px] overflow-visible"
        role="img"
        aria-label={`Rating progression across ${points.length} rated games, from ${first} to ${last}. Lowest ${min}, highest ${max}.`}
      >
        <path
          d={path}
          fill="none"
          stroke="rgb(var(--cm-gold))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.length > 0 && (
          <circle
            cx={PAD + coords[coords.length - 1].x * (W - PAD * 2)}
            cy={PAD + coords[coords.length - 1].y * (H - PAD * 2)}
            r="3.5"
            fill="rgb(var(--cm-gold))"
          />
        )}
      </svg>

      <div className="flex items-center justify-between">
        <span className={TEXT.caption}>Low {min}</span>
        <span className={TEXT.caption}>High {max}</span>
      </div>

      {summary && <p className={TEXT.body}>{summary}</p>}
    </div>
  );
}
