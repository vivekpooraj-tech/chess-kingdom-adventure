import type { ReactNode } from "react";

/**
 * Mode-aware Chess School presentation switch — same proven pattern as
 * every prior Phase 2.2 page: a plain Server Component rendering all three
 * compositions into the HTML on every request, each in a sibling
 * `chess-school-mode-panel-*` div, shown one at a time via the pre-hydration
 * `[data-mode]` attribute ModeBootstrapScript sets on <html> before paint.
 * All three panels are built from the exact same ChessSchoolData object
 * (app/chess-school/page.tsx computes it once) — no query, no progress
 * calculation, and no CourseJourney/GraduationPanel render is ever
 * duplicated logic, only duplicated presentation.
 */
export function ChessSchoolModePresentation({
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
      <div className="chess-school-mode-panel chess-school-mode-panel-classic-pro">{classicPro}</div>
      <div className="chess-school-mode-panel chess-school-mode-panel-adult">{adult}</div>
      <div className="chess-school-mode-panel chess-school-mode-panel-kids">{kids}</div>
    </>
  );
}
