import Link from "next/link";
import { OpeningMatch } from "@/lib/openings/recognitionEngine";

/**
 * Subtle, dismissible notification — not a blocking modal, per the product
 * spec. Sits near the board; the caller controls dismissal state (this
 * component is presentational only) so it can reappear if a MORE specific
 * opening is later recognized (e.g. Italian Game -> Evans Gambit) even
 * after the child dismissed the first one.
 */
export function OpeningBadge({ match, onDismiss }: { match: OpeningMatch; onDismiss: () => void }) {
  const { opening } = match;
  // First sentence only — the badge is a subtle, glanceable notice, not a
  // place to read the opening's full description (that's what the Academy
  // detail page linked below is for).
  const oneLiner = opening.description.split(/(?<=[.!?])\s/)[0];

  return (
    <div className="w-full max-w-[480px] rounded-premiumCard bg-premium-navy border border-premium-gold/30 shadow-premiumCard px-4 py-3 flex items-start gap-3">
      <span className="text-xl flex-none">{match.isGambit ? "⚔️" : "♟"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-classic-display text-sm text-premium-gold">
            {opening.name.toUpperCase()}
          </p>
          {match.isGambit && (
            <span className="font-classic-body text-[11px] font-semibold text-red-300 border border-red-400/30 rounded-full px-1.5 py-0.5">
              GAMBIT
            </span>
          )}
          <span className="font-classic-body text-[11px] text-premium-ivory/30">
            {match.ecoCode}
          </span>
        </div>
        <p className="font-classic-body text-xs text-premium-ivory/60 mt-1 leading-relaxed">
          {match.isGambit ? oneLiner : `You've entered the ${opening.name}. ${oneLiner}`}
        </p>
        <Link
          href={`/academy/openings/${opening.id}`}
          className="font-classic-body text-xs text-premium-gold underline underline-offset-2 mt-1.5 inline-block"
        >
          {match.isGambit ? "Explore →" : "Learn this opening →"}
        </Link>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-premium-ivory/30 hover:text-premium-ivory/60 flex-none text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
