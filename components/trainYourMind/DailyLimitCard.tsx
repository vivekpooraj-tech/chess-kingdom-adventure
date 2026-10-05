import { backLabel } from "@/lib/navigation/destinations";
import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { TEXT } from "@/lib/designSystem";
import { FREE_DAILY_COMPLETIONS } from "@/lib/trainYourMind/dailyLimitRules";

/**
 * The free-daily-limit state for ONE Train Your Chess Mind category. Each of the eight
 * categories (Pattern, Visualization, Calculation, Memory, Spatial, Mathematics, Reaction
 * and Tactical Thinking) has its own 3 free completions a day, so this message names the
 * category that is used up — the others stay open.
 *
 * Warm, not a paywall wall: the child did real practice today, this says so, and points at
 * the rest of the app as well as Premium. No internal details are shown.
 */
export const limitTitle = (categoryLabel: string) => `Today's free ${categoryLabel} training is complete.`;
export const limitBody = (categoryLabel: string) =>
  `Come back tomorrow for ${FREE_DAILY_COMPLETIONS} more ${categoryLabel} exercises, or unlock Premium for unlimited Train Your Mind training.`;

/** Inline version — shown beneath a finished exercise so the learner keeps its result and
 *  explanation. */
export function DailyLimitNotice({ categoryLabel }: { categoryLabel: string }) {
  return (
    <div
      role="status"
      className="w-full rounded-premiumCard border border-premium-gold/30 bg-premium-gold/[0.06] p-4 flex flex-col items-center gap-3 text-center"
    >
      <p className="font-classic-display text-base text-premium-ivory">{limitTitle(categoryLabel)}</p>
      <p className="font-classic-body text-sm text-premium-ivory/70">{limitBody(categoryLabel)}</p>
      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        <Link
          href="/upgrade"
          className="font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center justify-center"
        >
          Unlock Premium
        </Link>
        <Link
          href="/chess-mind"
          className="font-classic-body text-sm text-premium-ivory/70 underline underline-offset-4 min-h-[44px] flex items-center justify-center"
        >
          Try another category
        </Link>
      </div>
    </div>
  );
}

/** Full-screen version — shown instead of an exercise when the learner opens a category whose
 *  3 free completions for today are used up. */
export function DailyLimitCard({ categoryLabel }: { categoryLabel: string }) {
  return (
    <Screen maxWidth="compact" topSafeArea="icons">
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>{categoryLabel}</h1>
      </div>

      <div className="mx-auto w-full max-w-md rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 flex flex-col items-center gap-4 text-center">
        <span className="text-4xl">🧠</span>
        <p className="font-classic-display text-lg text-premium-ivory">{limitTitle(categoryLabel)}</p>
        <p className="font-classic-body text-sm text-premium-ivory/65">{limitBody(categoryLabel)}</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2">
          <Link
            href="/upgrade"
            className="font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center justify-center"
          >
            Unlock Premium
          </Link>
          <Link
            href="/chess-mind"
            className="font-classic-body text-sm text-premium-ivory/70 underline underline-offset-4 min-h-[44px] flex items-center justify-center"
          >
            Try another category
          </Link>
        </div>
      </div>

      <Link
        href="/chess-mind"
        className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
      >
        {backLabel("TRAIN_YOUR_MIND")}
      </Link>
    </Screen>
  );
}
