import Link from "next/link";
import { PremiumCta } from "@/components/premium/PremiumCta";
import { TEXT } from "@/lib/designSystem";

export const metadata = {
  title: "Unlock Premium · Chess Mind",
  description: "One payment, one year of everything Chess Mind Premium unlocks.",
};

/**
 * Launch-day QA fix — /upgrade had no page.tsx (only /upgrade/success
 * existed). Seven live "Unlock/Get Premium" links across the app
 * (app/academy/openings/[openingId]/page.tsx, app/parent-dashboard/page.tsx
 * x2, components/academy/CourseLessonRunner.tsx,
 * components/game/analysis/PostGameAnalysis.tsx,
 * components/school/v2/UnlockSchoolButton.tsx,
 * components/trainYourMind/DailyLimitCard.tsx) pointed at this route and
 * 404'd — the single most severe finding of this QA pass, since it broke
 * the Premium upsell at exactly the in-the-moment paywall touchpoints
 * (Game Review, a locked lesson, a daily-limit hit) that matter most for
 * conversion. The Parent Dashboard's own embedded UpgradeButton still
 * worked throughout (it never navigated here), so purchasing itself was
 * never broken — only this specific "learn more / get premium" landing
 * target was missing.
 *
 * Deliberately reuses the existing canonical upsell block (PremiumCta,
 * which itself renders the real UpgradeButton — same Stripe checkout call,
 * same server-resolved price, nothing new here) rather than designing a
 * new page. Bare/full-screen like its sibling /upgrade/success (not in
 * navConfig.tsx's APP_PREFIXES), for the same reason: a purchase-adjacent
 * screen, not a tab destination.
 */
export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="w-full max-w-sm rounded-premiumCard bg-premium-navy shadow-premiumCard p-6 sm:p-7">
        <PremiumCta />
      </div>
      <Link
        href="/kingdom-map"
        className={`${TEXT.caption} underline underline-offset-4 hover:text-premium-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded`}
      >
        Back to Home
      </Link>
    </main>
  );
}
