/**
 * Login welcome (Video 2): sessionStorage must not pretend the video
 * already played, and the page must not skip it when autoplay fails.
 *
 *   node scripts/test-login-welcome.js
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

const welcome = require(path.join(process.cwd(), "lib", "loginWelcome.ts"));

let pass = 0;
const failures = [];
function check(name, ok) {
  if (ok) pass++;
  else failures.push(name);
}

function withStorage(storage, fn) {
  const previous = Object.getOwnPropertyDescriptor(global, "sessionStorage");
  Object.defineProperty(global, "sessionStorage", { configurable: true, value: storage });
  try {
    fn();
  } finally {
    if (previous) Object.defineProperty(global, "sessionStorage", previous);
    else delete global.sessionStorage;
  }
}

{
  const bag = new Map();
  withStorage(
    {
      getItem: (k) => (bag.has(k) ? bag.get(k) : null),
      setItem: (k, v) => bag.set(k, v),
    },
    () => {
      check("empty session has not shown the video", welcome.hasShownLoginWelcomeThisSession() === false);
      welcome.markLoginWelcomeShownThisSession();
      check("marking the session records it", welcome.hasShownLoginWelcomeThisSession() === true);
    }
  );
}

withStorage(
  {
    getItem() {
      const err = new Error("denied");
      err.name = "SecurityError";
      throw err;
    },
    setItem() {
      const err = new Error("denied");
      err.name = "SecurityError";
      throw err;
    },
  },
  () => {
    check("SecurityError is not treated as already shown", welcome.hasShownLoginWelcomeThisSession() === false);
    let threw = false;
    try {
      welcome.markLoginWelcomeShownThisSession();
    } catch {
      threw = true;
    }
    check("a storage failure while marking does not throw", threw === false);
  }
);

{
  const page = fs.readFileSync(path.join(process.cwd(), "app", "login-welcome", "page.tsx"), "utf8");
  const video = fs.readFileSync(path.join(process.cwd(), "content", "loginWelcomeVideo.ts"), "utf8");
  const gate = fs.readFileSync(path.join(process.cwd(), "app", "parent-gate", "page.tsx"), "utf8");
  check("page uses the production hero asset", page.includes("LOGIN_WELCOME_VIDEO_URL"));
  check("asset url is login-welcome/hero.mp4", video.includes("login-welcome/hero.mp4"));
  check("old welcome filename is not referenced", !page.includes("Chess_app_welcome_animation") && !video.includes("Chess_app_welcome_animation"));
  check("video is not hidden until the playing event", !page.includes("opacity-0"));
  check("autoplay starts muted", /muted/.test(page) && /v\.muted = true/.test(page));
  check("a Play button is offered when a tap is required", />\s*Play\s*</.test(page));
  check("autoplay failure does not settle the page", !page.includes("if (videoUnavailable) settle"));
  check("parent gate still sends eligible logins to login-welcome", gate.includes('router.replace("/login-welcome")'));
  check("parent gate still requires the opening-video flag", gate.includes("has_seen_opening_video"));
}

// ---------------------------------------------------------------------------
// The fallback state machine (lib/loginWelcomeMachine.ts) — the same pure
// reducer app/login-welcome/page.tsx drives. Events carry timestamps, so slow
// starts and stale results are exercised with real durations and orderings.
// Attempt ids: the first sound-first attempt is 1; every Play tap starts the
// next one; rejections must carry the id of the attempt they belong to.
// ---------------------------------------------------------------------------
{
  const m = require(path.join(process.cwd(), "lib", "loginWelcomeMachine.ts"));
  const IDLE = m.NO_PROGRESS_MS;
  const MAX = m.MAX_WAIT_MS;
  const GAP = m.TICK_GAP_FORGIVE_MS;

  // Replay events in time order (a tick sorts first at an equal timestamp, as
  // an interval firing before a later-dispatched media event would).
  function run(events) {
    const ordered = events
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.at - b.e.at || (b.e.type === "tick") - (a.e.type === "tick") || a.i - b.i)
      .map((x) => x.e);
    let state = m.initialWelcomeState();
    const trace = [];
    const effects = [];
    for (const e of ordered) {
      const step = m.reduceWelcome(state, e);
      state = step.state;
      effects.push(...step.effects.map((x) => `${x.kind}#${x.attempt}`));
      trace.push({ at: e.at, type: e.type, phase: state.phase, failure: state.failure });
    }
    return { state, trace, effects };
  }
  const ticks = (from, to) => {
    const out = [];
    for (let t = from; t <= to; t += 1000) out.push({ type: "tick", at: t });
    return out;
  };
  const everFellBack = (trace) => trace.some((s) => s.phase === "fallback");
  const firstFallbackAt = (trace) => (trace.find((s) => s.phase === "fallback") || {}).at;
  const unmutedRej = (at, attempt) => ({ type: "unmuted-rejected", at, attempt });
  const mutedRej = (at, attempt) => ({ type: "muted-rejected", at, attempt });

  // 1. Fast playback, with timeupdate while it plays.
  {
    const play = [];
    for (let t = 1500; t <= 5500; t += 250) play.push({ type: "progress", at: t });
    const r = run([
      { type: "ready", at: 0 },
      { type: "progress", at: 150 },
      { type: "canplay", at: 1200 },
      { type: "playing", at: 1400 },
      ...play,
      ...ticks(1000, 6000),
    ]);
    check("fast: one sound-first attempt, id 1", r.effects.join() === "play-unmuted#1");
    check("fast: ends playing, overlay never appeared", r.state.phase === "playing" && !everFellBack(r.trace));
  }

  // 2. The slow start from the field: ready at 0, nothing useful until 11.5s.
  {
    const silent = run([
      { type: "ready", at: 0 },
      ...ticks(1000, 14000),
      { type: "canplay", at: 11500 },
      { type: "playing", at: 11600 },
    ]);
    check("slow+silent: no overlay at any point before playback starts", !everFellBack(silent.trace));
    check("slow+silent: ends playing", silent.state.phase === "playing");
    check("slow+silent: autoplay attempted once the data arrives", silent.effects.join() === "play-unmuted#1");

    const alive = run([
      { type: "ready", at: 0 },
      { type: "progress", at: 400 },
      { type: "progress", at: 2000 },
      { type: "progress", at: 4000 },
      { type: "progress", at: 6000 },
      { type: "progress", at: 8000 },
      { type: "progress", at: 9500 },
      { type: "canplay", at: 11500 },
      { type: "playing", at: 11600 },
      ...ticks(1000, 14000),
    ]);
    check("slow+alive: no overlay at any point, including past the old 8s deadline", !everFellBack(alive.trace) && alive.state.phase === "playing");

    // A pending fallback is cleared by playing at 11.5s.
    const pending = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 3000 },
      unmutedRej(3100, 1),
      mutedRej(3200, 1),
      { type: "playing", at: 11500 },
    ]);
    check("pending fallback is shown while nothing plays", pending.trace.find((s) => s.at === 3200).phase === "fallback");
    check("playing at 11.5s clears the pending fallback", pending.state.phase === "playing" && pending.state.failure === null);
  }

  // 3. waiting / stalled are not failures.
  {
    const r = run([
      { type: "ready", at: 0 },
      { type: "progress", at: 1000 },
      { type: "waiting", at: 2000 },
      { type: "stalled", at: 3000 },
      { type: "progress", at: 4000 },
      { type: "waiting", at: 5000 },
      ...ticks(1000, 9000),
    ]);
    check("waiting/stalled alone never trigger the overlay", !everFellBack(r.trace));
    const only = run([
      { type: "ready", at: 0 },
      { type: "stalled", at: 1000 },
      { type: "waiting", at: 2000 },
      ...ticks(1000, IDLE + 2000),
    ]);
    check("waiting/stalled do not count as progress: a video that only stalls still escapes", only.state.phase === "fallback" && only.state.failure === "stalled");
  }

  // 4. Sound-first -> muted fallback.
  {
    const sound = run([{ type: "ready", at: 0 }, { type: "canplay", at: 800 }, { type: "playing", at: 900 }, ...ticks(1000, 3000)]);
    check("sound succeeds: no overlay", sound.state.phase === "playing" && !everFellBack(sound.trace) && sound.effects.join() === "play-unmuted#1");

    const muted = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      unmutedRej(850, 1),
      { type: "playing", at: 1000 },
      ...ticks(1000, 3000),
    ]);
    check("sound rejected, muted succeeds: sound then muted, same attempt", muted.effects.join() === "play-unmuted#1,play-muted#1");
    check("sound rejected, muted succeeds: no overlay at any point", muted.state.phase === "playing" && !everFellBack(muted.trace));

    const both = run([{ type: "ready", at: 0 }, { type: "canplay", at: 800 }, unmutedRej(850, 1), mutedRej(900, 1)]);
    check("both rejected: overlay, reason autoplay-blocked", both.state.phase === "fallback" && both.state.failure === "autoplay-blocked");

    const late = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      unmutedRej(850, 1),
      mutedRej(900, 1),
      { type: "playing", at: 12000 },
    ]);
    check("late successful playback clears the overlay", late.state.phase === "playing" && late.state.failure === null);
  }

  // 5. A real error, and the rejections that accompany it.
  {
    const r = run([{ type: "ready", at: 0 }, { type: "progress", at: 100 }, { type: "error", at: 300 }]);
    check("error: overlay immediately, reason error", r.state.phase === "fallback" && r.state.failure === "error");

    // An error aborts the pending play(): its rejection must neither start a
    // pointless muted attempt nor overwrite the more useful reason.
    const withRejection = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      { type: "error", at: 900 },
      unmutedRej(950, 1),
      mutedRej(960, 1),
    ]);
    check("error then the aborted play() rejection: reason stays error", withRejection.state.failure === "error");
    check("error then the aborted play() rejection: no muted retry on a dead element", withRejection.effects.join() === "play-unmuted#1");

    const recovered = run([{ type: "ready", at: 0 }, { type: "error", at: 500 }, { type: "playing", at: 900 }]);
    check("playing after a video error clears the overlay", recovered.state.phase === "playing" && recovered.state.failure === null);
  }

  // 6. Stale results from an older attempt can never act on a newer one.
  {
    // Attempt 1 is superseded by a Play tap (attempt 2). Attempt 1's rejection
    // (e.g. AbortError from v.load()) and its muted retry must be ignored.
    const r = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      { type: "tap-play", at: 2000 },
      unmutedRej(2100, 1),
      mutedRej(2150, 1),
    ]);
    check("stale rejections from a superseded attempt are ignored", r.state.phase === "starting" && r.effects.join() === "play-unmuted#1,play-unmuted#2");

    const concurrent = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      { type: "tap-play", at: 2000 },
      unmutedRej(2100, 1), // stale
      unmutedRej(2200, 2), // current -> muted attempt
      mutedRej(2250, 1), // stale
    ]);
    check("two concurrent sound attempts rejecting do not raise the overlay early", concurrent.state.phase === "starting" && concurrent.effects.join() === "play-unmuted#1,play-unmuted#2,play-muted#2");
    const finished = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      { type: "tap-play", at: 2000 },
      unmutedRej(2100, 1),
      unmutedRej(2200, 2),
      mutedRej(2300, 2),
    ]);
    check("only the current attempt's muted rejection raises the overlay", finished.state.phase === "fallback" && finished.state.failure === "autoplay-blocked");

    // A result that arrives after playback started cannot undo it.
    const afterPlaying = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 800 },
      { type: "playing", at: 900 },
      unmutedRej(950, 1),
      mutedRej(960, 1),
      { type: "error", at: 970 },
    ]);
    check("rejections/errors after playing never undo playback", afterPlaying.state.phase === "playing" && !everFellBack(afterPlaying.trace));
  }

  // 7. Silence and the absolute ceiling always reach an escape.
  {
    const silent = run([{ type: "ready", at: 0 }, ...ticks(1000, IDLE + 3000)]);
    check("no events at all: overlay at exactly the idle threshold", firstFallbackAt(silent.trace) === IDLE && silent.state.failure === "stalled");

    const events = [{ type: "ready", at: 0 }];
    for (let t = 1000; t <= MAX + 10000; t += 2000) events.push({ type: "progress", at: t });
    const trickle = run([...events, ...ticks(1000, MAX + 10000)]);
    check("trickling progress and never playable: ceiling reached", trickle.state.phase === "fallback" && trickle.state.failure === "timeout");
    check("the ceiling is exactly MAX_WAIT_MS, not earlier", firstFallbackAt(trickle.trace) === MAX);

    const unplayable = [{ type: "ready", at: 0 }, { type: "canplay", at: 1000 }];
    for (let t = 2000; t <= MAX + 5000; t += 1000) unplayable.push({ type: "progress", at: t });
    const stuckPlay = run([...unplayable, ...ticks(1000, MAX + 5000)]);
    check("canplay but play() never resolves, progress keeps coming: ceiling still escapes", stuckPlay.state.failure === "timeout" && firstFallbackAt(stuckPlay.trace) === MAX);
  }

  // 8. Playback that starts and then freezes still reaches Continue.
  {
    const play = [];
    for (let t = 1000; t <= 3000; t += 250) play.push({ type: "progress", at: t });
    const r = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 500 },
      { type: "playing", at: 900 },
      ...play,
      ...ticks(1000, 3000 + IDLE + 2000),
    ]);
    check("frozen mid-playback: still playing until the idle threshold", r.trace.filter((s) => s.at < 3000 + IDLE).every((s) => s.phase !== "fallback"));
    check("frozen mid-playback: overlay once timeupdate has been silent for the threshold", firstFallbackAt(r.trace) === 3000 + IDLE && r.state.failure === "stalled");

    const resumed = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 500 },
      { type: "playing", at: 900 },
      ...ticks(1000, 3000 + IDLE + 1000),
      { type: "playing", at: 3000 + IDLE + 1500 },
    ]);
    check("playback resuming after the overlay clears it", resumed.state.phase === "playing" && resumed.state.failure === null);

    const tapped = run([
      { type: "ready", at: 0 },
      { type: "canplay", at: 500 },
      { type: "playing", at: 900 },
      ...ticks(1000, 900 + IDLE + 1000),
      { type: "tap-play", at: 900 + IDLE + 1500 },
    ]);
    check("Play on a mid-playback freeze starts a fresh attempt", tapped.state.phase === "starting" && tapped.effects.join() === "play-unmuted#1,play-unmuted#2");
  }

  // 9. A suspended / starved page does not read as a silent video.
  {
    const r = run([
      { type: "ready", at: 0 },
      { type: "progress", at: 2000 },
      ...ticks(1000, 2000),
      { type: "tick", at: 2000 + IDLE + 2000 }, // page was suspended; first tick back
      { type: "tick", at: 2000 + IDLE + 3000 },
    ]);
    check("a tick after a long suspension forgives the gap instead of flagging silence", r.trace.filter((s) => s.at < MAX).every((s) => s.phase !== "fallback"));
    const stillDead = run([
      { type: "ready", at: 0 },
      { type: "progress", at: 2000 },
      ...ticks(1000, 2000),
      { type: "tick", at: 2000 + IDLE + 2000 },
      ...ticks(2000 + IDLE + 3000, MAX + 3000),
    ]);
    check("a video that is dead after the suspension still escapes (ceiling)", stillDead.state.phase === "fallback");
  }

  // 10. Play tap: fresh attempt, clocks restarted.
  {
    const tapAt = IDLE + 500;
    const r = run([
      { type: "ready", at: 0 },
      ...ticks(1000, IDLE),
      { type: "tap-play", at: tapAt },
      { type: "tick", at: tapAt + 500 },
    ]);
    check("tap-play requests a sound-first attempt", r.effects.join() === "play-unmuted#1");
    check("tap-play clears the overlay and the stale clock does not re-flag it", r.state.phase === "starting" && r.state.failure === null);

    const again = run([
      { type: "ready", at: 0 },
      ...ticks(1000, IDLE),
      { type: "tap-play", at: tapAt },
      ...ticks(tapAt + 1000, tapAt + IDLE + 2000),
    ]);
    const afterTap = again.trace.filter((s) => s.at > tapAt);
    check("after a tap the overlay is not back before a full idle period has passed", afterTap.filter((s) => s.at < tapAt + IDLE).every((s) => s.phase !== "fallback"));
    check("after a tap the idle clock restarts exactly from the tap", firstFallbackAt(afterTap) === tapAt + IDLE);

    const chain = run([
      { type: "ready", at: 0 },
      ...ticks(1000, IDLE),
      { type: "tap-play", at: tapAt },
      unmutedRej(tapAt + 100, 1),
      mutedRej(tapAt + 200, 1),
    ]);
    check("tap-play, sound rejected, muted rejected: back to the overlay", chain.state.phase === "fallback" && chain.state.failure === "autoplay-blocked" && chain.effects.join() === "play-unmuted#1,play-muted#1");
  }

  // 11. Once settled (Continue / ended) nothing changes.
  {
    const r = run([{ type: "ready", at: 0 }, { type: "settled", at: 100 }, { type: "error", at: 200 }, unmutedRej(250, 1), ...ticks(1000, 60000)]);
    check("after Continue (settled), nothing changes the state", r.state.phase === "settled" && r.effects.length === 0);
  }

  // Page wiring that a pure test cannot see.
  const page = fs.readFileSync(path.join(process.cwd(), "app", "login-welcome", "page.tsx"), "utf8");
  check("page no longer uses a fixed STALL_MS deadline", !page.includes("STALL_MS"));
  check("video has a transparent poster so Android WebView's default play-circle is never drawn", /<video[\s\S]{0,700}poster="data:image\/gif;base64,/.test(page));
  check("page drives the shared state machine", page.includes("reduceWelcome") && page.includes("@/lib/loginWelcomeMachine"));
  check("page echoes the attempt id on both rejection events", (page.match(/attempt: effect\.attempt/g) || []).length === 2);
  check("page forwards timeupdate as progress (playback liveness)", /onTimeUpdate=\{handleProgress\}/.test(page));
  check("playing still records the session guard", /handlePlaying[\s\S]{0,200}rememberStarted\(\)/.test(page));

  // Continue is unchanged: same destination source, same session guard.
  check("Continue button still calls finish", /onClick=\{finish\}[\s\S]{0,120}Continue/.test(page));
  check("finish navigates to the postAuthDestination-derived href", /router\.replace\(nextHrefRef\.current\)/.test(page) && page.includes("postAuthDestination(resolution)"));
  check("finish still marks the session guard", /function finish\(\)[\s\S]{0,260}markLoginWelcomeShownThisSession\(\)/.test(page));
  check("the page only navigates from finish() or auth redirects", (page.match(/router\.(replace|push)\(/g) || []).length === 3);
  check("Play starts via the tap path and is not blocked after playback began", /function playFromTap\(\)[\s\S]{0,300}tap-play/.test(page) && !/function playFromTap\(\)[\s\S]{0,300}if \([^)]*startedRef\.current/.test(page));
}

console.log(`\n=== LOGIN WELCOME: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error(failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
