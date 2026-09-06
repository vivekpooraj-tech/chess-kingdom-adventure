/**
 * Rematch state-machine tests.
 *
 *   node scripts/test-rematch.js
 *
 * Pure logic — no database, so nothing to leak.
 *
 * The races are the point. A rematch is two people pressing a button at the
 * same moment over an unreliable channel, and the failure everyone ships at
 * least once is TWO games being created. These tests pin the properties that
 * make that impossible: agreement is a function of which offers are held (not
 * their arrival order), only the host creates, and creation is idempotent
 * against duplicate and stale broadcasts.
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

const R = require(path.join(process.cwd(), "lib", "online", "rematch.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const run = (events, start = R.INITIAL) => events.reduce((c, e) => R.reduce(c, e), start);
const OFFER_L = { type: "OFFER_LOCAL" };
const OFFER_R = { type: "OFFER_REMOTE" };

// ---- basic flow ----
{
  check("starts idle", R.INITIAL.state === "idle");
  check("local offer -> offered", run([OFFER_L]).state === "offered");
  check("remote offer -> received", run([OFFER_R]).state === "received");
  check("both offers -> agreed", run([OFFER_L, OFFER_R]).state === "agreed");
}

// ---- order independence (the simultaneous-click case) ----
{
  const a = run([OFFER_L, OFFER_R]);
  const b = run([OFFER_R, OFFER_L]);
  check("agreement does not depend on arrival order", a.state === b.state && a.state === "agreed");
  check("both orderings record both offers", a.iOffered && a.theyOffered && b.iOffered && b.theyOffered);
}

// ---- duplicate and stale broadcasts ----
{
  const spammed = run([OFFER_L, OFFER_L, OFFER_L, OFFER_R, OFFER_R]);
  check("duplicate offers are idempotent", spammed.state === "agreed");

  const created = run([OFFER_L, OFFER_R, { type: "CREATED", gameId: "game-1" }]);
  check("creation moves to ready", created.state === "ready" && created.newGameId === "game-1");

  const twice = R.reduce(created, { type: "CREATED", gameId: "game-2" });
  check("a second creation is ignored", twice.newGameId === "game-1");
  check("a second creation does not change state", twice.state === "ready");

  const lateOffer = R.reduce(created, OFFER_R);
  check("a stale offer after creation is ignored", lateOffer.state === "ready");
}

// ---- only one client creates ----
{
  const agreed = run([OFFER_L, OFFER_R]);
  check("the host creates the game", R.shouldCreateGame(agreed, true) === true);
  check("the guest never creates the game", R.shouldCreateGame(agreed, false) === false);

  const ready = R.reduce(agreed, { type: "CREATED", gameId: "g" });
  check("the host does not create twice", R.shouldCreateGame(ready, true) === false);

  check("nobody creates before agreement", R.shouldCreateGame(run([OFFER_L]), true) === false);
  check("nobody creates from idle", R.shouldCreateGame(R.INITIAL, true) === false);
}

// ---- simulate both clients independently, one shared channel ----
{
  // Host and guest each run their own reducer over the same broadcast stream.
  let host = R.INITIAL;
  let guest = R.INITIAL;

  // Both press Rematch at the same instant.
  host = R.reduce(host, OFFER_L); // host's own click
  guest = R.reduce(guest, OFFER_L); // guest's own click
  // Each then receives the other's broadcast.
  host = R.reduce(host, OFFER_R);
  guest = R.reduce(guest, OFFER_R);

  check("both clients reach agreement", host.state === "agreed" && guest.state === "agreed");
  const creators = [R.shouldCreateGame(host, R.isRematchCreator("w")), R.shouldCreateGame(guest, R.isRematchCreator("b"))].filter(Boolean);
  check("exactly one client creates the game", creators.length === 1);

  // The host creates and broadcasts; both converge on the same game.
  host = R.reduce(host, { type: "CREATED", gameId: "shared-game" });
  guest = R.reduce(guest, { type: "CREATED", gameId: "shared-game" });
  check("both clients end on the same game", host.newGameId === guest.newGameId);
  check("both clients are ready", host.state === "ready" && guest.state === "ready");
}

// ---- decline ----
{
  const declined = run([OFFER_L, { type: "DECLINE_REMOTE" }]);
  check("a remote decline ends the offer", declined.state === "declined");
  check("declining clears both offers", !declined.iOffered && !declined.theyOffered);

  const readyThenDecline = R.reduce(
    run([OFFER_L, OFFER_R, { type: "CREATED", gameId: "g" }]),
    { type: "DECLINE_REMOTE" }
  );
  check("a decline after creation cannot strand a player", readyThenDecline.state === "ready");

  const reoffer = run([OFFER_L], run([OFFER_L, { type: "DECLINE_REMOTE" }]));
  check("a new offer works after a decline", reoffer.state === "offered");
}

// ---- expiry ----
{
  check("an offer can expire", run([OFFER_L, { type: "EXPIRE" }]).state === "expired");
  check("idle does not expire", run([{ type: "EXPIRE" }]).state === "idle");
  const agreedExpire = run([OFFER_L, OFFER_R, { type: "EXPIRE" }]);
  check("expiry does not cancel an agreed rematch", agreedExpire.state === "agreed");
  const readyExpire = run([OFFER_L, OFFER_R, { type: "CREATED", gameId: "g" }, { type: "EXPIRE" }]);
  check("expiry does not cancel a created rematch", readyExpire.state === "ready");
  check("a TTL is defined", typeof R.OFFER_TTL_MS === "number" && R.OFFER_TTL_MS > 0);
}

// ---- reset (used on reconnect) ----
{
  const reset = R.reduce(run([OFFER_L, OFFER_R]), { type: "RESET" });
  check("reset returns to idle", reset.state === "idle" && !reset.iOffered && !reset.theyOffered);
}

// ---- colours swap, and exactly one creator ----
{
  check("the black player creates the rematch", R.isRematchCreator("b") === true);
  check("the white player does not", R.isRematchCreator("w") === false);
  // Exactly one player is Black, so exactly one creator exists in every game.
  check(
    "exactly one of the two players is the creator",
    [R.isRematchCreator("w"), R.isRematchCreator("b")].filter(Boolean).length === 1
  );
  check("white next plays black", R.nextColorFor("w") === "b");
  check("black next plays white", R.nextColorFor("b") === "w");
  check(
    "the creator becomes white, so colours really swap",
    R.isRematchCreator("b") && R.nextColorFor("b") === "w"
  );
}

// ---- unknown events are inert ----
{
  const before = run([OFFER_L]);
  const after = R.reduce(before, { type: "NOT_A_REAL_EVENT" });
  check("an unknown event changes nothing", after.state === before.state);
}

// ---- every state has a label ----
{
  const states = ["idle", "offered", "received", "agreed", "ready", "declined", "expired"];
  check(
    "every state describes itself",
    states.every((s) => typeof R.describe({ ...R.INITIAL, state: s }) === "string")
  );
  check("idle says nothing", R.describe(R.INITIAL) === "");
}

console.log(`\n=== REMATCH: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}
