import Link from "next/link";
import type { PlayedGameRow } from "@/lib/supabase/queries";
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
 */
function resultLabel(result: "win" | "loss" | "draw"): { text: string; badgeClass: string; glyph: string } {
  if (result === "win") return { text: "Win", badgeClass: "cp-badge-win", glyph: "▲" };
  if (result === "loss") return { text: "Loss", badgeClass: "cp-badge-loss", glyph: "▼" };
  return { text: "Draw", badgeClass: "cp-badge-draw", glyph: "=" };
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function RecentGamesPreview({ games }: { games: PlayedGameRow[] }) {
  const preview = games.slice(0, 3);

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

      {preview.length === 0 ? (
        <p className={TEXT.body}>No finished games yet — play one and it will show up here.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {preview.map((g) => {
            const r = resultLabel(g.result);
            const tc = g.timeControl ? getTimeControl(g.timeControl).label : "Untimed";
            const delta =
              typeof g.ratingBefore === "number" && typeof g.ratingAfter === "number"
                ? g.ratingAfter - g.ratingBefore
                : null;
            return (
              <li key={g.id}>
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
          })}
        </ol>
      )}
    </div>
  );
}
