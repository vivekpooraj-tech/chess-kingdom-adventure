import Link from "next/link";
import { SECTIONS } from "@/content/discoverSections";
import { TEXT } from "@/lib/designSystem";

// Slightly more descriptive copy for the 3 live topics only — still
// truthful to the same real content, presentation-only (no new topics, no
// new claims). The 2 "soon" rows keep their base description from
// content/discoverSections.ts.
const ADULT_DESCRIPTION: Record<string, string> = {
  history: "How the game travelled from ancient India to the board in front of you.",
  pieces: "What each piece can do, and where its name came from.",
  "opening-stories": "Where openings like the Italian Game and the Sicilian earned their names.",
};

/**
 * Adult ("Master Training Atelier") Discover composition — "Chess History &
 * Theory". Same 5 sections/routes as every other mode (rendered directly
 * from the shared SECTIONS array); calmer, more spacious rows, champagne
 * accent, "Coming soon" wording.
 */
export function AdultDiscoverSections() {
  return (
    <div className="w-full flex flex-col gap-5">
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>Chess History &amp; Theory</h1>
        <p className={`${TEXT.body} mt-2`}>
          A quiet corner of the app for the stories behind the game — for reading, not training.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {SECTIONS.map((section) =>
          "soon" in section ? (
            <div
              key={section.id}
              className="discover-row list-row flex items-center gap-4 rounded-premiumCard bg-premium-navy/40 border border-white/5 p-5 opacity-60"
            >
              <span className="text-2xl flex-none">{section.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">{section.title}</p>
                <p className={TEXT.caption}>{ADULT_DESCRIPTION[section.id] ?? section.description}</p>
              </div>
              <span className="discover-soon-badge font-classic-body text-xs whitespace-nowrap flex-none">
                Coming soon
              </span>
            </div>
          ) : (
            <Link
              key={section.id}
              href={section.href}
              className="discover-row list-row flex items-center gap-4 rounded-premiumCard bg-premium-navy shadow-premiumCard border border-white/5 p-5"
            >
              <span className="text-2xl flex-none">{section.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-base text-premium-ivory">{section.title}</p>
                <p className={TEXT.caption}>{ADULT_DESCRIPTION[section.id] ?? section.description}</p>
              </div>
              <span className="discover-cta text-lg flex-none">→</span>
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
