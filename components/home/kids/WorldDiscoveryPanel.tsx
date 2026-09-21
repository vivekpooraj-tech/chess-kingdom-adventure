import Link from "next/link";
import { WORLD_LOCATIONS, WORLD_TAGLINE } from "@/lib/world/locations";
import { TEXT } from "@/lib/designSystem";

/**
 * Kids' "World Discovery Map" panel (Phase 2.1-D) — the real, static
 * WORLD_LOCATIONS content (already used by /world), not invented places.
 * app/world/page.tsx's own comment explains why there are no locked
 * "coming soon" cards there ("a lock implies a progression system, and
 * there isn't one") — this panel honours the same rule: every location
 * shown here is real and playable today, with no fabricated lock state.
 */
export function WorldDiscoveryPanel() {
  return (
    <div className="kingdom-panel home-surface-card flex h-full flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="kingdom-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            World Discovery Map
          </p>
          <h2 className={TEXT.heading}>{WORLD_TAGLINE}</h2>
        </div>
        <Link href="/world" className="flex-none font-classic-body text-xs text-premium-gold underline underline-offset-2">
          Full Map
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {WORLD_LOCATIONS.map((loc) => (
          <Link
            key={loc.id}
            href="/world"
            className="kingdom-divider flex min-h-[76px] flex-col justify-center gap-1 rounded-premiumBtn border border-white/10 bg-premium-midnight/40 px-3 py-2 transition-colors hover:border-premium-gold/30"
          >
            <span className="text-xl" aria-hidden="true">{loc.emoji}</span>
            <span className="font-classic-body text-sm text-premium-ivory">{loc.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
