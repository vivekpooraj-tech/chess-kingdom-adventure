import styles from "./chaturanga.module.css";
import "./worldOverlay.css";

/**
 * The Chaturanga scene.
 *
 * Purely decorative and completely inert: `aria-hidden` so a screen reader
 * never walks a sunset, `pointer-events: none` (in the stylesheet) so it can
 * never swallow a click meant for a piece, and no props, state or effects — it
 * renders once and the browser owns every animation from there.
 *
 * It knows nothing about chess. That is the boundary the whole feature rests
 * on: this file could be deleted and the game would still play.
 *
 * On the name: chess grew out of chaturanga, played in India well over a
 * thousand years ago. That lineage is the reason this location exists, and it
 * is as far as any claim here goes — the architecture below is invented, drawn
 * from the shapes of Indian palace building rather than from any one palace.
 */
export function ChaturangaScene() {
  return (
    <div className={`${styles.scene} ${styles.enter}`} aria-hidden="true" role="presentation">
      <div className={styles.sky} />
      <div className={styles.sun} />
      <div className={styles.haze} />

      {/* Far roofline — domes, chhatri-style pavilions and a tower. Seen only
          through the arch, so it is drawn before the wall. */}
      <svg
        className={styles.domes}
        viewBox="0 0 1200 220"
        preserveAspectRatio="xMidYMax slice"
        focusable="false"
      >
        <g fill="#2b1410">
          {/* left pavilion */}
          <path d="M120 220 V150 h96 v70 Z" />
          <path d="M168 96 c30 0 52 24 52 54 h-104 c0-30 22-54 52-54 Z" />
          <path d="M166 78 h4 v20 h-4 Z" />
          {/* central dome, the tallest thing on the horizon */}
          <path d="M486 220 V132 h228 v88 Z" />
          <path d="M600 36 c62 0 108 50 108 100 H492 c0-50 46-100 108-100 Z" />
          <path d="M597 10 h6 v30 h-6 Z" />
          <circle cx="600" cy="8" r="7" />
          {/* right pavilion */}
          <path d="M900 220 V158 h84 v62 Z" />
          <path d="M942 110 c26 0 46 22 46 50 h-92 c0-28 20-50 46-50 Z" />
          <path d="M940 94 h4 v18 h-4 Z" />
          {/* far tower */}
          <path d="M1064 220 V120 h44 v100 Z" />
          <path d="M1086 82 c16 0 28 16 28 38 h-56 c0-22 12-38 28-38 Z" />
        </g>
      </svg>

      <div className={styles.garden} />

      {/*
        The wall. One shape with a cusped opening cut out of it (`evenodd`),
        plus the lobes of the cusping laid on top as circles whose centres sit
        exactly on the arch curve — half of each circle protrudes into the
        opening, half is invisible inside the stone. Computing the lobe
        positions from the same bezier the opening uses is what keeps them on
        the curve instead of near it.
      */}
      <svg
        className={styles.archFrame}
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="cmChatStone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b4026" />
            <stop offset="42%" stopColor="#3a2016" />
            <stop offset="100%" stopColor="#20100b" />
          </linearGradient>
          {/* Jali — a pierced screen. Laid over the stone at low opacity so it
              reads as carving catching the light, not as a graphic. */}
          {/* Sunset falling on the stone. Without it the jambs — the only
              architecture visible once a board and a panel are on screen —
              read as flat brown rather than as lit sandstone. */}
          <linearGradient id="cmChatLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb46e" stopOpacity="0.34" />
            <stop offset="38%" stopColor="#ff9a5a" stopOpacity="0.09" />
            <stop offset="70%" stopColor="#ff9a5a" stopOpacity="0" />
          </linearGradient>
          <pattern id="cmChatJali" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M17 3 L31 17 L17 31 L3 17 Z" fill="none" stroke="#e9b98a" strokeWidth="1.3" />
            <circle cx="17" cy="17" r="2.6" fill="#e9b98a" opacity="0.55" />
          </pattern>
        </defs>

        <g>
          <path
            fillRule="evenodd"
            fill="url(#cmChatStone)"
            d="M0 0 H1200 V800 H0 Z M90 800 V330 C90 170 330 70 600 70 C870 70 1110 170 1110 330 V800 Z"
          />
          <path
            fillRule="evenodd"
            fill="url(#cmChatLight)"
            d="M0 0 H1200 V800 H0 Z M90 800 V330 C90 170 330 70 600 70 C870 70 1110 170 1110 330 V800 Z"
          />
          <path
            fillRule="evenodd"
            fill="url(#cmChatJali)"
            opacity="0.16"
            d="M0 0 H1200 V800 H0 Z M90 800 V330 C90 170 330 70 600 70 C870 70 1110 170 1110 330 V800 Z"
          />

          {/* Cusping. Centres computed along the two arch beziers. */}
          <g fill="url(#cmChatStone)">
            <circle cx="100.8" cy="272.9" r="27" />
            <circle cx="131.7" cy="221.9" r="27" />
            <circle cx="180.2" cy="177.4" r="27" />
            <circle cx="243.8" cy="140.0" r="27" />
            <circle cx="320.0" cy="110.1" r="27" />
            <circle cx="406.4" cy="88.1" r="27" />
            <circle cx="500.6" cy="74.6" r="27" />
            <circle cx="600.0" cy="70.0" r="27" />
            <circle cx="699.4" cy="74.6" r="27" />
            <circle cx="793.6" cy="88.1" r="27" />
            <circle cx="880.0" cy="110.1" r="27" />
            <circle cx="956.2" cy="140.0" r="27" />
            <circle cx="1019.8" cy="177.4" r="27" />
            <circle cx="1068.3" cy="221.9" r="27" />
            <circle cx="1099.2" cy="272.9" r="27" />
          </g>

          {/* A single gold hairline on the intrados. One line, because the
              difference between "premium" and "gaudy" here is how much gold
              there is. */}
          <path
            fill="none"
            stroke="#ffd28a"
            strokeOpacity="0.28"
            strokeWidth="2.5"
            d="M90 800 V330 C90 170 330 70 600 70 C870 70 1110 170 1110 330 V800"
          />

          {/* Column bases, so the jambs land on something. */}
          <rect x="46" y="720" width="88" height="18" fill="#4a2a1c" opacity="0.75" />
          <rect x="1066" y="720" width="88" height="18" fill="#4a2a1c" opacity="0.75" />
        </g>
      </svg>

      <div className={`${styles.lamp} ${styles.lampLeft}`} />
      <div className={`${styles.lamp} ${styles.lampRight}`} />

      <div className={styles.motes}>
        <span className={`${styles.mote} ${styles.moteA}`} />
        <span className={`${styles.mote} ${styles.moteB}`} />
        <span className={`${styles.mote} ${styles.moteC}`} />
        <span className={`${styles.mote} ${styles.moteD}`} />
      </div>

      <div className={styles.terrace} />

      {/* Last, and deliberately so: everything above is decoration, this is
          what keeps the board readable through it. */}
      <div className={styles.scrim} />
    </div>
  );
}

export default ChaturangaScene;
