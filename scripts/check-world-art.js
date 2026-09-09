/*
 * Size budget for Chess Mind World artwork.
 *
 *   node scripts/check-world-art.js
 *
 * WHY THIS EXISTS. The World currently ships ZERO image bytes — every scene is
 * drawn in CSS and SVG and code-split, so a player who never opens it pays
 * nothing. Painted art is a real regression to that, and the app is a Capacitor
 * WebView pointed at a remote origin: the first time someone opens a location
 * on mobile data, they download the plate before they can play. A budget that
 * is only a good intention gets blown by the first 4MB PNG someone exports at
 * the wrong quality, so it is enforced here and wired into the World suite.
 *
 * The numbers are deliberately tight. AVIF at these dimensions comfortably hits
 * them for illustrated content; if a file misses, the fix is the export
 * setting, not the budget.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "public", "world");

/** Bytes. Keyed by the filename stem the pipeline produces. */
const BUDGETS = {
  "bg-portrait.avif": 180 * 1024,
  "bg-portrait.webp": 320 * 1024,
  "bg-wide.avif": 220 * 1024,
  "bg-wide.webp": 380 * 1024,
  "fg-portrait.webp": 90 * 1024,
  "fg-wide.webp": 110 * 1024,
};

const kb = (n) => (n / 1024).toFixed(0) + " KB";

let checked = 0;
const failures = [];
const unknown = [];

if (!fs.existsSync(ART_DIR)) {
  console.log("No public/world directory yet — nothing to check.");
  console.log("\n=== WORLD ART: 0 checked, 0 over budget ===");
  process.exit(0);
}

for (const location of fs.readdirSync(ART_DIR)) {
  const dir = path.join(ART_DIR, location);
  if (!fs.statSync(dir).isDirectory()) continue;

  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const size = fs.statSync(full).size;
    const budget = BUDGETS[file];

    if (budget === undefined) {
      unknown.push(`${location}/${file}`);
      continue;
    }
    checked++;
    if (size > budget) {
      failures.push(`${location}/${file} is ${kb(size)}, budget ${kb(budget)}`);
    } else {
      console.log(`  ok   ${location}/${file}  ${kb(size)} / ${kb(budget)}`);
    }
  }
}

for (const u of unknown) {
  console.log(`  ??   ${u} — no budget defined for this filename`);
}
for (const f of failures) {
  console.log(`  OVER ${f}`);
}

console.log(
  `\n=== WORLD ART: ${checked} checked, ${failures.length} over budget, ${unknown.length} unrecognised ===`
);
if (failures.length) {
  console.error(
    "\nOver budget. Re-export at a lower quality rather than raising the budget:\n" +
      "the first open of a location on mobile data pays these bytes before the\n" +
      "player can move a piece."
  );
  process.exitCode = 1;
}
