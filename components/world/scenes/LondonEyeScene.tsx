"use client";

/**
 * London Eye — original artwork, no photography, no copyrighted imagery.
 *
 * Everything here is drawn: a gradient sky, a procedural skyline built from
 * rectangles, a river with a reflection, and a wheel generated from a spoke
 * count. Nothing is traced from a real photograph or a real logo, and the
 * silhouette is a generic observation wheel rather than a depiction of a
 * specific branded structure.
 *
 * PERFORMANCE AND SAFETY RULES THIS SCENE OBEYS:
 *
 *   - It is a BACKDROP. pointer-events are off on every node, so it can
 *     never intercept a tap meant for the board, and it never receives the
 *     game, a move handler or a clock.
 *   - `simplify` (set on small screens by the backdrop) drops the reflection,
 *     halves the star count and stops the wheel entirely.
 *   - The one animation is the wheel, and it is a CSS transform on a single
 *     element — no JS loop, no requestAnimationFrame, nothing that re-renders
 *     React while a game is being played. Under prefers-reduced-motion the
 *     rotation is switched off and the scene is a still image.
 *   - Contrast: the board sits over the darkest band of the gradient, and
 *     the whole scene is dimmed by the backdrop's own scrim, so pieces stay
 *     legible against it.
 */
export default function LondonEyeScene({ simplify = false }: { simplify?: boolean }) {
  const spokes = simplify ? 12 : 24;
  const stars = simplify ? 14 : 30;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Sky: night at the top, sunset at the horizon. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#140d24] via-[#4a2a52] via-60% to-[#c96a3f]" />

      {/* Stars, placed from a fixed formula rather than Math.random so the
          sky is identical on every render and on the server. */}
      <div className="absolute inset-0">
        {Array.from({ length: stars }).map((_, i) => {
          const x = (i * 37) % 100;
          const y = (i * 23) % 45;
          const size = i % 3 === 0 ? 2 : 1;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-white/70"
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
            />
          );
        })}
      </div>

      {/* Sun low over the river. */}
      <div
        className="absolute rounded-full bg-[#ffcf8a]/80 blur-[2px]"
        style={{ left: "68%", top: "58%", width: "9%", paddingBottom: "9%", height: 0 }}
      />

      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 w-full h-full"
      >
        {/* Skyline, generated from a repeating but non-uniform pattern so it
            reads as a city rather than a bar chart. */}
        <g className="fill-[#1b1430]">
          {Array.from({ length: 26 }).map((_, i) => {
            const w = 8 + ((i * 7) % 13);
            const h = 22 + ((i * 31) % 58);
            const x = i * 16 - 6;
            return <rect key={i} x={x} y={196 - h} width={w} height={h + 20} rx={1} />;
          })}
          {/* A tall tower and a spire, for a recognisable but original city. */}
          <rect x={54} y={104} width={12} height={112} rx={2} />
          <polygon points="300,196 310,120 320,196" />
          <rect x={306} y={92} width={2} height={30} />
        </g>

        {/* Lit windows — one in five, deterministic. */}
        <g className="fill-[#ffca7a]/60">
          {Array.from({ length: 90 }).map((_, i) => {
            if (i % 5 !== 0) return null;
            const x = ((i * 29) % 380) + 6;
            const y = 150 + ((i * 13) % 44);
            return <rect key={i} x={x} y={y} width={2} height={3} />;
          })}
        </g>

        {/* The river. */}
        <rect x={0} y={214} width={400} height={86} className="fill-[#2b1c3d]" />
        <g className="stroke-[#e8a56b]/40" strokeWidth={1}>
          {Array.from({ length: simplify ? 5 : 11 }).map((_, i) => (
            <line key={i} x1={250 + (i % 3) * 6} y1={220 + i * 7} x2={302 - (i % 4) * 8} y2={220 + i * 7} />
          ))}
        </g>

        {/* The wheel: a hub, a rim, generated spokes and capsules. Rotates as
            one group, so the browser animates a single transform. */}
        <g transform="translate(196 150)">
          <circle r={78} className="fill-none stroke-[#cfd6e6]/45" strokeWidth={2.5} />
          <circle r={72} className="fill-none stroke-[#cfd6e6]/20" strokeWidth={1} />
          <g className={simplify ? "" : "world-wheel motion-reduce:[animation:none]"}>
            {Array.from({ length: spokes }).map((_, i) => {
              const angle = (i / spokes) * Math.PI * 2;
              const x = Math.cos(angle) * 78;
              const y = Math.sin(angle) * 78;
              return (
                <g key={i}>
                  <line x1={0} y1={0} x2={x} y2={y} className="stroke-[#cfd6e6]/25" strokeWidth={0.6} />
                  <circle cx={x} cy={y} r={3.4} className="fill-[#ffe6bf]/85" />
                </g>
              );
            })}
          </g>
          <circle r={6} className="fill-[#cfd6e6]/70" />
          {/* Support legs down to the bank. */}
          <line x1={-6} y1={4} x2={-34} y2={70} className="stroke-[#cfd6e6]/40" strokeWidth={3} />
          <line x1={6} y1={4} x2={34} y2={70} className="stroke-[#cfd6e6]/40" strokeWidth={3} />
        </g>
      </svg>

      {/* Capsule glass: a soft vignette that frames the board without
          covering it. Never darkens the centre, where the pieces are. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(8,6,18,0.55)_100%)]" />

      <style jsx>{`
        .world-wheel {
          animation: world-wheel-spin 180s linear infinite;
          transform-origin: 0 0;
        }
        @keyframes world-wheel-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-wheel {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
