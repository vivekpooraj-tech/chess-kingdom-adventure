import type { ReactNode } from "react";

/**
 * Mode-aware Discover presentation switch — same proven pattern as
 * HomeModePresentation/PlayModePresentation/the Games header switch: a
 * plain Server Component rendering all three compositions into the HTML on
 * every request, each in a sibling `discover-mode-panel-*` div, shown one
 * at a time via the pre-hydration `[data-mode]` attribute ModeBootstrapScript
 * sets on <html> before paint. Discover is small enough (5 rows total) that
 * tripling the whole composition — unlike Games' 100-row list — costs
 * nothing, so there's no need for Games' per-row text-variant technique
 * here. All three panels render from the same shared `SECTIONS` array
 * (content/discoverSections.ts), so routes/soon-status are defined once.
 */
export function DiscoverModePresentation({
  classicPro,
  adult,
  kids,
}: {
  classicPro: ReactNode;
  adult: ReactNode;
  kids: ReactNode;
}) {
  return (
    <>
      <div className="discover-mode-panel discover-mode-panel-classic-pro">{classicPro}</div>
      <div className="discover-mode-panel discover-mode-panel-adult">{adult}</div>
      <div className="discover-mode-panel discover-mode-panel-kids">{kids}</div>
    </>
  );
}
