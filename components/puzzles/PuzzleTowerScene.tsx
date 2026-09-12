"use client";

/**
 * Illustrated kingdom backdrop for the Puzzle Tower hero — pure inline SVG +
 * CSS gradients (no image assets). Scoped to this screen only.
 */
export function PuzzleTowerScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      {/* Sunset sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a1848] via-[#4a2c62] to-[#0f1629]" />
      <div className="absolute inset-x-0 top-0 h-[45%] bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(255,160,90,0.35),transparent_65%)]" />
      <div className="absolute inset-x-0 top-[8%] h-[30%] bg-[radial-gradient(ellipse_60%_50%_at_70%_20%,rgba(255,197,61,0.2),transparent_60%)]" />

      <svg
        className="absolute inset-x-0 bottom-0 h-[72%] w-full"
        viewBox="0 0 400 280"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="puzzleHillFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0f1629" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="puzzleHillNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16352e" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0a1218" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Stars */}
        {[
          [42, 28],
          [120, 18],
          [280, 24],
          [340, 40],
          [200, 12],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.2" fill="rgba(255,255,255,0.55)" />
        ))}

        {/* Distant mountains */}
        <path
          d="M0 170 L60 120 L110 155 L170 95 L240 140 L300 88 L360 130 L400 105 L400 280 L0 280 Z"
          fill="url(#puzzleHillFar)"
        />

        {/* Left castle silhouette */}
        <g opacity="0.55" transform="translate(8, 118)">
          <rect x="0" y="40" width="52" height="58" fill="#1a2548" rx="2" />
          <rect x="8" y="24" width="14" height="22" fill="#243058" />
          <rect x="30" y="18" width="18" height="28" fill="#243058" />
          <rect x="12" y="52" width="8" height="10" fill="#FFC53D" opacity="0.45" />
          <rect x="32" y="52" width="8" height="10" fill="#FFC53D" opacity="0.35" />
          <path d="M0 40 L6 32 L12 36 L18 28 L26 34 L32 26 L40 32 L46 28 L52 34 L52 40 Z" fill="#2a3560" />
        </g>

        {/* Right castle / tower silhouette */}
        <g opacity="0.5" transform="translate(318, 108)">
          <rect x="0" y="50" width="64" height="70" fill="#1a2548" rx="2" />
          <rect x="20" y="20" width="24" height="38" fill="#243058" />
          <path d="M18 20 L32 6 L46 20 Z" fill="#3d4a78" />
          <rect x="26" y="62" width="10" height="12" fill="#FFC53D" opacity="0.4" />
          <path d="M0 50 L8 42 L16 46 L24 38 L32 44 L40 36 L48 42 L56 38 L64 44 L64 50 Z" fill="#2a3560" />
        </g>

        {/* Foreground hills + path meadow */}
        <path
          d="M0 210 Q100 185 200 198 T400 205 L400 280 L0 280 Z"
          fill="url(#puzzleHillNear)"
        />

        {/* Soft ground glow under tower */}
        <ellipse cx="200" cy="218" rx="95" ry="22" fill="rgba(255,197,61,0.08)" />

        {/* Chess-board meadow strip */}
        <g transform="translate(72, 228)">
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 14 }).map((__, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 18}
                y={row * 10}
                width="18"
                height="10"
                fill={(row + col) % 2 === 0 ? "rgba(34,197,94,0.12)" : "rgba(21,128,61,0.08)"}
                rx="1"
              />
            ))
          )}
        </g>
      </svg>

      {/* Vignette + bottom fade into cards */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,transparent_30%,rgba(8,12,24,0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-premium-midnight/90 to-transparent" />
    </div>
  );
}
