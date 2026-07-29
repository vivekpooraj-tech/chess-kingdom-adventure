// Copies the single-threaded "lite" Stockfish build (~7.3MB total) from
// node_modules into public/stockfish/, where Next.js serves it as a static
// asset the Worker can load same-origin.
//
// Why not load these from node_modules directly, or from a CDN? Files
// outside /public aren't served by Next.js at all, and jsDelivr (the usual
// npm-package CDN) refuses to serve *any* file from the `stockfish` package
// because its total unpacked size (~250MB across every WASM variant it
// ships) exceeds jsDelivr's 150MB-per-package limit. Copying just the two
// files we actually need, locally, sidesteps both problems and avoids an
// external runtime dependency entirely.
//
// Runs automatically via the "postinstall" script in package.json — no
// manual copy step required after `npm install`.

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(__dirname, "..", "node_modules", "stockfish", "bin");
const DEST_DIR = path.join(__dirname, "..", "public", "stockfish");

const FILES = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.warn(
      "[copy-stockfish] node_modules/stockfish/bin not found — skipping " +
        "(this is expected if the stockfish package isn't installed yet)."
    );
    return;
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });

  for (const file of FILES) {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(DEST_DIR, file);

    if (!fs.existsSync(src)) {
      console.warn(`[copy-stockfish] Missing expected file: ${src}`);
      continue;
    }

    fs.copyFileSync(src, dest);
    const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
    console.log(`[copy-stockfish] Copied ${file} (${sizeMb} MB) -> public/stockfish/`);
  }
}

main();