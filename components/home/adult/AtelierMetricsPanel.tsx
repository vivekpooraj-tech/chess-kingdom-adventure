import Link from "next/link";
import type { OllieLearnerProfile } from "@/lib/ollie/learnerContext";
import type { ImprovementTimeline } from "@/lib/stats/improvementTimeline";
import { TEXT } from "@/lib/designSystem";

/**
 * Adult's "Training Metrics" panel (Phase 2.1-C) — reuses two already-
 * computed, real values rather than fetching or deriving anything new:
 *
 *   - `learnerProfile` — the same deriveLearnerProfile() output Home
 *     already computes for Ollie's line and the "focus" primary action.
 *   - `timeline` — buildImprovementTimeline(getRatingTimeline(...)),
 *     which itself refuses to draw a trend from too few rated games
 *     ("locked" state) rather than showing a misleading two-point line —
 *     see the doc comment on that function. This panel honours that: a
 *     locked timeline renders the honest "N more games" message, not a
 *     fake chart.
 */
export function AtelierMetricsPanel({
  learnerProfile,
  timeline,
}: {
  learnerProfile: OllieLearnerProfile;
  timeline: ImprovementTimeline;
}) {
  return (
    <div className="atelier-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <p className="atelier-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
        Training Metrics
      </p>

      <div className="atelier-divider rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-3">
        {timeline.kind === "ready" ? (
          <>
            <p className="font-classic-display text-2xl text-premium-ivory">
              {timeline.net > 0 ? "+" : ""}
              {timeline.net}
              <span className="ml-1 font-classic-body text-xs font-normal text-premium-ivory/50">
                rating over last {timeline.points.length} games
              </span>
            </p>
            <p className={`${TEXT.caption} mt-1`}>
              Peak {timeline.peak} · currently {timeline.last}
            </p>
          </>
        ) : (
          <p className={TEXT.body}>
            {timeline.need - timeline.have} more rated games until your training trend unlocks.
          </p>
        )}
      </div>

      {learnerProfile.focusSkillName && learnerProfile.focusSkillWeakCount ? (
        <div className="atelier-divider rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-3">
          <p className="font-classic-body text-sm text-premium-ivory">
            Current focus: <span className="font-semibold">{learnerProfile.focusSkillName}</span>
          </p>
          <p className={`${TEXT.caption} mt-1`}>
            Flagged in {learnerProfile.focusSkillWeakCount} recent reviewed game
            {learnerProfile.focusSkillWeakCount === 1 ? "" : "s"}.
          </p>
        </div>
      ) : (
        <p className={TEXT.body}>No recurring weakness flagged yet — keep playing and reviewing.</p>
      )}

      <Link href="/stats" className="font-classic-body text-xs text-premium-gold underline underline-offset-2">
        Open full training analytics
      </Link>
    </div>
  );
}
