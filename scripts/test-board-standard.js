/**
 * Standard chessboard: one green/off-white board and one Staunton-style piece set,
 * identical in every World; legacy saved ids fall back to it.
 *   node scripts/test-board-standard.js
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { if (r.startsWith("@/")) r = path.join(process.cwd(), r.slice(2)); return orig.call(this, r, ...rest); };
require.extensions[".ts"] = function (m, f) { m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: f }).outputText, f); };
const ROOT = process.cwd();
const R = (p) => require(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };

const skins = R("content/boardSkins.ts");
const sets = R("content/pieceSets.ts");
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

check("exactly one board skin exists", skins.BOARD_SKINS.length === 1);
const skin = skins.BOARD_SKINS[0];
check("the board is green (dark) and off-white (light)", skin.darkSquare === "#769656" && skin.lightSquare === "#EEEED2");
const [dr, dg, db] = hex(skin.darkSquare), [lr, lg, lb] = hex(skin.lightSquare);
check("dark squares are green (g clearly dominant; not blue/purple/icy)", dg > dr && dg > db && dg - db >= 40);
check("light squares are warm off-white (bright, red >= blue)", lr > 220 && lg > 220 && lr >= lb);
check("flat colours only: no board image, frame art or gradient", !skin.boardImageUrl && !skin.frameColor && !/gradient/i.test(code("content/boardSkins.ts")));
check("the board is high-contrast enough (luminance ratio >= 2.5)", (() => { const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }; const a = L([lr, lg, lb]), b = L([dr, dg, db]); return (a + 0.05) / (b + 0.05) >= 2.5; })());
for (const legacy of ["ocean-ice", "walnut-ivory", "sunset-desert", "wood-classic", "", null, undefined, "nonsense"]) {
  check(`saved board id ${JSON.stringify(legacy)} falls back to the standard board`, skins.getBoardSkin(legacy).id === "standard-green");
}
// Customize screen: the Board card's "Selected" state follows the EFFECTIVE board, not the raw stored id.
const selectedCards = (saved) => skins.BOARD_SKINS.filter((s) => s.id === skins.effectiveBoardSkinId(saved)).map((s) => s.id);
check("saved 'standard-green' -> the Standard card is Selected", JSON.stringify(selectedCards("standard-green")) === '["standard-green"]');
for (const legacy of ["ocean-ice", "walnut-ivory", "sunset-desert", "wood-classic", "nonsense", ""]) {
  check(`retired/unknown saved id ${JSON.stringify(legacy)} -> the Standard card is Selected`, JSON.stringify(selectedCards(legacy)) === '["standard-green"]');
}
check("no saved id (null / undefined) -> the Standard card is Selected (same as the renderer's default)", JSON.stringify(selectedCards(null)) === '["standard-green"]' && JSON.stringify(selectedCards(undefined)) === '["standard-green"]');
check("effective id always equals what the renderer draws", ["standard-green", "wood-classic", null, undefined, "x"].every((v) => skins.effectiveBoardSkinId(v) === skins.getBoardSkin(v).id));
const customize = read("app/profile/customize/page.tsx");
const loadFn = customize.slice(customize.indexOf("async function load()"), customize.indexOf("load();"));
check("Customize loads the effective id into state", /setBoardSkinId\(effectiveBoardSkinId\(child\.board_skin_id\)\)/.test(loadFn));
check("viewing Customize never writes the preference (no update call inside load)", !/updateChild(BoardSkin|PieceSet)/.test(loadFn));
check("the preference is still saved only when a card is chosen", /function selectBoardSkin[\s\S]*?updateChildBoardSkin\(/.test(customize));
check("exactly one piece set exists: the standard Staunton-style set", sets.PIECE_SETS.length === 1 && sets.PIECE_SETS[0].id === "wikimedia-classic" && sets.DEFAULT_PIECE_SET_ID === "wikimedia-classic");
for (const legacy of ["kingdom-characters", "neostaunton-hand", "royal-legends", "wood-classic", "", null, undefined]) {
  check(`saved piece-set id ${JSON.stringify(legacy)} falls back to the standard pieces`, sets.getPieceSet(legacy).id === "wikimedia-classic");
}
const folder = sets.PIECE_SETS[0].folder;
for (const shade of ["light", "dark"]) for (const p of Object.values(sets.PIECE_FILE_NAME)) {
  check(`standard piece asset exists: ${shade}/${p}.svg`, fs.existsSync(path.join(ROOT, "public/pieces", folder, shade, p + ".svg")));
}
check("no character / fantasy piece folders remain in public/pieces", fs.readdirSync(path.join(ROOT, "public/pieces")).every((d) => !/kingdom|character|legend|neostaunton|wood/.test(d)));
check("the textured wood board image is gone", !fs.existsSync(path.join(ROOT, "public/boards/wood-classic.svg")));

// Live-source sweep.
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "android", ".a3-deploy", ".a4-release", ".a5-candidate", "qa-evidence", "device-validation", "tablet-test-screenshots", "supabase", "docs"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx|js|css|json)$/.test(e.name) && !/^test-board-standard/.test(e.name)) out.push(p);
  }
  return out;
}
const live = ["app", "components", "content", "lib", "public"].flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : []));
const grep = (re) => live.filter((f) => re.test(fs.readFileSync(f, "utf8")));
check("no 'Ocean Ice' reference remains in live source", grep(/ocean[-\s_]?ice|oceanice/i).length === 0, grep(/ocean[-\s_]?ice/i).join(","));
check("no Kingdom character-piece reference remains in live source", grep(/kingdom-characters|Kingdom Characters/).length === 0, grep(/kingdom-characters/).join(","));
check("no reference to the removed piece folders or wood board asset", grep(/pieces\/(wood-classic|neostaunton-hand|royal-legends)|boards\/wood-classic/).length === 0, grep(/pieces\/(wood-classic|neostaunton-hand|royal-legends)/).join(","));

const board = read("components/board/ChessBoard.tsx");
const pieceImg = read("components/board/PieceImage.tsx");
check("the single shared ChessBoard reads the skin and set from the registries", /getBoardSkin\(/.test(board) && /getPieceSet\(/.test(board));
check("PieceImage draws from the set folder (no character rendering path)", /\/pieces\/\$\{folder\}/.test(pieceImg) && !/kingdom|character/i.test(pieceImg));
check("highlights are subtle on green/white: legal-move dots and rings are neutral translucent black", /bg-black\/20/.test(board) && /ring-black\/20/.test(board));
check("selection and last-move use yellow-green tints, no gold/coral/blue accents on squares", /#A9B93A/.test(board) && /#BACA44/.test(board) && !/ring-kingdom-gold|ring-kingdom-coral|bg-kingdom-gold/.test(code("components/board/ChessBoard.tsx")));
check("coordinate labels use the standard green/cream pair", /text-\[#EEEED2\]/.test(board) && /text-\[#769656\]/.test(board));
check("no per-World board skins: world CSS does not set board colours", !/(light|dark)Square|--board-light|--board-dark/.test(read("app/worlds.css")));
check("Chess School piece-intro art uses the standard set", /pieces\/wikimedia-classic\/light\/pawn\.svg/.test(read("components/school/v2/steps.tsx")));
check("Chess School keeps the responsive board fit", /fitBoardWidth\(/.test(read("components/school/v2/steps.tsx")));
check("Train Your Mind is untouched by this change", !/boardSkins|pieceSets/.test(read("components/trainYourMind/TrainDrill.tsx").replace(/boardSkinId|pieceSetId/g, "")));
console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
