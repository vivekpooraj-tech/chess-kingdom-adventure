/*
 * Chess Mind World: the location registry, the scene registry, and the theme
 * tokens that connect a location to the shared game chrome.
 *
 * lib/world/locations.ts is loaded from the REAL TypeScript source, transpiled
 * in memory, so these assertions run against shipped code rather than a copy.
 * The registry/stylesheet agreement checks are static reads of the sources,
 * because they are claims about how two files line up rather than about a
 * value. Comments are stripped first so an assertion can never be satisfied by
 * the prose that describes it.
 *
 * Run: node scripts/test-world-locations.js
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

function loadTs(relPath) {
  const js = ts.transpileModule(read(relPath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", js)(mod, mod.exports, require);
  return mod.exports;
}

/** Remove block and line comments so assertions can't match their own prose. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (Object.is(actual, expected)) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}\n          expected: ${expected}\n          actual:   ${actual}`);
  }
}

const { WORLD_LOCATIONS, getLocation, isPlayable, DEFAULT_LOCATION_ID } = loadTs(
  "lib/world/locations.ts"
);

console.log("\n--- Chaturanga exists in the location data ---");
const chat = getLocation("chaturanga");
check("chaturanga resolves", chat !== null, true);
check("it is in the catalogue", WORLD_LOCATIONS.some((l) => l.id === "chaturanga"), true);
check("display name", chat.name, "Chaturanga");
check("title", chat.title, "The Birthplace of Strategy");
check("country", chat.country, "India");
check("country code", chat.countryCode, "IN");
check("it is built, not coming-soon", chat.status, "available");
check("it is playable", isPlayable(chat), true);
check("it is not paywalled", chat.isPremium, false);
check("it has a description", chat.description.length > 40, true);
check("it has an ambience label", chat.ambience.label, "Royal Sunset");

console.log("\n--- Historical claims stay inside what is actually known ---");
const claim = chat.description.toLowerCase();
check("does not claim to reconstruct a real palace", /reconstruct|replica|recreat/.test(claim), false);
check("does not name a specific real monument", /taj mahal|amber fort|red fort|mysore|hawa mahal/.test(claim), false);
check("says the game grew out of chaturanga", /grew out of chaturanga/.test(claim), true);
check("disclaims being a real court", /does not pretend/.test(claim), true);

console.log("\n--- London Eye still resolves exactly as before ---");
const london = getLocation("london-eye");
check("london-eye resolves", london !== null, true);
check("name unchanged", london.name, "London Eye");
check("title unchanged", london.title, "Chess Above the City");
check("city unchanged", london.city, "London");
check("still available", london.status, "available");
check("palette unchanged", london.palette.from, "#2a1b4d");
check("default location is still london-eye", DEFAULT_LOCATION_ID, "london-eye");
check("london ships no theme, so it uses the CSS fallbacks", london.theme, undefined);

console.log("\n--- Invalid and locked locations behave as before ---");
check("unknown id is null", getLocation("atlantis"), null);
check("null id is null", getLocation(null), null);
check("undefined id is null", getLocation(undefined), null);
check("empty id is null", getLocation(""), null);
check("null is not playable", isPlayable(null), false);
check("a coming-soon location is not playable", isPlayable(getLocation("paris-rooftop")), false);
const comingSoon = WORLD_LOCATIONS.filter((l) => l.status !== "available");
check("every coming-soon location is unplayable", comingSoon.every((l) => !isPlayable(l)), true);
check("there are still coming-soon locations", comingSoon.length > 0, true);

console.log("\n--- Ids are unique and every location is well formed ---");
const ids = WORLD_LOCATIONS.map((l) => l.id);
check("no duplicate ids", new Set(ids).size, ids.length);
check(
  "every location has id, name, country and palette",
  WORLD_LOCATIONS.every((l) => l.id && l.name && l.country && l.palette && l.palette.from),
  true
);

console.log("\n--- Chaturanga's theme tokens resolve ---");
const TOKEN_KEYS = ["glass", "glassSolid", "boardShadow"];
check("chaturanga ships a theme", typeof chat.theme, "object");
for (const k of TOKEN_KEYS) {
  check(`theme.${k} is a non-empty string`, typeof chat.theme[k] === "string" && chat.theme[k].length > 0, true);
}
check("its glass is warm, not London's navy", chat.theme.glass === "rgba(8, 12, 24, 0.55)", false);

console.log("\n--- The tokens the component sets are the tokens the CSS reads ---");
const backdropSrc = stripComments(read("components/world/WorldSceneBackdrop.tsx"));
const overlaySrc = stripComments(read("components/world/worldOverlay.css"));
const setTokens = [...backdropSrc.matchAll(/\["(--cm-world-[a-z-]+)"/g)].map((m) => m[1]).sort();
const readTokens = [...overlaySrc.matchAll(/var\((--cm-world-[a-z-]+)/g)].map((m) => m[1]).sort();
check("the component sets three tokens", setTokens.length, 3);
check("the stylesheet reads three tokens", readTokens.length, 3);
check(
  "the two sets are identical (no token set but never read, or read but never set)",
  setTokens.join(",") === [...new Set(readTokens)].sort().join(","),
  true
);
const varUses = [...overlaySrc.matchAll(/var\(--cm-world-[a-z-]+([^)]*)\)/g)].map((m) => m[1]);
check("every var() carries a fallback", varUses.length > 0 && varUses.every((v) => v.trim().startsWith(",")), true);
check("the tokens are removed on cleanup", backdropSrc.includes("removeProperty"), true);

console.log("\n--- One scene registry, and it agrees with the catalogue ---");
const registrySrc = stripComments(read("components/world/sceneRegistry.ts"));
const sceneIds = [...registrySrc.matchAll(/import\("\.\/([A-Za-z]+Scene)"\)/g)].map((m) => m[1]);
check("two scenes are registered", sceneIds.length, 2);
check("the London Eye scene is registered", sceneIds.includes("LondonEyeScene"), true);
check("the Chaturanga scene is registered", sceneIds.includes("ChaturangaScene"), true);
for (const id of ["london-eye", "chaturanga"]) {
  check(`${id} is keyed in the scene registry`, new RegExp(`["']?${id}["']?:`).test(registrySrc), true);
}
const availableIds = WORLD_LOCATIONS.filter((l) => l.status === "available").map((l) => l.id);
check(
  "every available location has a scene registered",
  availableIds.every((id) => new RegExp(`["']?${id}["']?:`).test(registrySrc)),
  true
);
check("no location renders a scene it does not have", availableIds.length, sceneIds.length);

console.log("\n--- The second registry is gone ---");
const previewSrc = stripComments(read("components/world/LocationPreview.tsx"));
const hardcoded = "location.id ===";
check("the preview no longer hardcodes a location id", previewSrc.includes(hardcoded), false);
check("the preview uses the shared registry", previewSrc.includes("getScene"), true);
check("the backdrop uses the shared registry", backdropSrc.includes("getScene"), true);
check("the backdrop no longer keeps its own scene map", /const SCENES/.test(backdropSrc), false);

console.log("\n--- Scenes stay decorative and inert ---");
for (const [name, file] of [
  ["Chaturanga", "components/world/ChaturangaScene.tsx"],
  ["London Eye", "components/world/LondonEyeScene.tsx"],
]) {
  const src = stripComments(read(file));
  check(`${name} scene is aria-hidden`, src.includes('aria-hidden="true"'), true);
  check(`${name} scene is presentational`, src.includes('role="presentation"'), true);
  check(`${name} scene holds no chess logic`, /chess|move|fen|clock/i.test(src), false);
  check(`${name} scene has no state or effects`, /useState|useEffect/.test(src), false);
}

console.log("\n--- Scene stylesheets respect motion and stay out of the way ---");
for (const [name, file] of [
  ["Chaturanga", "components/world/chaturanga.module.css"],
  ["London Eye", "components/world/londonEye.module.css"],
]) {
  const css = read(file);
  check(`${name} css is pointer-events: none`, /pointer-events:\s*none/.test(css), true);
  check(`${name} css honours prefers-reduced-motion`, /prefers-reduced-motion:\s*reduce/.test(css), true);
  check(`${name} css sits at z-index 0`, /z-index:\s*0/.test(css), true);
  check(`${name} css has a scrim for board readability`, /\.scrim/.test(css), true);
  check(`${name} css has a phone breakpoint`, /max-width:\s*640px/.test(css), true);
}

console.log("\n--- The two locations do not look like each other ---");
const chatCss = read("components/world/chaturanga.module.css");
const londonCss = read("components/world/londonEye.module.css");
check("Chaturanga does not reuse London's sky tokens", chatCss.includes("--sky-horizon"), false);
check("London keeps its own sky tokens", londonCss.includes("--sky-horizon"), true);
check("Chaturanga has its own stone palette", chatCss.includes("--stone"), true);
check("London has no stone palette", londonCss.includes("--stone"), false);
check("the palettes differ", chat.palette.from === london.palette.from, false);

console.log("\n--- Badges stay rare ---");
const badged = WORLD_LOCATIONS.filter((l) => l.badge);
check("exactly one location carries a badge", badged.length, 1);
check("it is Chaturanga", badged[0] && badged[0].id, "chaturanga");
check("the badge reads Flagship", chat.badge, "Flagship");
const cardSrc = stripComments(read("components/world/WorldLocationCard.tsx"));
check("the card renders a badge only when there is one", /location\.badge &&/.test(cardSrc), true);

console.log("\n--- No emoji flags anywhere in World (Windows renders boxes) ---");
const FLAG_GLYPH = /[\u{1F1E6}-\u{1F1FF}]/u;
for (const f of fs.readdirSync(path.join(ROOT, "components", "world"))) {
  const src = stripComments(read("components", "world", f));
  check(`${f} has no regional-indicator glyphs`, FLAG_GLYPH.test(src), false);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
