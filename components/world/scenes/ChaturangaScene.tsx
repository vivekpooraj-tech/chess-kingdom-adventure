"use client";

/**
 * Chaturanga — original artwork inspired by Indian courtyard architecture.
 *
 * Drawn, not photographed: a sandstone gradient, generated scalloped arches,
 * carved jali screens built from a repeating lattice, and long afternoon
 * shadows. No traced monument, no copyrighted image, no depiction of a
 * specific building.
 *
 * ON THE HISTORY. The location's copy says chess "grew out of chaturanga, an
 * Indian game of the sixth century, and it has been travelling ever since".
 * That is the mainstream account and it is stated at that level of
 * confidence. The scene makes no further claim — no date on a wall, no
 * "the first chessboard", nothing a child could repeat in a classroom and
 * be wrong about.
 *
 * Same rules as every scene: pointer-events off, no game access, `simplify`
 * on small screens, and the single ambient animation stops under
 * prefers-reduced-motion.
 */
export default function ChaturangaScene({ simplify = false }: { simplify?: boolean }) {
  const arches = simplify ? 3 : 5;
  const latticeRows = simplify ? 4 : 7;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Warm afternoon light falling through a courtyard. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f0c675] via-[#b9773a] to-[#3a2313]" />

      {/* Dust in the light — a single slow drift, one element, no JS. */}
      {!simplify && (
        <div className="world-haze absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,235,190,0.35),transparent_55%)] motion-reduce:[animation:none]" />
      )}

      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 w-full h-full"
      >
        {/* Back wall. */}
        <rect x={0} y={40} width={400} height={260} className="fill-[#8a5a2b]/70" />

        {/* A colonnade of scalloped arches, generated rather than drawn one
            by one, so the count adapts on small screens. */}
        <g className="fill-[#c9954f]/80">
          {Array.from({ length: arches }).map((_, i) => {
            const width = 400 / arches;
            const x = i * width;
            const cx = x + width / 2;
            const top = 96;
            const bottom = 250;
            // A pointed arch: two curves meeting at an apex.
            const d = `M ${x + 8} ${bottom}
                       L ${x + 8} ${top + 26}
                       Q ${cx} ${top - 24} ${x + width - 8} ${top + 26}
                       L ${x + width - 8} ${bottom} Z`;
            return <path key={i} d={d} className="fill-[#2e1c0f]/55" />;
          })}
        </g>

        {/* Columns between the arches. */}
        <g className="fill-[#e0b877]/85">
          {Array.from({ length: arches + 1 }).map((_, i) => {
            const x = (400 / arches) * i - 5;
            return (
              <g key={i}>
                <rect x={x} y={104} width={10} height={148} rx={2} />
                <rect x={x - 3} y={98} width={16} height={8} rx={2} />
                <rect x={x - 4} y={248} width={18} height={8} rx={2} />
              </g>
            );
          })}
        </g>

        {/* A jali screen: a carved lattice, built from one repeated diamond. */}
        <g className="stroke-[#f3d9a6]/45" strokeWidth={0.9} fill="none">
          {Array.from({ length: latticeRows }).map((_, r) =>
            Array.from({ length: simplify ? 8 : 14 }).map((_, c) => {
              const size = 14;
              const x = 24 + c * (size * 2);
              const y = 116 + r * size;
              if (x > 380) return null;
              return (
                <path
                  key={`${r}-${c}`}
                  d={`M ${x} ${y} l ${size} ${size / 2} l ${-size} ${size / 2} l ${-size} ${-size / 2} Z`}
                />
              );
            })
          )}
        </g>

        {/* Courtyard floor with long shadows from the columns. */}
        <rect x={0} y={252} width={400} height={48} className="fill-[#a9702f]" />
        <g className="fill-[#4a2c12]/45">
          {Array.from({ length: arches + 1 }).map((_, i) => {
            const x = (400 / arches) * i - 5;
            return <polygon key={i} points={`${x},252 ${x + 10},252 ${x + 46},300 ${x + 30},300`} />;
          })}
        </g>
      </svg>

      {/* Same framing vignette as every scene: darkens the edges, never the
          centre where the pieces are. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(24,13,4,0.6)_100%)]" />

      <style jsx>{`
        .world-haze {
          animation: world-haze-drift 40s ease-in-out infinite alternate;
        }
        @keyframes world-haze-drift {
          from {
            opacity: 0.55;
            transform: translateX(-2%);
          }
          to {
            opacity: 0.85;
            transform: translateX(2%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-haze {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
