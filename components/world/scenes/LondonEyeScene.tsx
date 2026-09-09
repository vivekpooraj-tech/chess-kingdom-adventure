"use client";

/**
 * London Eye — a cinematic chess scene, not a backdrop.
 *
 * WHAT CHANGED AND WHY. The first version of this scene was a picture of a
 * place. Rendered behind a real game it read as "a chess board with a London
 * gradient", because a location with nobody in it is scenery, not a scene.
 * This version stages a MATCH: an opponent seated across a table from you,
 * the wheel rising behind them, the city below, and your own shoulders in the
 * near dark. The interactive board sits exactly where the table's playing
 * surface would be, so the board stops being an object on top of a picture
 * and becomes the thing the two of you are leaning over.
 *
 * COMPOSED FOR A PORTRAIT PHONE, because that is where it is played and
 * where the space is tightest. Measured on a 411x914 device, the board
 * occupies 13%-56% of the screen height and 96% of its width — so there is no
 * usable margin at the sides at all, ~120px of sky above, and the rest below.
 * Every band below is expressed as a percentage against that reality:
 *
 *    0-13%   the view: sky, the wheel's upper arc, the opponent
 *   13-56%   THE BOARD (this scene draws nothing that competes with it)
 *   56-100%  the table receding toward you, and your own shoulders
 *
 * WHAT IT MUST NEVER DO. It is still a backdrop in the only sense that
 * matters: pointer-events are off on every node, it is aria-hidden, it never
 * receives the game, a move handler or a clock, and it cannot change the
 * board's size — the board's geometry is owned entirely by ChessFocusLayout
 * and nothing here participates in it.
 *
 * ON DRAWING PEOPLE. Silhouettes only — no faces, no hands, no anatomy. A
 * rim-lit shoulder line reads as cinematic; an attempted rendered person in
 * SVG reads as a clip-art sticker, and this is a children's product where
 * that difference matters.
 *
 * PERFORMANCE. Every animation is a transform or an opacity on a single
 * element, so the compositor owns them and React never re-renders during a
 * game. There is no blur over a large area (expensive on mid-range Android)
 * and no JS animation loop. `simplify` reduces node counts on small screens
 * but no longer freezes the scene: a still image was the single biggest
 * reason the World felt dead on a phone.
 */
