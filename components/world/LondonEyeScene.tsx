import styles from "./londonEye.module.css";
import "./worldOverlay.css";

/**
 * The London Eye scene.
 *
 * Purely decorative and completely inert: `aria-hidden` so a screen reader
 * never walks a sunset, `pointer-events: none` (in the stylesheet) so it can
 * never swallow a click meant for a piece, and no props, state or effects — it
 * renders once and the browser owns every animation from there.
 *
 * It knows nothing about chess. That is the boundary the whole feature rests
 * on: this file could be deleted and the game would still play.
 */
export function LondonEyeScene() {
  return (
    <div className={`${styles.scene} ${styles.enter}`} aria-hidden="true" role="presentation">
      <div className={styles.sky} />
      <div className={styles.sun} />
      <div className={styles.cloudsFar} />
      <div className={styles.clouds} />

      <div className={styles.skylineFar} />
      <div className={styles.skyline} />

      <div className={styles.tower}>
        <div className={styles.towerSpire} />
        <div className={styles.towerShaft} />
        <div className={styles.towerFace} />
      </div>

      <div className={styles.river}>
        <div className={styles.shimmer} />
      </div>
      <div className={styles.lights} />

      <div className={styles.interior} />
      <div className={styles.capsule}>
        <div className={`${styles.strut} ${styles.strutA}`} />
        <div className={`${styles.strut} ${styles.strutB}`} />
      </div>

      {/* Last, and deliberately so: everything above is decoration, this is
          what keeps the board readable through it. */}
      <div className={styles.scrim} />
    </div>
  );
}

export default LondonEyeScene;
