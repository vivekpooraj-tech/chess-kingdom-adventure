"use client";

import {
  resolveArrows,
  resolveSquares,
  type BoardOrientation,
  type TeachingArrow,
} from "@/lib/board/teachingOverlay";

/**
 * Teaching highlights drawn over a chess board.
 *
 * WHAT IT CANNOT DO, BY CONSTRUCTION.
 *
 * This never touches ChessBoard. It is a sibling element, absolutely
 * positioned over the board by the caller, with pointer-events disabled on
 * every node. It receives square NAMES and an orientation — never the game,
 * never a move handler. So it cannot select a piece, cannot make or suggest a
 * move to the engine, cannot alter what chess.js considers legal, and cannot
 * touch a clock. A learner tapping "where it points" is tapping the real
 * board underneath, and the real rules decide what happens.
 *
 * The caller is responsible for only ever passing squares that are legal in
 * the position — this component draws what it is told and validates only that
 * the squares exist. Ollie's demonstrations derive their squares from
 * chess.js itself (see BuddyChat), never from prose.
 *
 * Reduced motion is respected: the pulse is the only animation and it is
 * disabled outright rather than merely shortened.
 */
export function TeachingOverlay({
  squares = [],
  arrows = [],
  orientation = "w",
  /** A pulsing ring rather than a static one — draws the eye for a learner
   *  who is still scanning the board. Off under prefers-reduced-motion. */
  pulse = true,
  className = "",
}: {
  squares?: string[];
  arrows?: TeachingArrow[];
  orientation?: BoardOrientation;
  pulse?: boolean;
  className?: string;
}) {
  const marks = resolveSquares(squares, orientation);
  const lines = resolveArrows(arrows, orientation);
  if (marks.length === 0 && lines.length === 0) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 ${className}`}
      aria-hidden="true"
    >
      {marks.map(({ square, position }) => (
        <span
          key={square}
          className={`absolute rounded-[18%] ring-4 ring-inset ring-premium-gold/80 ${
            pulse ? "animate-pulse motion-reduce:animate-none" : ""
          }`}
          style={{
            left: `${position.col * 12.5}%`,
            top: `${position.row * 12.5}%`,
            width: "12.5%",
            height: "12.5%",
          }}
        />
      ))}

      {lines.length > 0 && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            <marker
              id="teaching-arrowhead"
              markerWidth="4"
              markerHeight="4"
              refX="3"
              refY="2"
              orient="auto"
            >
              <path d="M0,0 L4,2 L0,4 z" className="fill-premium-gold" />
            </marker>
          </defs>
          {lines.map((line, i) => (
            <line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              strokeWidth={1.6}
              strokeLinecap="round"
              markerEnd="url(#teaching-arrowhead)"
              className="stroke-premium-gold/85"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
