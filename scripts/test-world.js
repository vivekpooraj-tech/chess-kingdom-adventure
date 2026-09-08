/**
 * Tests for Chess Mind World: lib/world/locations.ts and lib/world/passport.ts.
 *
 *   node scripts/test-world.js
 *
 * Imports the real modules. The property that matters most here is the
 * architectural boundary stated in every World file's own comments: a
 * location is a BACKDROP. It must never be able to reach move legality, the
 * clock, matchmaking, ratings or settlement — so this suite asserts that
 * boundary structurally, on the actual source, not just on behaviour.
 *
 * The second property: nothing in the passport is fake. "Played" means a
 * real game was started, never a card tapped or a preview opened, and no
 * count may ever be inflated by duplicate or malformed data.
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};

const L = require(path.join(process.cwd(), "lib", "world", "locations.ts"));
const P = require(path.join(process.cwd(), "lib", "world", "passport.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. Locations: real, finished, no fake locks --------------------------
{
  check("there are exactly two locations", L.WORLD_LOCATIONS.length === 2);
  check("London Eye exists", L.WORLD_LOCATIONS.some((l) => l.id === "london-eye"));
  check("Chaturanga exists", L.WORLD_LOCATIONS.some((l) => l.id === "chaturanga"));

  for (const loc of L.WORLD_LOCATIONS) {
    check(`${loc.id} has a title`, loc.title.length > 0);
    check(`${loc.id} has a tagline`, loc.tagline.length > 0);
    check(`${loc.id} has a real story, not a stub`, loc.story.length > 40);
    check(`${loc.id} names no "coming soon"`, !/coming soon|locked|unlock/i.test(loc.story + loc.tagline));
    check(`${loc.id} has a card gradient`, loc.cardGradient.includes("from-"));
  }

  check("getWorldLocation finds a real id", L.getWorldLocation("london-eye")?.id === "london-eye");
  check("getWorldLocation rejects an unknown id", L.getWorldLocation("atlantis") === null);
  check("getWorldLocation rejects null", L.getWorldLocation(null) === null);
  check("getWorldLocation rejects undefined", L.getWorldLocation(undefined) === null);
  check("getWorldLocation rejects empty string", L.getWorldLocation("") === null);

  check("isWorldLocationId accepts a real id", L.isWorldLocationId("chaturanga") === true);
  check("isWorldLocationId rejects junk", L.isWorldLocationId("xyz") === false);
  check("isWorldLocationId rejects non-strings", L.isWorldLocationId(42) === false);

  check(
    "playHereHref routes through Free Play, not a second game route",
    L.playHereHref("london-eye") === "/free-play?world=london-eye"
  );
  check("playHereHref encodes the id safely", !L.playHereHref("london-eye").includes(" "));
}

// --- 2. Passport: only real events, never inflated ------------------------
{
  const now = () => new Date().toISOString();

  let p = {};
  p = P.withVisit(p, "london-eye", now());
  check("a visit is recorded", !!p["london-eye"]);
  check("a visit alone is not a play", p["london-eye"].playedAt === null);
  check("a visit alone counts zero games", p["london-eye"].games === 0);

  const visitedAt = p["london-eye"].visitedAt;
  p = P.withVisit(p, "london-eye", now());
  check("visiting twice does not overwrite the first visit time", p["london-eye"].visitedAt === visitedAt);

  p = P.withGame(p, "london-eye", now());
  check("a game marks playedAt", !!p["london-eye"].playedAt);
  check("a game counts once", p["london-eye"].games === 1);

  const playedAt = p["london-eye"].playedAt;
  p = P.withGame(p, "london-eye", "2099-01-01T00:00:00.000Z");
  check("a second game increments the count", p["london-eye"].games === 2);
  check("a second game does not move the FIRST-played timestamp", p["london-eye"].playedAt === playedAt);

  // A game with no prior visit still produces a consistent record — you
  // cannot have played somewhere you never "visited".
  let fresh = {};
  fresh = P.withGame(fresh, "chaturanga", now());
  check("a game with no prior visit still records a visit", !!fresh["chaturanga"].visitedAt);
  check("a game with no prior visit records the play", !!fresh["chaturanga"].playedAt);

  check("unknown location ids are rejected by withVisit", Object.keys(P.withVisit({}, "atlantis", now())).length === 0);
  check("unknown location ids are rejected by withGame", Object.keys(P.withGame({}, "atlantis", now())).length === 0);
}

// --- 3. Normalisation: junk in, safe passport out --------------------------
{
  for (const junk of [null, undefined, 0, "", "nonsense", [], 42]) {
    const normalized = P.normalizePassport(junk);
    check(`junk normalises to an object: ${JSON.stringify(junk)}`, typeof normalized === "object" && normalized !== null);
    check(`junk normalises to empty: ${JSON.stringify(junk)}`, Object.keys(normalized).length === 0);
  }

  check(
    "unknown location keys are dropped",
    Object.keys(P.normalizePassport({ atlantis: { visitedAt: "x", games: 5 } })).length === 0
  );

  const negative = P.normalizePassport({ "london-eye": { visitedAt: "2024-01-01", games: -5 } });
  check("negative game counts collapse to zero", negative["london-eye"].games === 0);

  const fractional = P.normalizePassport({ "london-eye": { visitedAt: "2024-01-01", games: 3.9 } });
  check("fractional game counts floor", fractional["london-eye"].games === 3);

  const noVisit = P.normalizePassport({ "london-eye": { games: 5 } });
  check("an entry with no visitedAt is dropped entirely", noVisit["london-eye"] === undefined);

  check("malformed JSON yields an empty passport", Object.keys(P.parsePassport("{oh no")).length === 0);
  check("null JSON yields an empty passport", Object.keys(P.parsePassport(null)).length === 0);
}

// --- 4. Aggregate views are real arithmetic, not guesses -------------------
{
  const empty = {};
  check("totalGames of nothing is 0", P.totalGames(empty) === 0);
  check("playedLocations of nothing is empty", P.playedLocations(empty).length === 0);
  check("lastPlayed of nothing is null", P.lastPlayed(empty) === null);

  let p = P.withVisit({}, "london-eye", "2024-01-01T00:00:00.000Z");
  check("a visited-only location is not in playedLocations", P.playedLocations(p).length === 0);

  p = P.withGame(p, "london-eye", "2024-01-01T00:00:00.000Z");
  p = P.withGame(p, "chaturanga", "2024-06-01T00:00:00.000Z");
  p = P.withGame(p, "chaturanga", "2024-06-02T00:00:00.000Z");

  check("total games sums across locations", P.totalGames(p) === 3);
  check("played locations lists both", P.playedLocations(p).sort().join(",") === "chaturanga,london-eye");
  check("last played is the most recently played, not the most-played", P.lastPlayed(p) === "chaturanga");
}

// --- 5. Storage never throws, even with no window --------------------------
{
  let threw = false;
  try {
    P.readPassport();
    P.writePassport({});
    P.recordVisit("london-eye");
    P.recordGameStarted("london-eye");
    P.readSelectedLocation();
    P.writeSelectedLocation("london-eye");
    P.writeSelectedLocation(null);
  } catch {
    threw = true;
  }
  check("passport storage never throws without a window", threw === false);
  check("reading with no window yields an empty passport", Object.keys(P.readPassport()).length === 0);
  check("reading the selected location with no window yields null", P.readSelectedLocation() === null);
}

// --- 6. Structural: the World cannot touch the game -------------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const backdrop = strip(read("components/world/WorldSceneBackdrop.tsx"));
  const locationsSrc = strip(read("lib/world/locations.ts"));
  const passportSrc = strip(read("lib/world/passport.ts"));
  const worldPage = strip(read("app/world/page.tsx"));
  const freePlay = read("app/free-play/page.tsx");
  const eyeScene = strip(read("components/world/scenes/LondonEyeScene.tsx"));
  const chatScene = strip(read("components/world/scenes/ChaturangaScene.tsx"));

  // The backdrop must never be able to touch the game.
  check("the backdrop never imports chess.js", !/from "chess\.js"/.test(backdrop));
  check("the backdrop never imports ChessBoard", !/ChessBoard/.test(backdrop));
  check("the backdrop has no move handler", !/onMove|makeMove|applyMove|onGameOver/.test(backdrop));
  check("the backdrop disables pointer events", /pointer-events-none/.test(backdrop));
  check("the backdrop is hidden from screen readers", /aria-hidden="true"/.test(backdrop));
  check("scenes are code-split, not bundled eagerly", /dynamic\(\(\) => import/.test(backdrop));
  check("scenes opt out of SSR", /ssr: false/.test(backdrop));

  // The data layer is pure — no React, no game engine, no I/O beyond
  // localStorage (which is isolated to passport.ts's own read/write).
  check("locations.ts has no React", !/from "react"/.test(locationsSrc));
  check("locations.ts imports no game engine", !/chess\.js|ChessBoard/.test(locationsSrc));
  check("passport.ts has no React", !/from "react"/.test(passportSrc));
  check("passport.ts touches no chess rules", !/chess\.js|legal|Chess\(/.test(passportSrc));

  // Free Play's own game logic must be untouched by the World wiring.
  check("Free Play still imports chess.js types for its own game", /from "chess\.js"/.test(freePlay));
  check("Free Play's world param never gates the free-game limit", !/worldLocationId[\s\S]{0,120}(allowed|remaining|paywall)/i.test(freePlay));
  check("the backdrop is rendered only inside the board slot", /renderBoard=\{\(boardSize\)/.test(freePlay));
  check("recording a world game never substitutes for the real credit check", /startAiGame\(/.test(freePlay));

  // Scenes: decorative only, reduced-motion aware, no photography claims.
  for (const [name, scene] of [["London Eye", eyeScene], ["Chaturanga", chatScene]]) {
    check(`${name} scene is aria-hidden`, /aria-hidden="true"/.test(scene));
    check(`${name} scene respects reduced motion`, /prefers-reduced-motion/.test(scene));
    check(`${name} scene accepts a simplify prop for mobile`, /simplify/.test(scene));
    check(`${name} scene draws with CSS/SVG, not an <img> photograph`, !/<img\b/.test(scene));
  }

  // The World page only ever shows real numbers.
  check("the World page reads the real passport", /readPassport\(/.test(worldPage));
  check("the World page hardcodes no game count", !/\b\d+\s*games?\s*played\b/i.test(worldPage));
  check("the passport section is conditional on real data", /games > 0 && \(/.test(worldPage));
}

console.log(`\n=== CHESS MIND WORLD: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}
