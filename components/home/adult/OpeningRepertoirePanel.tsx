import Link from "next/link";
import type { OpeningEncounterDetail } from "@/lib/supabase/queries";
import { getOpening } from "@/content/openings";
import { TEXT } from "@/lib/designSystem";

/**
 * Adult's "Opening Repertoire" panel (Phase 2.1-C) — built entirely from
 * openingEncounters, already fetched by Home for the Discover/Progress
 * sections. Each row's accuracy is real:
 * practice_successes / practice_attempts from that same row, not a fetched
 * or invented statistic. Openings with zero practice attempts are shown
 * without an accuracy figure rather than a misleading 0%/undefined value —
 * the same "don't draw a number you can't back up" discipline
 * lib/stats/improvementTimeline.ts already uses for the rating trend.
 */
export function OpeningRepertoirePanel({ encounters }: { encounters: OpeningEncounterDetail[] }) {
  const rows = [...encounters]
    .sort((a, b) => b.practice_attempts - a.practice_attempts)
    .slice(0, 4)
    .map((e) => ({
      name: getOpening(e.opening_id)?.name ?? e.opening_id,
      attempts: e.practice_attempts,
      accuracy:
        e.practice_attempts > 0 ? Math.round((e.practice_successes / e.practice_attempts) * 100) : null,
    }));

  return (
    <div className="atelier-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="atelier-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            Opening Repertoire
          </p>
          <h2 className={TEXT.heading}>Repertoire Health</h2>
        </div>
        <Link
          href="/stats"
          className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2"
        >
          Full breakdown
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className={TEXT.body}>No openings studied yet — they&apos;ll appear here as you play.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.name}
              className="atelier-divider flex min-h-[52px] items-center justify-between gap-3 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate font-classic-body text-sm text-premium-ivory">
                {r.name}
              </span>
              <span className="flex-none text-right font-classic-body text-xs text-premium-ivory/60">
                {r.accuracy !== null ? `${r.accuracy}% accuracy` : `${r.attempts === 0 ? "seen" : "practising"}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