export default function LondonEyeScene({ simplify = false }: { simplify?: boolean }) {
  const spokes = simplify ? 16 : 28;
  const stars = simplify ? 18 : 34;
  const windows = simplify ? 40 : 90;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/*
        SKY. The light source for the whole scene: a low sun behind the
        opponent, so everything in front of them is rim-lit from behind. Deep
        indigo overhead falling to amber at the horizon, with the horizon set
        at 56% — the board's bottom edge — so the board reads as sitting on
        the table against the view rather than floating in the sky.
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d0a1c] via-[#2c1a3f] via-30% to-[#7b3f52]" />

      {/* Stars, from a fixed formula so the sky is identical every render. */}
      <div className="absolute inset-x-0 top-0 h-[30%]">
        {Array.from({ length: stars }).map((_, i) => {
          const x = (i * 37) % 100;
          const y = (i * 23) % 92;
          const size = i % 4 === 0 ? 2 : 1;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-white/70"
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
            />
          );
        })}
      </div>

      {/* The sun, low and centred behind the opponent. This is the single
          light source every other layer is lit by. */}
      <div
        className="absolute left-1/2 top-[11%] h-[34vmax] w-[34vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,214,160,0.55) 0%, rgba(255,150,110,0.28) 34%, rgba(255,120,90,0.10) 58%, transparent 74%)",
        }}
      />

      {/*
        THE WHEEL. Large enough to be a landmark rather than a motif: the hub
        sits behind the opponent's head and the rim runs off both edges of the
        screen, so the player is inside the structure instead of looking at a
        picture of it. Drawn in its own square viewBox and sized in vw, so it
        keeps its circle at every aspect ratio instead of being squashed.
      */}
      <div className="absolute left-1/2 top-[26%] h-[210vw] w-[210vw] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="-100 -100 200 200" className="h-full w-full">
          <circle r={86} className="fill-none stroke-[#dce3f2]/60" strokeWidth={1.1} />
          <circle r={80} className="fill-none stroke-[#dce3f2]/28" strokeWidth={0.5} />
          <g className="world-wheel motion-reduce:[animation:none]">
            {Array.from({ length: spokes }).map((_, i) => {
              const a = (i / spokes) * Math.PI * 2;
              const x = Math.cos(a) * 86;
              const y = Math.sin(a) * 86;
              return (
                <g key={i}>
                  <line x1={0} y1={0} x2={x} y2={y} className="stroke-[#dce3f2]/22" strokeWidth={0.3} />
                  <circle cx={x} cy={y} r={1.7} className="fill-[#fff0d2]/90" />
                </g>
              );
            })}
          </g>
          <circle r={4} className="fill-[#cfd6e6]/45" />
        </svg>
      </div>

      {/*
        THE CITY, along the horizon at 56%. Deliberately low contrast: it is
        the furthest plane and must never pull the eye off the board.
      */}
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-[41%] h-[15%] w-full"
      >
        <g className="fill-[#150f28]">
          {Array.from({ length: 26 }).map((_, i) => {
            const w = 8 + ((i * 7) % 13);
            const h = 26 + ((i * 31) % 54);
            return <rect key={i} x={i * 16 - 6} y={120 - h} width={w} height={h} rx={1} />;
          })}
          <rect x={54} y={28} width={11} height={92} rx={2} />
          <polygon points="300,120 310,44 320,120" />
        </g>
        <g className="fill-[#ffca7a]/55">
          {Array.from({ length: windows }).map((_, i) => {
            if (i % 4 !== 0) return null;
            const x = ((i * 29) % 384) + 6;
            const y = 74 + ((i * 13) % 40);
            return <rect key={i} x={x} y={y} width={1.6} height={2.4} />;
          })}
        </g>
      </svg>

      {/*
        The river. This band, and everything under it, is the largest piece of
        canvas a portrait phone actually has: the board takes the middle, the
        header takes the top, and the panel below is transparent, so the scene
        reads through it. The detail budget goes here rather than into the
        76px strip above the board.
      */}
      <div className="absolute inset-x-0 top-[54%] bottom-0 bg-gradient-to-b from-[#2f1d42] via-[#1d1230] to-[#100a1c]" />
      {/* Reflected window light, smeared vertically the way water does it. */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-x-0 top-[56%] h-[26%] w-full">
        {Array.from({ length: simplify ? 16 : 30 }).map((_, i) => {
          const x = ((i * 53) % 392) + 4;
          const h = 24 + ((i * 37) % 90);
          const w = i % 3 === 0 ? 2.4 : 1.4;
          return (
            <rect key={i} x={x} y={0} width={w} height={h} className="fill-[#ffbe86]" opacity={0.10 + (i % 5) * 0.035} />
          );
        })}
      </svg>
      <div
        className="world-river motion-reduce:[animation:none] absolute inset-x-0 top-[54%] h-[8%]"
        style={{
          background:
            "linear-gradient(100deg, transparent 20%, rgba(255,190,140,0.22) 45%, transparent 70%)",
        }}
      />

      {/*
        THE OPPONENT. Head and shoulders, centred, seated across the table.
        Nearly black, with a warm rim on the edge facing the sun behind them —
        that rim is what makes a flat shape read as a lit person. Sized and
        placed so the shoulder line lands just above the board's top edge.
      */}
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMax meet"
        className="world-opponent absolute left-1/2 top-0 h-[15%] w-[62%] -translate-x-1/2"
      >
        <defs>
          <linearGradient id="cmLeRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffcf9a" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#ff9d6e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ff9d6e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Rim light: the same silhouette, slightly larger, behind. */}
        <g transform="translate(100 120) scale(1.06) translate(-100 -120)">
          <path
            d="M100 26 c14 0 24 11 24 25 c0 9-4 16-9 20 c19 6 33 18 39 33 c3 7 5 11 5 16 H41 c0-5 2-9 5-16 c6-15 20-27 39-33 c-5-4-9-11-9-20 c0-14 10-25 24-25 Z"
            fill="url(#cmLeRim)"
          />
        </g>
        {/* The figure itself. */}
        <path
          d="M100 26 c14 0 24 11 24 25 c0 9-4 16-9 20 c19 6 33 18 39 33 c3 7 5 11 5 16 H41 c0-5 2-9 5-16 c6-15 20-27 39-33 c-5-4-9-11-9-20 c0-14 10-25 24-25 Z"
          className="fill-[#0a0714]/95"
        />
      </svg>

      {/*
        THE TABLE. A surface running the full width at the board's bottom
        edge, catching a little of the sunset. This is the layer that welds
        the board into the room: without it the board floats, with it the
        board is an object resting on something.
      */}
      <div
        className="absolute inset-x-0 top-[56%] bottom-0"
        style={{
          background:
            "linear-gradient(to bottom, #241a2c 0%, #1a1220 28%, #120c17 100%)",
        }}
      />
      {/* The table's lit front edge, a single warm line where it meets the view. */}
      <div
        className="absolute inset-x-0 top-[56%] h-[2px]"
        style={{ background: "linear-gradient(to right, transparent, rgba(255,190,140,0.40) 30%, rgba(255,190,140,0.40) 70%, transparent)" }}
      />

      {/*
        CONTACT SHADOW. Directly under where the board sits, so the board has
        weight. Soft, wide and offset downward — the sun is behind the
        opponent, so the shadow falls toward the viewer.
      */}
      <div
        className="absolute left-1/2 top-[54%] h-[14%] w-[104%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.34) 46%, transparent 72%)",
        }}
      />

      {/*
        THE NEAR PLAYER — you. Your own shoulders in the near dark at the very
        bottom, out of focus by being pure shape. This is what turns the frame
        from "a view of a table" into "your seat at the table".
      */}
      <svg
        viewBox="0 0 200 60"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[16%] w-full"
      >
        <path
          d="M-10 60 C 20 30 60 16 100 16 C 140 16 180 30 210 60 Z"
          className="fill-[#07050e]"
          opacity="0.92"
        />
      </svg>

      {/*
        THE CAPSULE. Two struts down the sides and a curved header — the frame
        that says you are inside something, looking out. Kept to the extreme
        edges because on a phone the board leaves only ~8px of margin.
      */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 left-0 w-[3%] bg-gradient-to-r from-[#0a0714]/90 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[3%] bg-gradient-to-l from-[#0a0714]/90 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-[4%] bg-gradient-to-b from-[#0a0714]/80 to-transparent" />
      </div>

      <style jsx>{`
        .world-wheel {
          animation: world-wheel-spin 240s linear infinite;
          transform-origin: 0 0;
        }
        @keyframes world-wheel-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .world-river {
          animation: world-river-shimmer 26s ease-in-out infinite alternate;
        }
        @keyframes world-river-shimmer {
          from {
            transform: translateX(-6%);
            opacity: 0.55;
          }
          to {
            transform: translateX(6%);
            opacity: 0.9;
          }
        }
        /*
         * The opponent is only drawn where there is room for them.
         *
         * Measured on a 411x914 phone: the board runs 8%-52% of the screen and
         * the 76px above it is already the arena header and the opponent row.
         * A head-and-shoulders silhouette in that strip does not read as a
         * person seated across a table — it reads as a smudge behind the
         * title, which is worse than no figure at all. Landscape and tablet
         * layouts put the board in a column and leave real space, so the
         * figure appears there.
         */
        .world-opponent {
          display: none;
        }
        @media (min-width: 700px), (orientation: landscape) {
          .world-opponent {
            display: block;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-wheel,
          .world-river {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
