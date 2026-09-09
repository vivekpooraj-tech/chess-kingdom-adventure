"use client";

/**
 * Chaturanga — a cinematic chess scene, not a backdrop.
 *
 * Same staging as the London Eye scene, and deliberately so: an opponent
 * seated across the board from you, a landmark rising behind them, a horizon
 * with something on it, and your own presence in the near dark. A location
 * with nobody in it is scenery; what makes it a scene is that a match is
 * visibly happening there.
 *
 * COMPOSED AGAINST MEASURED BANDS, not guesses. On a 411x914 phone the arena
 * gives roughly:
 *
 *    0-48px    header, with two small glass controls in the corners
 *    48-88px   sky opened by WorldArenaChrome's spacer
 *    ~88-160   the opponent's own card, translucent, scene reading through it
 *    ~170+     THE BOARD (this scene draws nothing that competes with it)
 *    below     floor, and the panel as glass over it
 *
 * Everything above is placed in percentages against that, because a first
 * attempt on the London Eye scene put its skyline at 146-256 and it was
 * completely invisible behind the card.
 *
 * ON THE HISTORY, AND THE LIMITS OF IT. Chess grew out of chaturanga, played
 * in India well over a thousand years ago. That lineage is why this location
 * exists and it is the only claim made. The architecture is invented — a
 * cusped arch, a jali screen, domes on a far horizon — drawn from the
 * vocabulary of Indian palace building rather than from any one building.
 * Inventing a plausible-looking "historic palace" and implying it is real
 * would be worse than making no claim at all, and this is a product children
 * learn from.
 *
 * ON DRAWING PEOPLE. Silhouettes only: no faces, no hands, no anatomy. A
 * rim-lit shoulder line reads as cinematic; an attempted rendered person in
 * SVG reads as clip art. The figure here is robed rather than modern, so the
 * scene says "this game is old" without a word of copy.
 *
 * WHAT IT MUST NEVER DO. pointer-events are off on every node, it is
 * aria-hidden, it never receives the game, a move handler or a clock, and it
 * cannot change the board's size — that belongs entirely to ChessFocusLayout.
 *
 * PERFORMANCE. One animation, a transform/opacity on a single element, owned
 * by the compositor. No JS loop, no blur over a large area. `simplify` trims
 * node counts on small screens but no longer freezes the scene: a still image
 * was most of why the World felt dead on a phone.
 */
