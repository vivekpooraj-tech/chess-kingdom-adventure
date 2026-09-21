import Link from "next/link";
import type { RecentReviewRow } from "@/lib/supabase/queries";
import { TEXT } from "@/lib/designSystem";

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Adult's "Recent Match Archives & Review" panel (Phase 2.1-C) — reuses
 * getRecentGameReviews() (already used by app/stats/page.tsx), which is
 * genuinely richer than getPlayedGames() (used by Classic/Pro's Recent
 * Games): real accuracy/mistake/blunder counts from the actual review
 * pipeline, not just result/time-control. This is Adult's own distinct
 * data source, not the Classic/Pro panel re-skinned. Links to /stats,
 * where the full review history and per-game reviews already live — no
 * new review route was created.
 */
export function RecentReviewPanel({ reviews }: { reviews: RecentReviewRow[] }) {
  const preview = reviews.slice(0, 3);

  return (
    <div className="atelier-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="atelier-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            Match Archive
          </p>
          <h2 className={TEXT.heading}>Recent Reviews</h2>
        </div>
        {reviews.length > 0 && (
          <Link href="/stats" className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2">
            See all
          </Link>
        )}
      </div>

      {preview.length === 0 ? (
        <p className={TEXT.body}>No reviewed games yet — play one and its review will appear here.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {preview.map((r, i) => (
            <li
              key={`${r.reviewedAt}-${i}`}
              className="atelier-divider flex min-h-[56px] flex-col justify-center gap-0.5 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-classic-body text-sm text-premium-ivory">
                  {r.openingName ?? "Game reviewed"}
                </span>
                {r.accuracy !== null && (
                  <span className="font-classic-body text-sm font-semibold text-[color:rgb(212_175_133)]">
                    {Math.round(r.accuracy)}% accuracy
                  </span>
                )}
              </span>
              <span className={TEXT.caption}>
                {r.result ? `${r.result} · ` : ""}
                {r.blunders > 0 ? `${r.blunders} blunder${r.blunders === 1 ? "" : "s"} · ` : ""}
                {formatDate(r.reviewedAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
