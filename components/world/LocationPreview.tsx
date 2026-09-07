"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { WorldLocation } from "@/lib/world/locations";
import { useWorldLocation } from "@/lib/world/useWorldLocation";
import { getScene } from "./sceneRegistry";

/**
 * The pre-game screen for one location.
 *
 * It shows the real scene behind the copy rather than a still, so what is
 * being promised is exactly what arrives — and it doubles as the honest
 * performance test: if the scene stutters here, it would have stuttered
 * mid-game.
 *
 * "Enter" stores the choice and hands off to the existing play hub. It starts
 * no game itself: matchmaking, time controls and opponents are the app's
 * concern and this feature does not get an opinion about them.
 */
export function LocationPreview({ location }: { location: WorldLocation }) {
  const router = useRouter();
  const { select } = useWorldLocation();
  // Same registry the in-game backdrop uses, so the preview can never show a
  // different scene from the one the game will.
  const Scene = getScene(location.id);

  const enter = () => {
    select(location.id);
    router.push("/play");
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      {Scene && <Scene />}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-2xl flex-col justify-center px-5 py-16">
        <div className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur-md sm:p-8">
          <p className="font-classic-body text-[11px] uppercase tracking-[0.2em] text-premium-gold/80">
            Chess Mind World
          </p>

          <h1 className="mt-3 font-classic-display text-3xl text-premium-ivory sm:text-4xl">
            {location.name}
          </h1>

          <p className="mt-1 font-classic-display text-lg text-premium-gold">{location.title}</p>

          <p className="mt-2 flex items-center gap-2 font-classic-body text-sm text-premium-ivory/65">
            {location.city}, {location.country}
          </p>

          <p className="mt-5 font-classic-body text-sm leading-relaxed text-premium-ivory/80">
            {location.description}
          </p>

          {/* Said plainly and early. A themed board could easily read as
              "premium players get an advantage", and that impression is much
              cheaper to prevent here than to correct later. */}
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-classic-body text-xs leading-relaxed text-premium-ivory/60">
            A location changes the view, not the game. Same rules, same clocks, same rating — and
            your opponent sees whichever place they chose.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={enter}
              className="flex-1 rounded-premiumBtn bg-premium-gold px-6 py-3 font-classic-display text-base text-premium-midnightDeep transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-premium-gold motion-reduce:hover:scale-100"
            >
              Enter the {location.name}
            </button>
            <Link
              href="/world"
              className="rounded-premiumBtn border border-white/15 px-6 py-3 text-center font-classic-body text-sm text-premium-ivory/75 transition-colors hover:border-premium-gold/40 hover:text-premium-ivory"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
