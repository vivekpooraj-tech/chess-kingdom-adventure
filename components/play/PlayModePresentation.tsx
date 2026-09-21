import type { ReactNode } from "react";

/**
 * Mode-aware Play presentation switch — same proven pattern as
 * components/home/HomeModePresentation.tsx (Phase 2.1-F): a plain Server
 * Component that renders all three compositions into the HTML on every
 * request, each wrapped in a sibling `<div>` carrying a `play-mode-panel-*`
 * hook class. app/modes.css shows exactly one, driven by the same
 * `[data-mode]` attribute ModeBootstrapScript writes onto <html> before the
 * browser paints anything — so there is no client component, no useEffect
 * correction, and nothing to flash. See app/modes.css's "PLAY MODE
 * PRESENTATION" block for the CSS half of this switch.
 *
 * Uses its own `play-mode-panel-*` classnames (not Home's `home-mode-panel-*`)
 * and is expected to sit inside `.play-mode-scope`, not `.home-mode-scope`,
 * so Play's rules can never apply to Home or vice versa.
 */
export function PlayModePresentation({
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
      <div className="play-mode-panel play-mode-panel-classic-pro">{classicPro}</div>
      <div className="play-mode-panel play-mode-panel-adult">{adult}</div>
      <div className="play-mode-panel play-mode-panel-kids">{kids}</div>
    </>
  );
}
