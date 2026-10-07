/**
 * Customize library: the curated board + piece registries, their real assets, fallbacks, and the Customize screen's wiring.
 *   node scripts/test-customize-library.js
 * (Browser behaviour — overflow, previews, selection, persistence — is in scripts/test-customize-library-browser.js.)
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
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };

const skins = R("content/boardSkins.ts");
const sets = R("content/pieceSets.ts");
const worlds = R("lib/world/worlds.ts");
const PIECES = Object.values(sets.PIECE_FILE_NAME);
const COLOR = /^(#[0-9A-Fa-f]{6}|rgba?\([^)]+\))$/;
const legacyIds = ["aurelia", "atelier", "kingdom-characters", "sunset-desert", "ocean-ice", "walnut-classic", "classic-forest", "classic", "tournament", "modern", "", null, undefined, "nonsense"]; // retired, dropped or never existed

// --- The library (what is actually implemented).
const CURRENT_BOARDS = ["standard-green", "tournament-green", "slate"];
const RESTORED_BOARDS = ["walnut-ivory", "wood-classic"];
const DROPPED_BOARDS = ["sunset-desert", "ocean-ice", "walnut-classic"]; // removed from the library on purpose
const CURRENT_SETS = ["wikimedia-classic"];
const RESTORED_SETS = ["neostaunton-hand", "wood-classic", "royal-legends"];
const DROPPED_SETS = ["aurelia", "atelier", "kingdom-characters"]; // removed from the library, and their art deleted, on purpose
check("boards: the current four first (Standard Green is the default), then the two restored boards (Walnut & Ivory, Wood Classic)", skins.BOARD_SKINS.map((s) => s.id).join() === [...CURRENT_BOARDS, ...RESTORED_BOARDS].join(), skins.BOARD_SKINS.map((s) => s.id).join());
check("pieces: Classic (default), then the three restored sets (NeoStaunton, Wood Carved, Royal Legends)", sets.PIECE_SETS.map((s) => s.id).join() === [...CURRENT_SETS, ...RESTORED_SETS].join(), sets.PIECE_SETS.map((s) => s.id).join());
check("board names are Standard Green, Tournament Green, Slate, Walnut & Ivory, Wood Classic", skins.BOARD_SKINS.map((s) => s.name).join("|") === "Standard Green|Tournament Green|Slate|Walnut & Ivory|Wood Classic");
check("there are exactly 4 piece sets: Classic, NeoStaunton, Wood Carved, Royal Legends", sets.PIECE_SETS.length === 4 && sets.PIECE_SETS.map((s) => s.name).join("|") === "Classic|NeoStaunton|Wood Carved|Royal Legends", sets.PIECE_SETS.map((s) => s.name).join("|"));
check("Atelier / Aurelia and Kingdom Characters are not registered; no invented replacements (Modern / Tournament) either", DROPPED_SETS.every((id) => !sets.PIECE_SETS.some((s) => s.id === id)) && !sets.PIECE_SETS.some((s) => /atelier|aurelia|kingdom|modern|tournament/i.test(s.name + s.id + s.folder)));
check("the defaults are Standard Green and Classic, they come first, and no restored entry is a default", skins.DEFAULT_BOARD_SKIN_ID === "standard-green" && skins.BOARD_SKINS[0].id === "standard-green" && sets.DEFAULT_PIECE_SET_ID === "wikimedia-classic" && sets.PIECE_SETS[0].id === "wikimedia-classic" && !RESTORED_BOARDS.includes(skins.DEFAULT_BOARD_SKIN_ID) && !RESTORED_SETS.includes(sets.DEFAULT_PIECE_SET_ID));
check("ids are unique within each registry", new Set(skins.BOARD_SKINS.map((s) => s.id)).size === skins.BOARD_SKINS.length && new Set(sets.PIECE_SETS.map((s) => s.id)).size === sets.PIECE_SETS.length);
check("every option has a name and a short description", [...skins.BOARD_SKINS, ...sets.PIECE_SETS].every((o) => o.name && o.description && o.description.length < 60));

// Restored entries keep their ORIGINAL definitions (commit b42037c): ids, names, emoji, colours, folders, optical scales.
const OLD_BOARDS = { "walnut-ivory": { name: "Walnut & Ivory", emoji: "👑", lightSquare: "#E8D7B5", darkSquare: "#6B4528", frameColor: "#3A2417", coordinateColor: "#F4E7C5" }, "wood-classic": { name: "Wood Classic", emoji: "♟️", lightSquare: "#EAD6A8", darkSquare: "#4A2E17", boardImageUrl: "/boards/wood-classic.svg" } };
for (const [id, want] of Object.entries(OLD_BOARDS)) {
  const got = skins.getBoardSkin(id);
  check(`restored board ${id}: original name, emoji and colours/frame/image`, Object.entries(want).every(([k, v]) => got[k] === v) && got.id === id, JSON.stringify(got));
}
const OLD_SETS = { "neostaunton-hand": { name: "NeoStaunton", emoji: "♞", folder: "neostaunton-hand", w: 257, h: 545, scale: { k: 1.0, q: 0.95, b: 0.91, n: 0.90, r: 0.89, p: 0.86 } }, "wood-classic": { name: "Wood Carved", emoji: "🪵", folder: "wood-classic", w: 200, h: 300, scale: { k: 0.94, q: 0.92, b: 0.90, r: 0.89, n: 0.88, p: 0.86 } }, "royal-legends": { name: "Royal Legends", emoji: "⚜️", folder: "royal-legends", w: 213, h: 420, scale: { k: 1.0, q: 0.94, b: 0.90, n: 0.89, r: 0.88, p: 0.84 } } };
for (const [id, want] of Object.entries(OLD_SETS)) {
  const got = sets.getPieceSet(id);
  check(`restored pieces ${id}: original name, emoji, folder, size and optical scale`, got.id === id && got.name === want.name && got.emoji === want.emoji && got.folder === want.folder && got.intrinsicSize.width === want.w && got.intrinsicSize.height === want.h && JSON.stringify(got.opticalScale) === JSON.stringify(want.scale), JSON.stringify(got));
}

// --- 1/2/3. Registry contains only real asset references; every option resolves.
for (const s of skins.BOARD_SKINS) {
  check(`board ${s.id}: resolves to itself`, skins.getBoardSkin(s.id).id === s.id && skins.effectiveBoardSkinId(s.id) === s.id);
  check(`board ${s.id}: two different, valid square colours (hex or rgba)`, COLOR.test(s.lightSquare) && COLOR.test(s.darkSquare) && s.lightSquare.toLowerCase() !== s.darkSquare.toLowerCase());
  check(`board ${s.id}: any image it references exists on disk`, !s.boardImageUrl || (fs.existsSync(path.join(ROOT, "public", s.boardImageUrl)) && fs.statSync(path.join(ROOT, "public", s.boardImageUrl)).size > 1000));
}
for (const s of sets.PIECE_SETS) {
  check(`pieces ${s.id}: resolves to itself`, sets.getPieceSet(s.id).id === s.id && sets.effectivePieceSetId(s.id) === s.id);
  const dir = path.join(ROOT, "public/pieces", s.folder);
  check(`pieces ${s.id}: folder public/pieces/${s.folder} exists`, fs.existsSync(dir));
  const missing = [];
  for (const shade of ["light", "dark"]) for (const p of PIECES) {
    const f = path.join(dir, shade, p + ".svg");
    if (!fs.existsSync(f) || fs.statSync(f).size < 200 || !/<svg[\s>]/.test(fs.readFileSync(f, "utf8").slice(0, 400)) || !/viewBox=/.test(fs.readFileSync(f, "utf8").slice(0, 400))) missing.push(`${shade}/${p}`);
  }
  check(`pieces ${s.id}: all 12 SVGs exist and are real vector files`, missing.length === 0, missing.join(","));
  check(`pieces ${s.id}: optical scale covers every piece, king tallest, pawn smallest`, ["k", "q", "r", "b", "n", "p"].every((k) => s.opticalScale[k] > 0.5 && s.opticalScale[k] <= 1) && s.opticalScale.k === Math.max(...Object.values(s.opticalScale)) && s.opticalScale.p === Math.min(...Object.values(s.opticalScale)));
}
check("every folder under public/pieces is a registered set (no orphan or retired art)", fs.readdirSync(path.join(ROOT, "public/pieces")).every((d) => sets.PIECE_SETS.some((s) => s.folder === d)), fs.readdirSync(path.join(ROOT, "public/pieces")).join());
check("the Classic set keeps its attribution file", fs.existsSync(path.join(ROOT, "public/pieces/wikimedia-classic/ATTRIBUTION.md")));
check("every file in public/boards is referenced by a registered board (no orphan art)", (fs.existsSync(path.join(ROOT, "public/boards")) ? fs.readdirSync(path.join(ROOT, "public/boards")) : []).every((f) => skins.BOARD_SKINS.some((s) => s.boardImageUrl === "/boards/" + f)));

// --- Sunset Desert, Ocean Ice and Walnut Classic are gone from the library and everything that listed them.
check("Sunset Desert, Ocean Ice and Walnut Classic are not registered boards", DROPPED_BOARDS.every((id) => !skins.BOARD_SKINS.some((s) => s.id === id)) && !skins.BOARD_SKINS.some((s) => /sunset|ocean|walnut classic/i.test(s.name)));
check("no available-boards list (any world) offers them", [...worlds.WORLD_IDS, null].every((w) => DROPPED_BOARDS.every((id) => !skins.availableBoardSkins(w).some((s) => s.id === id))));
check("the board count is exactly 5", skins.BOARD_SKINS.length === 5);

// --- 4/5. Unknown / retired ids fall back to the defaults.
for (const id of legacyIds) {
  check(`saved board ${JSON.stringify(id)} -> Standard Green (preview, selected state and renderer agree)`, skins.getBoardSkin(id).id === "standard-green" && skins.effectiveBoardSkinId(id) === "standard-green");
  check(`saved pieces ${JSON.stringify(id)} -> Classic (preview, selected state and renderer agree)`, sets.getPieceSet(id).id === "wikimedia-classic" && sets.effectivePieceSetId(id) === "wikimedia-classic");
}
check("the retired database default piece id ('classic') resolves to Classic, so Classic shows as selected", sets.effectivePieceSetId("classic") === "wikimedia-classic");
check("restored ids are no longer legacy: they resolve to themselves, selected state included", [...RESTORED_BOARDS].every((id) => skins.effectiveBoardSkinId(id) === id) && [...RESTORED_SETS].every((id) => sets.effectivePieceSetId(id) === id));

// --- 6/7. Customize: selected state uses effective ids; viewing never writes.
const page = read("app/profile/customize/page.tsx");
const loadFn = page.slice(page.indexOf("async function load()"), page.indexOf("load();"));
check("Customize loads the effective board AND piece ids into state", /setBoardSkinId\(effectiveBoardSkinId\(child\.board_skin_id\)\)/.test(loadFn) && /setPieceSetId\(effectivePieceSetId\(child\.piece_set_id\)\)/.test(loadFn));
check("viewing Customize never writes a preference (no update call anywhere inside load)", !/updateChild(BoardSkin|PieceSet)|\.update\(|\.upsert\(/.test(loadFn));
check("a preference is written only when a card is chosen", /function selectBoardSkin[\s\S]*?updateChildBoardSkin\(/.test(page) && /function selectPieceSet[\s\S]*?updateChildPieceSet\(/.test(page) && (page.match(/updateChild(BoardSkin|PieceSet)\(/g) || []).length === 2);
check("choosing updates the preview state immediately, before the save resolves", /function selectBoardSkin\(id: string\) \{\s*setBoardSkinId\(id\);/.test(page) && /function selectPieceSet\(id: string\) \{\s*setPieceSetId\(id\);/.test(page));
check("selected state compares against the effective ids held in state", /selected=\{boardSkinId === skin\.id\}/.test(page) && /selected=\{pieceSetId === set\.id\}/.test(page));
check("sections are 'Board style' then 'Piece style', rendered from the registries", page.indexOf("Board style") < page.indexOf("Piece style") && /BOARD_SKINS\.map/.test(page) && /PIECE_SETS\.map/.test(page));

// --- 8/9. Previews are the real renderers, fed by the same registry ids and the current choice.
const cards = read("components/customize/StyleCards.tsx");
check("board cards render the actual <ChessBoard> with the card's skin and the CURRENT pieces", /<ChessBoard[^>]*readOnly[^>]*boardSkinId=\{skin\.id\}[^>]*pieceSetId=\{pieceSetId\}/.test(cards));
check("piece cards render the actual <PieceImage> for the registered set, on the CURRENT board's squares", /<PieceImage set=\{getPieceSet\(set\.id\)\}/.test(cards) && /getBoardSkin\(boardSkinId\)/.test(cards) && /board\.darkSquare : board\.lightSquare/.test(cards));
check("no stand-in swatches: the old coloured-rectangle board preview is gone", !/grid-rows-2/.test(page) && !/grid-rows-2/.test(cards) && !/skin\.darkSquare : skin\.lightSquare/.test(page));
check("the main preview is the real board driven by the same state", /<ChessBoard boardSkinId=\{boardSkinId\} pieceSetId=\{pieceSetId\} readOnly/.test(page));
check("previews use the preview position, not an image", /export const PREVIEW_FEN =/.test(cards) && !/<img|background-image|url\(/.test(code("components/customize/StyleCards.tsx").replace(/<PieceImage/g, "")));

// --- Accessibility / touch targets / responsive structure.
check("one accessible button per card: aria-pressed + name + 'selected' in the label", (cards.match(/aria-pressed=\{selected\}/g) || []).length === 2 && /aria-label=\{`\$\{skin\.name\} board\$\{selected \? ", selected" : ""\}`\}/.test(cards) && /aria-label=\{`\$\{set\.name\} pieces\$\{selected \? ", selected" : ""\}`\}/.test(cards));
check("the card control is the whole card (absolute inset-0) with a 44px minimum", /absolute inset-0 z-10 min-h-\[44px\] w-full/.test(cards));
check("previews are inert and not pointer targets (their 64 squares are not tab stops)", (cards.match(/\{\.\.\.INERT\}/g) || []).length === 2 && /inert: ""/.test(cards) && (cards.match(/pointer-events-none/g) || []).length >= 2);
check("no button is nested inside a button (ChessBoard squares are buttons)", !/<button[^>]*>[\s\S]*?<ChessBoard/.test(cards.replace(/<button[\s\S]*?\/>/g, "")));
check("selection is shown by gold border + 'Selected' badge, and the badge never shifts layout (absolute, always rendered)", /borderColor: selected \? "#D4AF37"/.test(cards) && /absolute -top-5 right-1/.test(cards) && /selected \? "opacity-100" : "opacity-0"/.test(cards));
check("grids are 2 columns on phones and 4 from the small breakpoint, with min-w-0 cards", (page.match(/grid grid-cols-2 gap-3 sm:grid-cols-4/g) || []).length === 2 && /min-w-0/.test(cards));
check("no fixed pixel widths on the cards (nothing can force horizontal overflow)", !/\bw-\[\d+px\]|\bwidth: \d+px|min-w-\[\d+px\]/.test(cards));

// --- 14. World filtering never removes the defaults.
const WORLDS = [...worlds.WORLD_IDS, null, undefined];
for (const w of WORLDS) {
  check(`world ${JSON.stringify(w)}: Standard Green and Classic are always offered`, skins.availableBoardSkins(w)[0].id === "standard-green" && sets.availablePieceSets(w)[0].id === "wikimedia-classic");
}
check("no world filter returns the whole library", skins.availableBoardSkins().length === skins.BOARD_SKINS.length && sets.availablePieceSets().length === sets.PIECE_SETS.length);
check("a skin's `worlds` list filters only that skin, never the defaults", skins.availableBoardSkins("enchanted").every((s) => !s.worlds || s.worlds.includes("enchanted") || s.id === "standard-green") && sets.availablePieceSets("classic").every((s) => !s.worlds || s.worlds.includes("classic") || s.id === "wikimedia-classic"));
check("world ids used in metadata are real worlds", [...skins.BOARD_SKINS, ...sets.PIECE_SETS].every((o) => (o.worlds || []).every((w) => worlds.WORLD_IDS.includes(w))));
check("the default entries carry no world restriction", !skins.BOARD_SKINS[0].worlds && !sets.PIECE_SETS[0].worlds);
// The page is wrapped in WorldScope for presentation only (its tokens and ground; app/world-customize.css). What must stay true: the options
// are not filtered by, and the page logic does not read, the world.
check("the Customize page does not depend on world-specific assets (it does not read the world; WorldScope is presentation only)", !/useWorld|data-world|worldFromMode/.test(page + cards) && !/availableBoardSkins|availablePieceSets/.test(page));

// --- 15. Restored art is the ORIGINAL art (byte-for-byte from Git), not a re-creation.
const { execFileSync } = require("child_process");
const SRC = "b42037c"; // the last commit before the standardisation removed these assets
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
let haveSource = true;
try { git("cat-file", "-e", SRC + "^{commit}"); } catch { haveSource = false; }
if (!haveSource) console.log(`NOTE: commit ${SRC} is not in this clone; the restored-art byte-for-byte check was not run`);
else {
  const files = git("ls-tree", "-r", "--name-only", SRC, "--", ...RESTORED_SETS.map((id) => "public/pieces/" + OLD_SETS[id].folder), "public/boards/wood-classic.svg").split("\n").filter(Boolean);
  check("the original commit has all 37 restored files (3 sets x 12 + 1 board)", files.length === 37, String(files.length));
  const bad = files.filter((f) => { try { return git("hash-object", f) !== git("rev-parse", `${SRC}:${f}`); } catch { return true; } });
  check("every restored file is byte-for-byte identical to the original in Git", bad.length === 0, bad.slice(0, 4).join(","));
}
check("all asset URLs the library can produce start with /pieces/<registered folder>/", /`\/pieces\/\$\{folder\}\$\{shade\}\/\$\{PIECE_FILE_NAME\[piece\]\}\.svg`/.test(read("components/board/PieceImage.tsx")) && sets.PIECE_SETS.every((s) => /^[a-z-]+$/.test(s.folder)));
const walkSrc = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkSrc(dir + "/" + e.name) : /\.(tsx?|css)$/.test(e.name) ? [dir + "/" + e.name] : []));
check("restored art is reached only through the registries: no screen hard-codes a legacy asset path", ["app", "components"].every((d) => walkSrc(d).every((f) => !/pieces\/(wood-classic|neostaunton-hand|royal-legends)\/|boards\/wood-classic/.test(read(f)))));

// --- The two dropped piece sets are gone completely: art, registry and source.
check("their asset folders are deleted", DROPPED_SETS.every((d) => !fs.existsSync(path.join(ROOT, "public/pieces", d))));
const srcFiles = ["app", "components", "content", "lib"].flatMap((d) => walkSrc(d).concat(fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).filter((e) => e.isFile() && /\.(tsx?|css)$/.test(e.name)).map((e) => d + "/" + e.name)));
check("no production source references aurelia, kingdom-characters or the Kingdom Characters set", [...new Set(srcFiles)].every((f) => !/aurelia|kingdom-characters|Kingdom Characters/i.test(read(f))), [...new Set(srcFiles)].filter((f) => /aurelia|kingdom-characters|Kingdom Characters/i.test(read(f))).join(","));
check("no piece-set 'Atelier' in the registry or the Customize UI (the Atelier WORLD is unrelated)", !/name: "Atelier"|Atelier \(/.test(read("content/pieceSets.ts") + read("components/customize/StyleCards.tsx") + read("app/profile/customize/page.tsx")));
check("no piece set carries world metadata any more; the generic world filter still keeps Classic", sets.PIECE_SETS.every((s) => !s.worlds) && [...worlds.WORLD_IDS, null].every((w) => sets.availablePieceSets(w)[0].id === "wikimedia-classic"));

// --- Onboarding pickers: effective ids, nothing written on open.
for (const [file, eff, key] of [["components/board/BoardSkinPicker.tsx", "effectiveBoardSkinId\\(child\\.board_skin_id\\)", "board"], ["components/board/PieceSetPicker.tsx", "effectivePieceSetId\\(child\\.piece_set_id\\)", "piece"]]) {
  const src = read(file);
  const loadFn = src.slice(src.indexOf("async function load()"), src.indexOf("load();"));
  check(`${key} picker selects the EFFECTIVE id on load (a legacy saved id visibly selects the default)`, new RegExp(`setSelected\\(${eff}\\)`).test(loadFn) && !/setSelected\(child\.(board_skin_id|piece_set_id)\)/.test(src));
  check(`${key} picker writes nothing on open (no update call in load); it saves only when confirmed`, !/updateChild(BoardSkin|PieceSet)|\.update\(|\.upsert\(/.test(loadFn) && /async function confirm\(\)[\s\S]*?updateChild(BoardSkin|PieceSet)\(/.test(src));
  check(`${key} picker marks the selected option for assistive tech`, /aria-pressed=\{isSelected\}/.test(src) && /data-(board|piece)-option=/.test(src));
}

// --- Same renderer everywhere: the game board and the preview use the same two registry lookups.
const board = read("components/board/ChessBoard.tsx");
check("the game board resolves skin and pieces through the same registry functions as the cards", /getBoardSkin\(boardSkinId\)/.test(board) && /getPieceSet\(pieceSetId\)/.test(board));

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
