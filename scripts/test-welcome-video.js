/**
 * Regression test: the welcome introduction (/welcome, the first-run History of Chess video) starts with sound when the browser allows it, falls
 * back to muted autoplay when it does not, never un-mutes by itself, and shows "Skip Intro" only after 20 seconds of REAL playback.
 *   node scripts/test-welcome-video.js
 *
 * Static / unit: no database, no browser, no network. It loads the REAL helpers (transpiled) and reads the page as text.
 *   A. lib/video/autoplayWithAudio.ts: unmuted attempt first, muted retry, blocked, legacy WebViews, aborts
 *   B. lib/video/playbackClock.ts: the 20-second clock under pause, seeks, buffering, replay, throttled updates, completion
 *   C. app/welcome/page.tsx: wired to both, Skip not rendered before the threshold, no wall-clock timers, nothing auto-unmutes, and the
 *      existing behaviour (Continue fallback, outro navigation, experience skip rule, controls, layout) is intact
 *
 * What a unit test cannot prove: whether a given browser / WebView ALLOWS unmuted autoplay. That is the browser's policy; the code asks, reacts to
 * the answer, and never claims otherwise. The real-browser behaviour (allowed, blocked-then-muted, fully blocked, real 20-second timing) is checked
 * by the browser verification described in the change report.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok   " + n); } else { fails.push(n); console.log("  FAIL " + n + (d !== undefined ? " -- " + d : "")); } };

const ts = require(path.join(ROOT, "node_modules", "typescript"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "welcome-video-"));
const load = (src) => {
  const out = path.join(tmp, path.basename(src).replace(/\.ts$/, ".js"));
  fs.writeFileSync(out, ts.transpileModule(read(src), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
  return require(out);
};
const { startWithAudioFirst } = load("lib/video/autoplayWithAudio.ts");
const C = load("lib/video/playbackClock.ts");

(async () => {
  console.log("== A. audio first, muted fallback");
  const err = (name) => Object.assign(new Error(name), { name });
  // a fake <video>: records the muted flag at every play() call; behaviour per call is scripted
  const fake = (script) => { const v = { muted: undefined, calls: [], play() { const call = { muted: v.muted }; v.calls.push(call); const step = script[Math.min(v.calls.length - 1, script.length - 1)]; if (step === "undefined") return undefined; if (step === "throw") throw err("NotAllowedError"); return step === "ok" ? Promise.resolve() : Promise.reject(err(step)); } }; return v; };

  let v = fake(["ok"]);
  check("allowed: it asks for UNMUTED autoplay first, once, and reports 'unmuted'", (await startWithAudioFirst(v)) === "unmuted" && v.calls.length === 1 && v.calls[0].muted === false && v.muted === false);
  v = fake(["NotAllowedError", "ok"]);
  const o2 = await startWithAudioFirst(v);
  check("blocked unmuted autoplay: it retries MUTED autoplay so the video still plays, and reports 'muted'", o2 === "muted" && v.calls.length === 2 && v.calls[0].muted === false && v.calls[1].muted === true && v.muted === true, JSON.stringify(v.calls));
  check("the fallback never starts muted first: the unmuted attempt always comes first", v.calls[0].muted === false);
  v = fake(["NotAllowedError", "NotAllowedError"]);
  const o3 = await startWithAudioFirst(v);
  check("everything blocked: graceful 'blocked' (no throw), exactly two attempts, and the element is left UNMUTED so a tap on Play starts with sound", o3 === "blocked" && v.calls.length === 2 && v.muted === false);
  v = fake(["undefined"]);
  check("an old WebView whose play() returns no promise is treated as started (no crash, one attempt)", (await startWithAudioFirst(v)) === "unmuted" && v.calls.length === 1);
  v = fake(["throw", "ok"]);
  check("a play() that throws synchronously also falls back to muted", (await startWithAudioFirst(v)) === "muted" && v.calls.length === 2 && v.muted === true);
  v = fake(["AbortError"]);
  const o6 = await startWithAudioFirst(v);
  check("an interrupted start (AbortError: element paused or removed) is not mistaken for a block: no muted retry, no state change", o6 === "interrupted" && v.calls.length === 1 && v.muted === false);
  v = fake(["NotAllowedError", "AbortError"]);
  check("an abort during the muted retry is reported as interrupted, not as blocked", (await startWithAudioFirst(v)) === "interrupted");
  v = fake(["NotSupportedError", "ok"]);
  check("an older WebView that rejects with a different error name still gets the muted retry", (await startWithAudioFirst(v)) === "muted");
  const helperSrc = read("lib/video/autoplayWithAudio.ts");
  check("the helper contains no timer and never un-mutes after a successful muted start", !/setTimeout|setInterval/.test(helperSrc) && (helperSrc.match(/muted = false/g) || []).length === 2);

  console.log("\n== B. the 20-second playback clock");
  // feed (currentTime, paused, seeking) updates the way a browser would; returns the clock
  const run = (steps) => { const c = C.createPlaybackClock(); for (const s of steps) { if (s.resync !== undefined) C.resync(c, s.resync); else C.tick(c, s.t, { paused: !!s.paused, seeking: !!s.seeking }); } return c; };
  const playing = (from, to, hz = 4) => { const out = []; const dt = 1 / hz; for (let t = from + dt; t <= to + 1e-9; t += dt) out.push({ t: +t.toFixed(4) }); return out; };

  check("the threshold is 20 seconds", C.SKIP_AFTER_SECONDS === 20);
  let c = run([{ resync: 0 }, ...playing(0, 19.75)]);
  check("19.75 s of playback: Skip is still hidden", !C.reached(c) && Math.abs(c.watched - 19.75) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 20)]);
  check("20 s of playback: Skip is shown (the threshold is inclusive)", C.reached(c) && Math.abs(c.watched - 20) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 25, 1)]);
  check("throttled updates (1 per second, e.g. a background tab) still reach 20 s at 20 s of real playback", C.reached(c) && run([{ resync: 0 }, ...playing(0, 19, 1)]).watched === 19);

  c = run([{ resync: 0 }, ...playing(0, 5), ...Array.from({ length: 240 }, () => ({ t: 5, paused: true }))]);
  check("PAUSED: sixty seconds of paused 'updates' add nothing (still 5 s)", Math.abs(c.watched - 5) < 1e-6 && !C.reached(c), c.watched);
  c = run([{ resync: 0 }, ...playing(0, 5), ...Array.from({ length: 240 }, () => ({ t: 5, paused: true })), { resync: 5 }, ...playing(5, 19.75)]);
  check("after resuming, the countdown continues from where it stopped: 19.75 s total is still hidden", !C.reached(c) && Math.abs(c.watched - 19.75) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 5), { resync: 5 }, ...playing(5, 20)]);
  check("...and the button appears exactly when the 20th second of PLAYBACK is reached", C.reached(c));

  c = run([{ resync: 0 }, ...playing(0, 5), { t: 5.2, paused: true }, { t: 6.2, paused: true }, { t: 7.2, paused: true }]);
  check("PAUSED updates whose time has moved (a frame-step, or a late event right after Pause) are not counted: still 5 s", Math.abs(c.watched - 5) < 1e-6 && !C.reached(c), c.watched);
  c = run([{ resync: 0 }, ...playing(0, 3), { t: 60, seeking: true }, { resync: 60 }, ...playing(60, 62)]);
  check("a forward SEEK from 3 s to 60 s does not count: 5 s watched, hidden", !C.reached(c) && Math.abs(c.watched - 5) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 3), { t: 80 }]);
  check("a forward jump that arrives WITHOUT seek events (larger than the max step) is still not counted", Math.abs(c.watched - 3) < 1e-6 && !C.reached(c), c.watched);
  let steps = [{ resync: 0 }, ...playing(0, 2)]; let at = 2;
  for (let i = 0; i < 8; i++) { steps.push({ t: at + 10, seeking: true }, { resync: at + 10 }); at += 10; steps.push(...playing(at, at + 0.5)); at += 0.5; }
  c = run(steps);
  check("eight forward seeks of +10 s, each followed by half a second of playback, earn only the 6 s really played: hidden", !C.reached(c) && Math.abs(c.watched - 6) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 3), { t: 84.8, seeking: true }, { resync: 84.8 }]);
  check("seeking straight to the end earns nothing (completion alone never shows Skip: the outro takes over)", !C.reached(c));

  c = run([{ resync: 0 }, ...playing(0, 4), ...Array.from({ length: 60 }, () => ({ t: 4 })), { resync: 4 }, ...playing(4, 18)]);
  check("BUFFERING (the picture stands still for 15 s): the stall earns nothing, 18 s of real playback is hidden", !C.reached(c) && Math.abs(c.watched - 18) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 6), { resync: 6 }, { t: 6, paused: false }, ...playing(6, 21)]);
  check("a stall followed by playback to 21 s: 21 s watched, shown", C.reached(c));

  c = run([{ resync: 0 }, ...playing(0, 10), { t: 0, seeking: true }, { resync: 0 }, ...playing(0, 9.75)]);
  check("REPLAY / seek back to the start: the backward move counts nothing, replayed playback counts as playback (19.75 s so far: hidden)", !C.reached(c) && Math.abs(c.watched - 19.75) < 1e-6, c.watched);
  c = run([{ resync: 0 }, ...playing(0, 10), { t: 0 }, { resync: 0 }, ...playing(0, 10)]);
  check("...and 10 s + 10 s of replay is 20 s of playback: shown", C.reached(c));

  c = run([{ resync: 0 }, { t: 3.4 }]);
  check("a main-thread stall that delays an update by more than the max step is not counted (conservative: never early)", c.watched === 0);
  c = run([{ resync: 0 }, { t: 3 }]);
  check("a step of exactly the max step (3 s) still counts", c.watched === 3);
  c = run([{ resync: 0 }, ...playing(0, 20), { t: 0, seeking: true }, { resync: 0 }, ...playing(0, 3)]);
  check("once reached it can never become unreached: the total only goes up", C.reached(c) && c.watched >= 20);
  check("an update before any baseline exists counts nothing (first update after load)", run([{ t: 7 }]).watched === 0);

  console.log("\n== C. the welcome page");
  const page = read("app/welcome/page.tsx");
  const src = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  // the whole element, up to </video>: its attributes contain arrow functions, so stopping at the first ">" would cut it short
  const videoTag = (/<video[\s\S]*?<\/video>/.exec(src) || [""])[0];
  check("(sanity) the whole <video> element was extracted, handlers included, so the element-level checks below are not vacuous", videoTag.length > 400 && /onTimeUpdate=\{handleTimeUpdate\}/.test(videoTag) && /onError=/.test(videoTag) && /<\/video>$/.test(videoTag));
  check("it imports and uses both helpers", /from "@\/lib\/video\/autoplayWithAudio"/.test(src) && /from "@\/lib\/video\/playbackClock"/.test(src) && /startWithAudioFirst\(v\)/.test(src) && /tick\(clockRef\.current/.test(src) && /reached\(clockRef\.current\)/.test(src));
  check("Skip Intro is NOT rendered until the clock says so (and is only ever switched on, never off)", /useState\(false\)/.test(src) && /\{skipVisible && \(\s*<motion\.button/.test(src) && (src.match(/setSkipVisible\(true\)/g) || []).length === 1 && !/setSkipVisible\(false\)/.test(src));
  check("the unlock is driven by video playback, not by any timer or wall clock", !/setTimeout|setInterval|Date\.now|performance\.now|requestAnimationFrame/.test(src));
  check("the clock hears every event that matters: timeupdate, play, playing, pause, seeking, seeked, waiting, ended", ["onTimeUpdate={handleTimeUpdate}", "onSeeking={handleResync}", "onSeeked={handleResync}", "onWaiting={handleResync}", "onPause=", "onPlay=", "onPlaying=", "onEnded={handleVideoEnded}"].every((s) => src.includes(s)));
  check("the sound-first attempt runs once per video (guarded), because canplay fires again after every rebuffer", /if \(!v \|\| autoplayTriedRef\.current\) return;\s*autoplayTriedRef\.current = true;/.test(src) && (src.match(/startWithAudioFirst\(/g) || []).length === 1);
  check("nothing in the page ever starts the video muted or un-mutes it by itself", !/\.muted\s*=\s*(false|true)/.test(src) && !/\bmuted\b/.test(videoTag) && !/autoPlay/i.test(videoTag) && /v\.muted = !v\.muted/.test(src));
  check("the only other play() call is the viewer's own tap on Play", (src.match(/\.play\(/g) || []).length === 1 && /function togglePlay\(\)[\s\S]*?v\.play\(\)/.test(src));
  check("when nothing can start, the first frame / poster is shown (not a blank box) and Play remains", /outcome === "blocked"\) setVideoVisible\(true\)/.test(src) && /poster=\{content\.posterUrl \?\? undefined\}/.test(src));
  const btn = (/<motion\.button[\s\S]*?<\/motion\.button>/.exec(src) || [""])[0];
  check("the Skip button is readable and easy to tap: 44px tall, 14px text, full-contrast ivory on a dark pill, labelled, a real button", /min-h-\[44px\]/.test(btn) && /text-sm/.test(btn) && /text-premium-ivory(?!\/)/.test(btn) && /bg-black\/70/.test(btn) && /aria-label="Skip intro"/.test(btn) && /type="button"/.test(btn) && /Skip Intro/.test(btn) && /focus-visible:ring/.test(btn));
  check("it keeps its place (top right, clear of the notch) and the fullscreen control stays on the other side", /right-3 top-\[max\(0\.75rem,env\(safe-area-inset-top,0px\)\)\]/.test(btn) && /left-3 top-\[max\(0\.75rem,env\(safe-area-inset-top,0px\)\)\]/.test(src));

  console.log("\n== D. what must not change");
  check("the existing video, layout and controls are intact (same source, 16:9 frame, no native controls, inline playback)", /src=\{content\.videoUrl!\}/.test(src) && /aspect-video/.test(src) && /controls=\{false\}/.test(videoTag) && /playsInline/.test(videoTag) && /object-cover/.test(videoTag));
  check("if the video cannot load, Continue is still offered at once (nobody is ever stuck)", /videoUnavailable && \(\s*<Button tone="premium" onClick=\{handleSkip\}>\s*Continue →/.test(src) && /onError=\{\(\) => setVideoUnavailable\(true\)\}/.test(src));
  check("completion navigation is unchanged: ended -> mark seen -> outro -> Enter -> /home; Skip does the same", /function handleVideoEnded\(\) \{\s*setPlaying\(false\);\s*markSeen\(\);\s*setStage\("outro"\);/.test(src) && /function handleSkip\(\) \{\s*markSeen\(\);\s*setStage\("outro"\);/.test(src) && /router\.push\("\/home"\)/.test(src));
  check("the onboarding rules are unchanged: experienced players skip the intro, and it never shows twice", /shouldSkipWelcome\(child\.experience_level\)/.test(src) && /getAcademyProgress\(supabase, child\.id, content\.id\)/.test(src) && /router\.replace\("\/home"\)/.test(src));
  check("progress saving during playback is unchanged (every 5th second)", /t > 0 && t % 5 === 0/.test(src) && /saveAcademyVideoProgress\(createClient\(\), childId, content\.id, t\)/.test(src));
  check("no other video player was touched: the lesson player, brand opening, login welcome and world cinematic do not use the new helpers", ["components/academy/HistoryVideo.tsx", "app/onboarding/opening/page.tsx", "app/login-welcome/page.tsx", "components/world/LocationCinematic.tsx"].every((f) => !/lib\/video/.test(read(f))));

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  console.log(`\n=== WELCOME VIDEO (audio + Skip timing): ${pass} passed, ${fails.length} failed ===`);
  fails.forEach((f) => console.log(" - " + f));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log("HARNESS ERROR", e.message); process.exit(2); });
