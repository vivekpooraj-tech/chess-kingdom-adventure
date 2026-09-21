import Link from "next/link";
import { SECTIONS } from "@/content/discoverSections";
import { TEXT } from "@/lib/designSystem";

/**
 * Kids ("Enchanted Kingdom") Discover composition — "Explore the Kingdom's
 * Stories". Same 5 sections/routes as every other mode (rendered directly
 * from the shared SECTIONS array); rounded cards, larger touch targets,
 * friendly "Coming soon!" wording. No XP/unlocks — the "soon" rows stay
 * exactly as unavailable as they are in every other mode.
 */
export function KidsDiscoverSections() {
  return (
    <div className="w-full flex flex-col gap-5">
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>Explore the Kingdom&apos;s Stories</h1>
        <p className={`${TEXT.body} mt-2`}>Come see where chess came from and the tales behind it!</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {SECTIONS.map((section) =>
          "soon" in section ? (
            <div
              key={section.id}
              className="discover-row list-row flex items-center gap-4 rounded-premiumCard bg-premium-navy/40 border border-white/5 p-5 opacity-60"
            >
              <span className="text-3xl flex-none">{section.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">{section.title}</p>
                <p className={TEXT.caption}>{section.description}</p>
              </div>
              <span className="discover-soon-badge font-classic-body text-xs font-semibold whitespace-nowrap flex-none">
                Coming soon!
              </span>
            </div>
          ) : (
            <Link
              key={section.id}
              href={section.href}
              className="discover-row list-row flex items-center gap-4 rounded-premiumCard bg-premium-navy shadow-premiumCard border border-white/5 p-5 min-h-[76px]"
            >
              <span className="text-3xl flex-none">{section.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">{section.title}</p>
                <p className={TEXT.caption}>{section.description}</p>
              </div>
              <span className="discover-cta text-xl flex-none">→</span>
            </Link>
          )
        )}
      </div>

      <Link
        href="/kingdom-map"
        className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
      >
        Back to Home
      </Link>
    </div>
  );
}
