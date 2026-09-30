import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { TEXT } from "@/lib/designSystem";

/**
 * Shown in place of a Train Your Mind category once its free daily limit is
 * used up (Phase 4). Deliberately warm, not a paywall wall: the child did
 * real practice today, this says so, and points at the rest of the app
 * rather than only at Premium.
 */
export function DailyLimitCard({ categoryLabel }: { categoryLabel: string }) {
  return (
    <Screen maxWidth="compact">
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>{categoryLabel}</h1>
      </div>

      <div className="mx-auto w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-4 text-center">
        <span className="text-4xl">🧠</span>
        <p className="font-classic-display text-lg text-premium-ivory">
          Great focus today!
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/65">
          You've done today's {categoryLabel.toLowerCase()} practice. Come back tomorrow for more —
          or unlock Premium for unlimited practice, any time.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2">
          <Link
            href="/puzzles"
            className="font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center justify-center"
          >
            Solve a Puzzle Instead
          </Link>
          <Link
            href="/upgrade"
            className="font-classic-body text-sm text-premium-ivory/70 underline underline-offset-4 min-h-[44px] flex items-center justify-center"
          >
            Unlock unlimited practice
          </Link>
        </div>
      </div>

      <Link
        href="/chess-mind"
        className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
      >
        Back to Chess Mind
      </Link>
    </Screen>
  );
}
