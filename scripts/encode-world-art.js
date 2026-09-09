/*
 * Turn one source illustration into the plates a World location ships.
 *
 *   node scripts/encode-world-art.js london-eye "C:/path/to/source.png"
 *
 * WHY A SCRIPT AND NOT A README STEP. The budget in check-world-art.js is
 * tight on purpose (the first open of a location on mobile data pays these
 * bytes before the player can move a piece), and hitting it by hand means
 * remembering a quality setting, a crop, and a pixel size months from now.
 * Getting it wrong is silent: the image looks fine and the download is 4x.
 * So the settings live here, and the same command produces the same plates
 * for every location.
 *
 * THE CROP. Plates are rendered with object-fit: cover, so the file's aspect
 * decides what survives on a real phone. The target is the Motorola's
 * 411x914 viewport -- 9:20, aspect 0.450 -- which is narrower than almost
 * every generator's default. Encoding at that aspect means the crop happens
 * ONCE, here, where it can be looked at, rather than invisibly in the browser
 * on a device nobody is holding.
 *
 * 864x1920 is 2.1x the CSS viewport: sharp on a 3x phone screen after the
 * browser's own downscale, and small enough to stay inside budget.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const [locationId, source, cropArg] = process.argv.slice(2);
if (!locationId || !source) {
  console.error('Usage: node scripts/encode-world-art.js <location-id> "<source image>" [w:h:x:y]');
  process.exit(1);
}
if (cropArg && !/^\d+:\d+:\d+:\d+$/.test(cropArg)) {
  console.error("Crop must be w:h:x:y in source pixels, e.g. 724:1610:100:260");
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`No such file: ${source}`);
  process.exit(1);
}

const W = 864;
const H = 1920;
/*
 * THE FRAMING ARGUMENT, and why it is not optional in practice.
 *
 * A generated illustration frames its subject for a picture, not for a screen
 * with a chessboard nailed across the middle of it. The board occupies the
 * band from roughly 17% to 65% of the height, so whatever the image puts
 * there is invisible, and the opponent's face has to clear the TOP of that
 * band or the player is looking at an empty chair.
 *
 * Passing the crop here rather than re-exporting the source by hand keeps the
 * chosen framing written down and repeatable: the numbers are source pixels,
 * so the same command against the same original always produces the same
 * plate, and a future re-crop is a diff rather than an archaeology project.
 */
const COVER =
  (cropArg ? `crop=${cropArg},` : "") +
  `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;

const outDir = path.join(__dirname, "..", "public", "world", locationId);
fs.mkdirSync(outDir, { recursive: true });

const ffmpeg = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + " KB";

const webp = path.join(outDir, "bg-portrait.webp");
const avif = path.join(outDir, "bg-portrait.avif");

// WebP is the fallback every browser we ship to can read.
ffmpeg(["-i", source, "-vf", COVER, "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", webp]);
// AVIF is what modern Android Chrome actually downloads -- roughly a third
// the bytes at the same quality, which is most of the budget headroom.
ffmpeg(["-i", source, "-vf", COVER, "-c:v", "libaom-av1", "-still-picture", "1",
        "-crf", "34", "-cpu-used", "4", "-pix_fmt", "yuv420p", "-f", "avif", avif]);

console.log(`  ${path.relative(process.cwd(), webp)}  ${kb(webp)}`);
console.log(`  ${path.relative(process.cwd(), avif)}  ${kb(avif)}`);
console.log(`\nSource ${source}\nEncoded at ${W}x${H} (9:20, the Motorola's aspect).`);
console.log("Now run: node scripts/check-world-art.js");
