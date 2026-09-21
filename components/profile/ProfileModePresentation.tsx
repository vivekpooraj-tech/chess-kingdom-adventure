import type { ReactNode } from "react";

/**
 * Mode-aware Profile presentation switch — same proven pattern as
 * HomeModePresentation/PlayModePresentation/DiscoverModePresentation: a
 * plain Server Component rendering all three compositions into the HTML on
 * every request, each in a sibling `profile-mode-panel-*` div, shown one at
 * a time via the pre-hydration `[data-mode]` attribute ModeBootstrapScript
 * sets on <html> before paint. All three panels are built from the exact
 * same ProfileData object (app/profile/page.tsx computes it once), so no
 * query or derived value is ever recalculated per mode.
 */
export function ProfileModePresentation({
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
      <div className="profile-mode-panel profile-mode-panel-classic-pro">{classicPro}</div>
      <div className="profile-mode-panel profile-mode-panel-adult">{adult}</div>
      <div className="profile-mode-panel profile-mode-panel-kids">{kids}</div>
    </>
  );
}
