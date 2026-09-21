import type { ReactNode } from "react";

/**
 * Mode-aware Learn presentation switch — same proven pattern as
 * HomeModePresentation/PlayModePresentation/DiscoverModePresentation/
 * ProfileModePresentation: a plain Server Component rendering all three
 * compositions into the HTML on every request, each in a sibling
 * `learn-mode-panel-*` div, shown one at a time via the pre-hydration
 * `[data-mode]` attribute ModeBootstrapScript sets on <html> before paint.
 * Learn has no async data of its own — the real client islands
 * (NextLessonCard, LearningPathPanel, CourseStatusChip) fetch their own
 * data exactly as before, unmodified, inside whichever panel renders them.
 */
export function LearnModePresentation({
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
      <div className="learn-mode-panel learn-mode-panel-classic-pro">{classicPro}</div>
      <div className="learn-mode-panel learn-mode-panel-adult">{adult}</div>
      <div className="learn-mode-panel learn-mode-panel-kids">{kids}</div>
    </>
  );
}
