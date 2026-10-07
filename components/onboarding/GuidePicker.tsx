"use client";

import type { BuddyOption } from "@/lib/types";
import { GUIDE_ART, GUIDE_BLURB } from "./guideArt";

/**
 * The signup guide screen, presentation only ("Meet your guide"). It shows the one guide that exists (Ollie) and a single primary button. The page
 * (app/onboarding/buddy/page.tsx) owns every bit of logic: the signed-in child, the selected guide id, saving it and moving on. This component only
 * draws the guide it is given and calls the handler it is given; it holds no state of its own. Styles: `.gd-*` (and the shared `.cp-*` ground and
 * button) in app/world-onboarding.css (Enchanted Kingdom).
 */
export function GuidePicker({
  guide,
  saving,
  onConfirm,
}: {
  guide: BuddyOption;
  saving: boolean;
  onConfirm: () => void;
}) {
  const art = GUIDE_ART[guide.id];
  // "Ollie the Owl" -> "Ollie": the button and the line under the title use the guide's first name, taken from the data.
  const first = guide.name.split(" ")[0];
  return (
    <div className="cp-wrap">
      <header className="cp-head world-enter">
        <h1 className="cp-title">Meet your guide</h1>
        <p className="cp-lede">Meet {first}, your Chess Mind companion.</p>
      </header>

      <figure className="gd-card world-enter world-enter-delay-1" data-guide={guide.id}>
        <div className={`gd-plate${art ? " gd-plate--art" : ""}`}>
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" className="gd-art" loading="eager" />
          ) : (
            <span className="gd-emoji" aria-hidden="true">{guide.emoji}</span>
          )}
        </div>
        <figcaption className="gd-caption">
          <span className="gd-name">{guide.name}</span>
          <span className="gd-blurb">{GUIDE_BLURB[guide.id]}</span>
        </figcaption>
      </figure>

      <button type="button" className="cp-cta" disabled={saving} onClick={onConfirm}>
        {saving ? "Saving..." : `Meet ${first} →`}
      </button>
    </div>
  );
}
