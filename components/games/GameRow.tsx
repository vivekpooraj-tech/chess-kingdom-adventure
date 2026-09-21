import Link from "next/link";
import type { PlayedGameRow } from "@/lib/supabase/queries";
import { getTimeControl } from "@/content/timeControls";
import { TEXT } from "@/lib/designSystem";

function opponentLabel(g: PlayedGameRow): string {
  if (g.tournamentId) return "Tournament game";
  return g.matchType === "random" ? "Online Opponent" : "Friend Match";
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One completed-game row — rendered ONCE per game regardless of mode (see
 * app/games/page.tsx: the 100-game list is fetched and mapped exactly once).
 * Only the RESULT label and the REVIEW call-to-action have wording that
 * differs per mode (per the locked Stitch designs); each carries three small
 * `game-result-variant-*` / `game-review-variant-*` spans, and app/modes.css
 * shows exactly one via the same pre-hydration `[data-mode]` CSS switch
 * Home and Play already use — so this stays a single <Link> per game (one
 * interactive element, no duplicated markup for assistive tech) instead of
 * tripling the whole row. Everything else (meta line, rating delta) is
 * shared markup whose VISUAL treatment (not wording) is varied entirely
 * through .games-mode-scope CSS. Tournament games already surface through
 * the existing "Tournament game" opponentLabel() text (unchanged from
 * baseline) — no separate badge, to avoid saying it twice in Adult mode.
 */
export function GameRow({ game: g }: { game: PlayedGameRow }) {
  const tc = g.timeControl ? getTimeControl(g.timeControl).label : "Untimed";
  const delta =
    typeof g.ratingBefore === "number" && typeof g.ratingAfter === "number" ? g.ratingAfter - g.ratingBefore : null;

  return (
    <li>
      <Link
        href={`/online/${g.id}`}
        className="game-row flex min-h-[64px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 py-3 transition-colors hover:border-premium-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
      >
        {/* Result is carried by words (and, in Classic/Pro, a glyph too), not colour alone. */}
        <span className="game-result flex w-14 flex-none flex-col items-center font-classic-body text-xs">
          <span className={`game-result-variant game-result-variant-classic-pro game-result-${g.result}`}>
            <span aria-hidden="true" className="game-result-glyph block text-sm leading-none">
              {g.result === "win" ? "▲" : g.result === "loss" ? "▼" : "="}
            </span>
            {g.result === "win" ? "WIN" : g.result === "loss" ? "LOSS" : "DRAW"}
          </span>
          <span className={`game-result-variant game-result-variant-adult game-result-${g.result}`}>
            {g.result === "win" ? "Win" : g.result === "loss" ? "Loss" : "Draw"}
          </span>
          <span className={`game-result-variant game-result-variant-kids game-result-${g.result}`}>
            {g.result === "win"
              ? "You won! 🎉"
              : g.result === "loss"
                ? "So close — try again!"
                : "A draw — well played!"}
          </span>
        </span>

        <span className="flex min-w-0 flex-1 flex-col game-meta">
          <span className="game-meta-primary flex items-center gap-2 font-classic-body text-sm text-premium-ivory">
            {opponentLabel(g)}
          </span>
          <span className={`${TEXT.caption} game-meta-secondary`}>
            {g.color === "w" ? "White" : "Black"} · {tc} · {formatDate(g.playedAt)}
          </span>
        </span>

        {delta !== null && (
          <span
            className={`game-rating-delta flex-none font-classic-body text-sm ${
              delta > 0 ? "text-premium-gold" : "text-premium-ivory/55"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}

        <span className="game-review flex-none text-premium-gold">
          <span className="game-review-variant game-review-variant-classic-pro">Review Match →</span>
          <span className="game-review-variant game-review-variant-adult">Review game →</span>
          <span className="game-review-variant game-review-variant-kids">Look at Game →</span>
        </span>
      </Link>
    </li>
  );
}
