import Link from "next/link";
import type { PlayedGameRow, RecentReviewRow } from "@/lib/supabase/queries";
import { getTimeControl } from "@/content/timeControls";
import { TEXT } from "@/lib/designSystem";

/**
 * Home's "Recent Match Recap" (Classic/Pro, Phase 2.1-B / 2.1-B.1) — the
 * same getPlayedGames() data /games already renders, trimmed to a short
 * preview. No new query logic: this is the existing function, called once
 * more from Home. Opponents are labelled, never named, matching the
 * privacy choice already made in app/games/page.tsx.
 *
 * Phase 2.1-B.1 adds a rating-delta badge using ratingBefore/ratingAfter —
 * both already returned by getPlayedGames(), not new data — so a win/loss
 * reads as a real number, not just a coloured glyph.
 *
 * AI-games fix: online_games (getPlayedGames) only ever holds Friendly/
 * Random/Tournament games — Free Play has no server-side game row at all.
 * Reviewed Free Play games DO exist, in child_game_reviews, already fetched
 * once by kingdom-map/page.tsx for Adult's "Recent Reviews" panel
 * (getRecentGameReviews) — reused here rather than a second query. The two
 * shapes are merged into one preview, newest first, capped at 3. A Free
 * Play row has no game id to link to and is never rated, so it renders as
 * a plain (non-link) row with result/date/accuracy instead of a clickable
 * row with a rating delta.
 */
function resultLabel(result: "win" | "loss" | "draw"): { text: string; badgeClass: string; glyph: string } {
  if (result === "win") return { text: "Win", badgeClass: "cp-badge-win", glyph: "▲" };
  if (result === "loss") return { text: "Loss", badgeClass: "cp-badge-loss", glyph: "▼" };
  return { text: "Draw", badgeClass: "cp-badge-draw", glyph: "=" };
}

function toResult(result: string | null): "win" | "loss" | "draw" {
  return result === "win" || result === "loss" ? result : "draw";
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

type MergedRow =
  | { kind: "online"; playedAt: string; game: PlayedGameRow }
  | { kind: "free_play"; playedAt: string; review: RecentReviewRow };

export function RecentGamesPreview({
  games,
  reviews,
}: {
  games: PlayedGameRow[];
  reviews: RecentReviewRow[];
}) {
  const freePlayReviews = reviews.filter((r) => r.source === "free_play");
  const merged: MergedRow[] = [
    ...games.map((game): MergedRow => ({ kind: "online", playedAt: game.playedAt, game })),
    ...freePlayReviews.map((review): MergedRow => ({ kind: "free_play", playedAt: review.reviewedAt, review })),
  ].sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));
  const preview = merged.slice(0, 3);
  const hasAny = games.length > 0 || freePlayReviews.length > 0;

  return (
    <div className="cp-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="cp-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            Match Recap
          </p>
          <h2 className={TEXT.heading}>Recent Games</h2>
        </div>
        {games.length > 0 && (
          <Link href="/games" className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2">
            See all
          </Link>
        )}
      </div>

      {!hasAny ? (
        <div className="flex flex-col gap-2">
          <p className={TEXT.body}>No finished games yet — play one and it will show up here.</p>
          <Link
            href="/play"
            className="self-start font-classic-body text-xs text-premium-gold underline underline-offset-2"
          >
            Play now →
          </Link>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {preview.map((row) => {
            if (row.kind === "online") {
              const g = row.game;
              const r = resultLabel(g.result);
              const tc = g.timeControl ? getTimeControl(g.timeControl).label : "Untimed";
              const delta =
                typeof g.ratingBefore === "number" && typeof g.ratingAfter === "number"
                  ? g.ratingAfter - g.ratingBefore
                  : null;
              return (
                <li key={`online-${g.id}`}>
                  <Link
                    href={`/online/${g.id}`}
                    className="flex min-h-[56px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2 transition-colors hover:border-premium-gold/30"
                  >
                    <span
                      className={`flex w-12 flex-none flex-col items-center rounded-premiumBtn py-1 font-classic-body text-[11px] font-semibold ${r.badgeClass}`}
                    >
                      <span aria-hidden="true" className="text-sm leading-none">{r.glyph}</span>
                      {r.text}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-classic-body text-sm text-premium-ivory">
                        {g.tournamentId ? "Tournament game" : g.matchType === "random" ? "Online Opponent" : "Friend Match"}
                      </span>
                      <span className={TEXT.caption}>
                        {tc} · {formatDate(g.playedAt)}
                      </span>
                    </span>
                    {delta !== null && (
                      <span
                        className={`flex-none font-classic-body text-sm font-semibold ${
                          delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-premium-ivory/55"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                  </Link>
                </li>
              );
            }

            // Free Play review — no server-side game row to link to, and
            // Free Play is never rated, so this renders as a plain row
            // (result/date/accuracy) rather than a clickable one with a
            // rating delta.
            const review = row.review;
            const r = resultLabel(toResult(review.result));
            return (
              <li key={`review-${review.reviewedAt}`}>
                <div className="flex min-h-[56px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2">
                  <span
                    className={`flex w-12 flex-none flex-col items-center rounded-premiumBtn py-1 font-classic-body text-[11px] font-semibold ${r.badgeClass}`}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">{r.glyph}</span>
                    {r.text}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-classic-body text-sm text-premium-ivory">vs Computer</span>
                    <span className={TEXT.caption}>
                      {typeof review.accuracy === "number" ? `${Math.round(review.accuracy)}% accuracy · ` : ""}
                      {formatDate(review.reviewedAt)}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
