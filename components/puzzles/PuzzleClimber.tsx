"use client";

/**
 * The Chess Mind adventurer — an original climbing figure, not a copy of
 * any other app's mascot. A small explorer with a backpack carrying a tiny
 * crown emblem (a nod to the Chess Mind brand, not a literal chess piece
 * costume), rendered as an SVG fragment so it can sit inside the tower
 * hero's own coordinate space and glide precisely from one ring to the
 * next.
 *
 * `climbing` swaps the idle pose for a mid-climb one (arm reaching up,
 * slight lean) for the brief moment the character is animating toward a
 * newly-unlocked floor. Idle motion is the existing `floaty` keyframe
 * (already in tailwind.config, used elsewhere in the app) rather than a
 * new one — a gentle 3s bob reads as "breathing", not as a distraction, and
 * `motion-reduce` turns it off entirely.
 */
export function PuzzleClimber({
  x,
  y,
  climbing,
  celebrating,
}: {
  /** Center position in the parent SVG's coordinate space. */
  x: number;
  y: number;
  /** True only while gliding between two rings. */
  climbing?: boolean;
  /** True for the brief celebratory beat when a new floor unlocks. */
  celebrating?: boolean;
}) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      className="transition-transform duration-[900ms] ease-in-out motion-reduce:transition-none"
    >
      <g
        className={
          celebrating
            ? "motion-safe:animate-pulse"
            : "motion-safe:animate-floaty motion-reduce:animate-none"
        }
      >
        {/* Backpack */}
        <rect x="-9" y="-4" width="7" height="11" rx="2.5" fill="#B8631F" />
        <rect x="-8" y="-1" width="5" height="3" rx="1" fill="#FFC53D" />

        {/* Body */}
        <ellipse cx="0" cy="4" rx="7.5" ry="9" fill="#3B6FE0" />

        {/* Head */}
        <circle cx="0" cy="-10" r="6.5" fill="#F3C89A" />
        {/* Hair */}
        <path d="M-6 -13 Q0 -19 6 -13 Q4 -16 0 -16 Q-4 -16 -6 -13 Z" fill="#4A3524" />

        {/* Tiny crown on the backpack strap — the one Chess Mind touch on
            an otherwise plain explorer, not a costume. */}
        <path d="M-4 -3 L-3 -5 L-2 -3.5 L-1 -5.5 L0 -3 L-4 -3 Z" fill="#FFC53D" />

        {/* Arm — reaches upward while climbing/celebrating, relaxed at rest. */}
        {climbing || celebrating ? (
          <path d="M6 2 Q11 -4 9 -10" stroke="#F3C89A" strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M6 3 Q10 6 8 11" stroke="#F3C89A" strokeWidth="3" strokeLinecap="round" fill="none" />
        )}
        <path d="M-6 3 Q-10 6 -8 11" stroke="#F3C89A" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Legs */}
        <path d="M-3 12 L-4 19" stroke="#2A2F55" strokeWidth="3" strokeLinecap="round" />
        <path d="M3 12 L4 19" stroke="#2A2F55" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  );
}
