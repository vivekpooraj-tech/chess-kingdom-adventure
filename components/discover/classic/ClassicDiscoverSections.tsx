import Link from "next/link";
import { SECTIONS } from "@/content/discoverSections";
import { TEXT } from "@/lib/designSystem";

/**
 * Classic/Pro Discover composition — "Discover". Same 5 sections/routes as
 * every other mode (rendered directly from the shared SECTIONS array, never
 * redefined here); compact, information-dense rows, terse "SOON" badge.
 */
export function ClassicDiscoverSections() {
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>Discover</h1>
        <p className={`${TEXT.body} mt-2`}>Where chess came from, and the stories behind the pieces.</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        {SECTIONS.map((section) =>
          "soon" in section ? (
            <div
              key={section.id}
              className="discover-row list-row flex items-center gap-3 rounded-premiumCard bg-premium-navy/40 border border-white/5 p-4 opacity-60"
            >
              <span className="text-2xl flex-none">{section.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-sm text-premium-ivory">{section.title}</p>
                <p className={TEXT.caption}>{section.description}</p>
              </div>
              <span className="discover-soon-badge font-classic-body text-[10px] font-semibold text-premium-ivory/50 border border-white/15 rounded-full px-2 py-1 whitespace-nowrap flex-none">
                SOON
              </span>
            </div>
          ) : (
            <Link
              key={section.id}
              href={section.href}
              className="discover-row list-row flex items-center gap-3 rounded-premiumCard bg-premium-navy shadow-premiumCard border border-white/5 p-4"
            >
              <span className="text-2xl flex-none">{section.emoji}</span>
              <div className="flex-1">
                <p className="font-classic-display text-sm text-premium-ivory">{section.title}</p>
                <p className={TEXT.caption}>{section.description}</p>
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
