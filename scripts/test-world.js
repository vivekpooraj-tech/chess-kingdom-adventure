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

  // Fresh entries start with no win at all.
  check("a fresh entry has zero wins", p["london-eye"].wins === 0);
  check("a fresh entry has no firstWinAt", p["london-eye"].firstWinAt === null);
}

// --- 2b. Wins: real events, never double-counted, never impossible --------
{
  const now = () => new Date().toISOString();

  // The normal path: a game is recorded at start (withGame), then won at
  // end (withWin). The win must NOT double-count the game withGame already
  // counted.
  let p = P.withGame({}, "london-eye", now());
  check("one game started", p["london-eye"].games === 1);
  p = P.withWin(p, "london-eye", now());
  check("winning an already-started game does not inflate the game count", p["london-eye"].games === 1);
  check("the win is recorded", p["london-eye"].wins === 1);
  check("firstWinAt is set", !!p["london-eye"].firstWinAt);

  const firstWinAt = p["london-eye"].firstWinAt;
  p = P.withGame(p, "london-eye", "2099-01-01T00:00:00.000Z");
  p = P.withWin(p, "london-eye", "2099-01-01T00:00:00.000Z");
  check("a second win increments the count", p["london-eye"].wins === 2);
  check("a second win does not move the FIRST-win timestamp", p["london-eye"].firstWinAt === firstWinAt);
  check("wins never exceed games", p["london-eye"].wins <= p["london-eye"].games);

  // Defensive floor: a win reported with no prior game record (should not
  // happen from real gameplay, but must never produce a contradiction).
  const noGame = P.withWin({}, "chaturanga", now());
  check("a win with no prior game still credits at least one game", noGame["chaturanga"].games >= 1);
  check("a win with no prior game is still recorded as a win", noGame["chaturanga"].wins === 1);
  check("no contradiction: wins never exceed games even on the defensive path", noGame["chaturanga"].wins <= noGame["chaturanga"].games);

  check("unknown location ids are rejected by withWin", Object.keys(P.withWin({}, "atlantis", now())).length === 0);
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

  // A hand-edited/corrupted passport must never be able to claim more wins
  // than games — that is the one contradiction this module must refuse to
  // store, no matter what junk arrives from storage.
  const impossible = P.normalizePassport({ "london-eye": { visitedAt: "2024-01-01", games: 2, wins: 99 } });
  check("wins are clamped to never exceed games", impossible["london-eye"].wins === 2);

  const negativeWins = P.normalizePassport({ "london-eye": { visitedAt: "2024-01-01", games: 5, wins: -3 } });
  check("negative wins collapse to zero", negativeWins["london-eye"].wins === 0);

  const winsNoGames = P.normalizePassport({ "london-eye": { visitedAt: "2024-01-01", games: 0, wins: 4 } });
  check("wins with zero games clamp to zero", winsNoGames["london-eye"].wins === 0);

  const winsButNoTimestamp = P.normalizePassport({ "london-eye": { visitedAt: "2024-01-01", games: 3, wins: 1 } });
  check("a real win with no firstWinAt string still gets null, not a fabricated date", winsButNoTimestamp["london-eye"].firstWinAt === null);
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

// --- 4b. Achievements are derived from the passport, never a separate list -
{
  check("no achievements from an empty passport", P.worldAchievements({}).length === 0);

  let p = P.withGame({}, "london-eye", "2024-01-01T00:00:00.000Z");
  const afterGame = P.worldAchievements(p);
  check("a first game earns exactly one achievement", afterGame.length === 1);
  check("it is named after the real location", afterGame[0].title === "First Game in London Eye");
  check("no win achievement exists yet", !afterGame.some((a) => a.title.includes("Victory")));

  p = P.withWin(p, "london-eye", "2024-01-02T00:00:00.000Z");
  const afterWin = P.worldAchievements(p);
  check("a win adds a second achievement, not a replacement", afterWin.length === 2);
  check("the win achievement is named after the real location", afterWin.some((a) => a.title === "First Victory in London Eye"));
  check("every achievement key is namespaced by location", afterWin.every((a) => a.key.startsWith("london-eye:")));
  check("every achievement has a real earned timestamp", afterWin.every((a) => !!a.earnedAt));

  // A visit alone — no game — earns nothing. This is the one case the
  // brief is explicit about: nothing is awarded for looking.
  const visitOnly = P.withVisit({}, "chaturanga", "2024-01-01T00:00:00.000Z");
  check("a visit with no game earns nothing", P.worldAchievements(visitOnly).length === 0);

  // Achievements across two locations are both present and don't collide.
  // london-eye: one game, no win (1 achievement). chaturanga: won with no
  // prior game recorded, so the defensive floor in withWin credits both a
  // game AND a win (2 achievements) — 3 in total, and none of them mixed up
  // between locations.
  let both = P.withGame({}, "london-eye", "2024-01-01T00:00:00.000Z");
  both = P.withWin(both, "chaturanga", "2024-01-02T00:00:00.000Z");
  const combined = P.worldAchievements(both);
  check("achievements from two locations coexist", combined.length === 3);
  check(
    "each location's achievements stay namespaced to that location",
    combined.filter((a) => a.locationId === "london-eye").length === 1 &&
      combined.filter((a) => a.locationId === "chaturanga").length === 2
  );
  check(
    "achievements are ordered oldest first",
    combined.every((a, i) => i === 0 || Date.parse(combined[i - 1].earnedAt) <= Date.parse(a.earnedAt))
  );

  // An achievement for a location that no longer exists in the registry
  // must be dropped, not crash the derivation with an undefined title.
  const stale = P.worldAchievements({ atlantis: { visitedAt: "x", playedAt: "x", games: 1, firstWinAt: null, wins: 0 } });
  check("a stale/unknown location produces no achievement rather than throwing", stale.length === 0);
}

// --- 5. Storage never throws, even with no window --------------------------
{
  let threw = false;
  try {
    P.readPassport();
    P.writePassport({});
    P.recordVisit("london-eye");
    P.recordGameStarted("london-eye");
    P.recordGameWon("london-eye");
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

  // A World win is only ever recorded from the SAME real game-over signal
  // Free Play already uses for everything else, and only for an actual
  // checkmate win — never merely reaching game-over (which also covers
  // draws and losses).
  check("a World win is recorded from the real onGameOver result", /recordGameWon\(worldLocationId\)/.test(freePlay));
  check("a World win requires a real checkmate", /result\.isCheckmate[\s\S]{0,40}recordGameWon|recordGameWon[\s\S]{0,200}result\.isCheckmate/.test(freePlay) || /if \(worldLocationId && result\.isCheckmate && result\.winner === "w"\)/.test(freePlay));
  check("a World win checks the child's own colour, not either side", /result\.winner === "w"/.test(freePlay));

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

  // Achievements and favourite location.
  check("the World page derives achievements from the passport", /worldAchievements\(passport\)/.test(worldPage));
  check("achievements are only rendered when there are real ones", /achievements\.length > 0 && \(/.test(worldPage));
  check("the favourite toggle uses per-device storage, same as the rest of the passport", /writeSelectedLocation\(/.test(worldPage) && /readSelectedLocation\(/.test(worldPage));
  check("the favourite star reports its state to assistive tech", /aria-pressed=\{favourite\}/.test(worldPage));
}

// --- 8. Online games render the World through the canonical backdrop ------
//
// Free Play takes its location from `?world=`; an online game arrives from an
// invite link or from matchmaking, so it reuses the per-device choice the
// player already made on the World hub. readSelectedLocation() is therefore
// the gate that decides whether an online game shows a World at all, and it
// is exercised here for real against a fake store rather than described.
{
  const readSrc = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
  const onlinePage = readSrc("app", "online", "[gameId]", "page.tsx");
  const freePlay = readSrc("app", "free-play", "page.tsx");
  const backdrop = readSrc("components", "world", "WorldSceneBackdrop.tsx");

  const store = {};
  const hadWindow = "window" in global;
  const previousWindow = global.window;
  global.window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    },
  };

  // 1. An online game with no location chosen.
  delete store[P.SELECTED_LOCATION_KEY];
  check("no chosen location resolves to null, so no backdrop renders", P.readSelectedLocation() === null);

  // 2 & 3. Each real location.
  store[P.SELECTED_LOCATION_KEY] = "london-eye";
  check("london-eye resolves for an online game", P.readSelectedLocation() === "london-eye");
  store[P.SELECTED_LOCATION_KEY] = "chaturanga";
  check("chaturanga resolves for an online game", P.readSelectedLocation() === "chaturanga");

  // 4. Anything else fails safe — no World, never a broken one.
  for (const bad of ["atlantis", "", "LONDON-EYE", "london-eye ", "../../etc/passwd", "null", "{}", "0"]) {
    store[P.SELECTED_LOCATION_KEY] = bad;
    check(
      "invalid stored location " + JSON.stringify(bad) + " yields null, not a broken World",
      P.readSelectedLocation() === null
    );
  }

  // A storage that throws must not take a live game down with it.
  global.window = {
    localStorage: {
      getItem() {
        throw new Error("blocked");
      },
    },
  };
  check("a throwing localStorage yields null rather than an exception", P.readSelectedLocation() === null);

  if (hadWindow) global.window = previousWindow;
  else delete global.window;

  // The online page wires exactly that gate to exactly that backdrop.
  check(
    "the online page takes its location from the passport's selected location",
    /setWorldLocationId\(readSelectedLocation\(\)\)/.test(onlinePage)
  );
  check(
    "the online page imports the canonical backdrop",
    /import \{ WorldSceneBackdrop \} from "@\/components\/world\/WorldSceneBackdrop"/.test(onlinePage)
  );
  check(
    "the online backdrop renders only when a location resolved",
    /\{worldLocationId && \(\s*<WorldSceneBackdrop/.test(onlinePage)
  );
  check("the online backdrop is passed that id", /locationId=\{worldLocationId\}/.test(onlinePage));
  check(
    "the online page never branches on a specific location id",
    !/"london-eye"|"chaturanga"/.test(onlinePage)
  );
  check(
    "the online backdrop is contained in the board slot, not the page root",
    onlinePage.indexOf("<WorldSceneBackdrop") > onlinePage.indexOf("renderBoard={(boardSize)")
  );

  // 5. One backdrop architecture, still.
  check(
    "the retired scene registry has not come back",
    !fs.existsSync(path.join(process.cwd(), "components", "world", "sceneRegistry.ts"))
  );
  check(
    "the retired overlay stylesheet has not come back",
    !fs.existsSync(path.join(process.cwd(), "components", "world", "worldOverlay.css"))
  );
  check(
    "there is exactly one Chaturanga scene",
    fs.existsSync(path.join(process.cwd(), "components", "world", "scenes", "ChaturangaScene.tsx")) &&
      !fs.existsSync(path.join(process.cwd(), "components", "world", "ChaturangaScene.tsx"))
  );
  check(
    "free play and the online game use the same backdrop component",
    /from "@\/components\/world\/WorldSceneBackdrop"/.test(freePlay) &&
      /from "@\/components\/world\/WorldSceneBackdrop"/.test(onlinePage)
  );
  check("the backdrop cannot swallow a tap", /pointer-events-none/.test(backdrop));
  check("the backdrop is hidden from assistive tech", /aria-hidden="true"/.test(backdrop));

  // The boundary: the World must not be able to reach the game.
  const worldImports = (onlinePage.match(/import[^;]*from "@\/(lib|components)\/world\/[^"]*";/g) || []).join("\n");
  check(
    "the online page imports nothing from the World but the backdrop, the id type and the reader",
    !/recordGameWon|recordGameStarted|recordVisit|writePassport|writeSelectedLocation/.test(worldImports)
  );
  check(
    "the World never becomes a dependency of a move, clock or settlement call",
    !/worldLocationId/.test(
      (onlinePage.match(/(submitMove|claimTimeout|applyMatchRating|requestCompletion)\([^)]*\)/g) || []).join("")
    )
  );
}

console.log(`\n=== CHESS MIND WORLD: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}