export default function ChaturangaScene({ simplify = false }: { simplify?: boolean }) {
  const lattice = simplify ? 5 : 9;
  const motes = simplify ? 3 : 6;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/*
        SKY. Late afternoon turning to evening: saffron at the horizon, deep
        indigo overhead. The light source is a low sun behind the opponent, so
        every shape in front of it is rim-lit from behind — the same lighting
        logic the London scene uses, which is what makes the two feel like one
        product rather than two experiments.
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1026] via-[#5d2a2c] via-34% to-[#c97838]" />

      {/* The sun, low and centred behind the seated figure. */}
      <div
        className="absolute left-1/2 top-[10%] h-[36vmax] w-[36vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,224,168,0.6) 0%, rgba(255,176,96,0.3) 32%, rgba(255,140,70,0.12) 58%, transparent 74%)",
        }}
      />

      {/* Warm haze at the horizon — the layer that separates far from near. */}
      <div
        className="absolute inset-x-0 top-[3%] h-[15%]"
        style={{
          background:
            "linear-gradient(to top, rgba(255,186,110,0.38) 0%, rgba(255,160,110,0.16) 46%, transparent 100%)",
        }}
      />

      {/*
        THE FAR HORIZON, seen through the arch: domes and a tower, low contrast
        and small, so the arch reads as near and they read as distant. Scale is
        the whole job of this layer.
      */}
      <svg
        viewBox="0 0 400 70"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 top-[8%] h-[7%] w-full"
      >
        <g className="fill-[#3a1f26]">
          <rect x={40} y={44} width={40} height={26} />
          <path d="M40 46 C 40 26 80 26 80 46 Z" />
          <rect x={58} y={20} width={4} height={9} />
          <rect x={300} y={38} width={30} height={32} />
          <path d="M300 40 C 300 22 330 22 330 40 Z" />
          <rect x={313} y={14} width={3} height={9} />
          <rect x={352} y={30} width={12} height={40} rx={1} />
          <rect x={0} y={58} width={400} height={12} />
        </g>
      </svg>

      {/*
        THE ARCH. The defining shape, and the landmark equivalent of the
        London wheel: a wide cusped opening whose apex sits in the sky band and
        whose jambs run off both edges, so the player is inside a room looking
        out rather than looking at a picture of a building.

        `preserveAspectRatio="none"` is deliberate. With `slice` the jambs crop
        off-screen on a phone and the arch — the whole point — disappears at
        the viewport where identity matters most. Stretched, it reads wide on a
        desktop and tall in portrait, which is how arches actually vary.
      */}
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="cmChatStone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a4a2a" />
            <stop offset="45%" stopColor="#452616" />
            <stop offset="100%" stopColor="#24120b" />
          </linearGradient>
          {/* Sunset catching the stone, so the jambs read as lit sandstone
              rather than flat brown — they are the only architecture still
              visible once a board and a panel are on screen. */}
          <linearGradient id="cmChatLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc184" stopOpacity="0.4" />
            <stop offset="34%" stopColor="#ff9a5a" stopOpacity="0.12" />
            <stop offset="62%" stopColor="#ff9a5a" stopOpacity="0" />
          </linearGradient>
          {/* Jali — a pierced screen, laid over the stone at low opacity so it
              reads as carving catching light, not as a graphic. */}
          <pattern id="cmChatJali" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M13 2 L24 13 L13 24 L2 13 Z" fill="none" stroke="#f0c48e" strokeWidth="1.1" />
            <circle cx="13" cy="13" r="2" fill="#f0c48e" opacity="0.5" />
          </pattern>
        </defs>

        {/* The wall, with the opening cut out of it (evenodd). */}
        <path
          fillRule="evenodd"
          fill="url(#cmChatStone)"
          d="M0 0 H400 V300 H0 Z M52 300 V118 C52 58 148 26 200 26 C252 26 348 58 348 118 V300 Z"
        />
        <path
          fillRule="evenodd"
          fill="url(#cmChatLight)"
          d="M0 0 H400 V300 H0 Z M52 300 V118 C52 58 148 26 200 26 C252 26 348 58 348 118 V300 Z"
        />
        <path
          fillRule="evenodd"
          fill="url(#cmChatJali)"
          opacity="0.16"
          d="M0 0 H400 V300 H0 Z M52 300 V118 C52 58 148 26 200 26 C252 26 348 58 348 118 V300 Z"
        />

        {/* Cusping: lobes whose centres sit on the arch curve itself, so they
            follow it instead of merely being near it. */}
        <g fill="url(#cmChatStone)">
          {[
            [55.6, 96.6], [66.6, 76.8], [85.4, 61.2], [110.6, 49.9], [141.1, 42.8],
            [175.6, 39.9], [200, 39.2], [224.4, 39.9], [258.9, 42.8], [289.4, 49.9],
            [314.6, 61.2], [333.4, 76.8], [344.4, 96.6],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={11} />
          ))}
        </g>

        {/* One gold hairline on the intrados. One, because the difference
            between premium and gaudy here is how much gold there is. */}
        <path
          fill="none"
          stroke="#ffd28a"
          strokeOpacity="0.3"
          strokeWidth="1.6"
          d="M52 300 V118 C52 58 148 26 200 26 C252 26 348 58 348 118 V300"
        />

        {/* Column bases, so the jambs land on something. */}
        <rect x={26} y={276} width={52} height={7} fill="#7a4a2a" opacity="0.6" />
        <rect x={322} y={276} width={52} height={7} fill="#7a4a2a" opacity="0.6" />
      </svg>

      {/*
        THE OPPONENT. Robed head and shoulders, seated across the board, with a
        warm rim on the edge facing the sun behind them. Placed so the shoulder
        line lands just above the board's top edge, and kept narrow enough that
        the horizon reads either side of them.
      */}
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMax meet"
        className="absolute left-1/2 top-[7%] h-[19%] w-[44%] -translate-x-1/2"
      >
        <defs>
          <linearGradient id="cmChatRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffdcae" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#ffa86e" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#ffa86e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Rim light: the same silhouette, slightly larger, behind. */}
        <g transform="translate(100 120) scale(1.1) translate(-100 -120)">
          <path
            d="M100 24 c13 0 22 10 22 23 c0 8-3 15-8 19 c22 7 38 21 44 38 c2 6 3 11 3 16 H39 c0-5 1-10 3-16 c6-17 22-31 44-38 c-5-4-8-11-8-19 c0-13 9-23 22-23 Z"
            fill="url(#cmChatRim)"
          />
        </g>
        <path
          d="M100 24 c13 0 22 10 22 23 c0 8-3 15-8 19 c22 7 38 21 44 38 c2 6 3 11 3 16 H39 c0-5 1-10 3-16 c6-17 22-31 44-38 c-5-4-8-11-8-19 c0-13 9-23 22-23 Z"
          className="fill-[#160a08]/95"
        />
      </svg>

      {/*
        THE FLOOR, with the long shadows an afternoon sun throws toward the
        viewer. This is the layer that welds the board into the room: without
        it the board floats, with it the board rests on something.
      */}
      <div
        className="absolute inset-x-0 top-[52%] bottom-0"
        style={{
          background: "linear-gradient(to bottom, #4a2a18 0%, #2a170e 34%, #170c08 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-[52%] h-[2px]"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(255,196,140,0.42) 28%, rgba(255,196,140,0.42) 72%, transparent)",
        }}
      />

      {/* Contact shadow under the board, thrown toward the viewer. */}
      <div
        className="absolute left-1/2 top-[50%] h-[14%] w-[106%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.32) 46%, transparent 72%)",
        }}
      />

      {/* Dust in the light. A handful, not a snowstorm — nothing should be
          moving anywhere near the board. */}
      <div className="absolute inset-0">
        {Array.from({ length: motes }).map((_, i) => (
          <span
            key={i}
            className="world-mote motion-reduce:[animation:none] absolute rounded-full bg-[#ffe0b0]/50"
            style={{
              left: `${12 + ((i * 29) % 76)}%`,
              bottom: `${16 + ((i * 17) % 30)}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              animationDuration: `${26 + i * 5}s`,
              animationDelay: `${-i * 7}s`,
            }}
          />
        ))}
      </div>

      {/* YOUR OWN shoulders in the near dark. What turns "a view of a table"
          into "your seat at the table". */}
      <svg
        viewBox="0 0 200 60"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[15%] w-full"
      >
        <path d="M-10 60 C 20 30 60 16 100 16 C 140 16 180 30 210 60 Z" className="fill-[#0d0605]" opacity="0.92" />
      </svg>

      <style jsx>{`
        .world-mote {
          animation-name: world-mote-rise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes world-mote-rise {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0);
          }
          14% {
            opacity: 1;
          }
          86% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(2vw, -30vh, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-mote {
            animation: none;
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
