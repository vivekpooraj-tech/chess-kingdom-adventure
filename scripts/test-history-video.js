/**
 * Regression test: the History of Chess lesson player (components/academy/HistoryVideo.tsx, shown at /academy/origins) must
 *   - ask for sound first, and fall back to MUTED autoplay when the browser refuses;
 *   - NEVER un-mute (or re-mute) by itself, not after the fallback and not after a seek / rebuffer (a muted autoplay that is un-muted without a
 *     user gesture is paused by the browser: that was the "video not playing" bug);
 *   - leave sound to the viewer (the native control bar, which a viewer's tap is allowed to use);
 *   - never leave a blank black box when the browser blocks every autoplay: the poster and the native controls (Play) must show.
 *   node scripts/test-history-video.js
 *
 * No database, no browser, no network. It runs the REAL component code: HistoryVideo.tsx is transpiled and executed against a tiny fake React (hooks +
 * a re-render) and a fake <video> that applies Chrome's rules (an unmuted play() without a gesture is rejected when the policy says so; un-muting a
 * muted autoplay without a gesture pauses it). The real helper lib/video/autoplayWithAudio.ts is used as is.
 *
 * What it cannot prove: whether a given browser ALLOWS sound autoplay. That is the browser's policy; the real-Chrome verification is in the change report.
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
const transpile = (src) => ts.transpileModule(read(src), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
function load(src, mocks) {
  const m = { exports: {} };
  const req = (id) => (id in mocks ? mocks[id] : require(path.join(ROOT, "node_modules", id)));
  new Function("exports", "require", "module", transpile(src))(m.exports, req, m);
  return m.exports;
}

// ---- a minimal React: hooks by call order, state kept across renders, a plain-object element tree --------------------------------------------------
let hooksNow = null;
const fakeReact = {
  useState: (...a) => hooksNow.useState(...a),
  useRef: (...a) => hooksNow.useRef(...a),
  useCallback: (...a) => hooksNow.useCallback(...a),
  useEffect: (...a) => hooksNow.useEffect(...a),
};
const el = (type, props) => ({ type, props });
const jsxRuntime = { jsx: el, jsxs: el, Fragment: "Fragment" };
function mount(Component, props) {
  const slots = [];
  let i = 0;
  const hooks = {
    useState: (init) => { const k = i++; if (!(k in slots)) slots[k] = typeof init === "function" ? init() : init; return [slots[k], (v) => { slots[k] = typeof v === "function" ? v(slots[k]) : v; }]; },
    useRef: (init) => { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useCallback: (fn) => { i++; return fn; }, // the latest closure each render: the component's handlers only read refs and call setters
    useEffect: () => { i++; },
  };
  return () => { i = 0; hooksNow = hooks; return Component(props); };
}
const walk = (n, f) => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) { n.forEach((x) => walk(x, f)); return; } if (n.type) f(n); walk(n.props && n.props.children, f); };

// ---- a fake <video> with Chrome's autoplay rules ---------------------------------------------------------------------------------------------------
//   policy "allow":        sound autoplay is permitted (e.g. the page was reached by tapping a link)
//   policy "blockUnmuted": an unmuted play() without a user gesture is rejected (Chrome's default on a direct load / reload / new tab)
//   policy "blockAll":     every programmatic play() is rejected (Low-Power mode, Data Saver, some WebViews)
function fakeVideo(policy) {
  const v = {
    _muted: false, paused: true, currentTime: 0, gesture: false, plays: [], mutedWrites: [], pauses: 0,
    get muted() { return this._muted; },
    set muted(x) { // a JS write to .muted (what the page code does)
      this.mutedWrites.push(x);
      const was = this._muted; this._muted = x;
      // Chrome: un-muting a muted autoplay WITHOUT a user gesture pauses it
      if (was && !x && !this.paused && !this.gesture && policy !== "allow") { this.paused = true; this.pauses++; }
    },
    play() {
      this.plays.push({ muted: this._muted, gesture: this.gesture });
      const blocked = policy === "blockAll" ? !this.gesture : policy === "blockUnmuted" && !this._muted && !this.gesture;
      if (blocked) return Promise.reject(Object.assign(new Error("NotAllowedError"), { name: "NotAllowedError" }));
      this.paused = false;
      return Promise.resolve();
    },
    // the VIEWER, through the native control bar: a real user gesture, and not a JS write to .muted
    tapUnmute() { this._muted = false; },
    tapMute() { this._muted = true; },
    tapPlay() { this.gesture = true; const r = this.play(); this.gesture = false; return r; },
  };
  return v;
}
const settle = () => new Promise((r) => setImmediate(r));

(async () => {
  let unhandled = 0;
  process.on("unhandledRejection", () => { unhandled++; });

  const helper = load("lib/video/autoplayWithAudio.ts", {});
  const { HistoryVideo } = load("components/academy/HistoryVideo.tsx", {
    react: fakeReact,
    "react/jsx-runtime": jsxRuntime,
    "@/components/nav/icons": { FullscreenIcon: () => null, ExitFullscreenIcon: () => null },
    "@/lib/video/autoplayWithAudio": helper,
  });

  function session(policy) {
    const progress = [];
    const render = mount(HistoryVideo, { src: "https://example.test/hero.mp4", poster: "https://example.test/poster.jpg", orientation: "portrait", captionsUrl: null, onProgress: (t) => progress.push(t) });
    const node = (type) => { let found; walk(render(), (n) => { if (n.type === type) found = n; }); return found; };
    const video = fakeVideo(policy);
    node("video").props.ref.current = video;
    const fire = async (name, ...a) => { const h = node("video").props["on" + name]; if (h) h(...a); await settle(); };
    const ui = () => { const p = node("video").props; return { controls: p.controls, visible: /opacity-100 visible/.test(p.className), poster: p.poster }; };
    const text = () => JSON.stringify(render());
    // what the browser does after a play() that succeeded: it dispatches `play` and `playing`
    const browserStarted = async () => { if (!video.paused) { await fire("Play"); await fire("Playing"); } };
    return { video, fire, ui, text, progress, browserStarted };
  }

  console.log("== A. sound allowed");
  let s = session("allow");
  await s.fire("CanPlay"); await s.browserStarted();
  check("it asks for UNMUTED autoplay first, once", s.video.plays.length === 1 && s.video.plays[0].muted === false);
  check("allowed: it is playing WITH sound, and the player and its native control bar are shown", !s.video.paused && s.video.muted === false && s.ui().controls === true && s.ui().visible);
  await s.fire("CanPlay"); await s.fire("CanPlay");
  check("a rebuffer / seek fires canplay again: no second attempt, no change to the sound", s.video.plays.length === 1 && !s.video.paused && s.video.muted === false);

  console.log("\n== B. the browser refuses sound autoplay: muted fallback, and it STAYS muted");
  s = session("blockUnmuted");
  await s.fire("CanPlay"); await s.browserStarted();
  check("rejected unmuted autoplay: it retried MUTED, in that order (unmuted first, then muted)", s.video.plays.length === 2 && s.video.plays[0].muted === false && s.video.plays[1].muted === true, JSON.stringify(s.video.plays));
  check("the video is PLAYING (muted) after the `play` and `playing` events: the browser did not pause it", !s.video.paused && s.video.pauses === 0 && s.video.muted === true);
  check("the page never wrote muted=false after the fallback (its only writes: false before the first try, true for the fallback)", JSON.stringify(s.video.mutedWrites) === "[false,true]", JSON.stringify(s.video.mutedWrites));
  check("the player and its native control bar are shown, so the viewer can turn the sound on", s.ui().controls === true && s.ui().visible);

  console.log("\n== C. rebuffering / seeking while muted");
  for (let k = 0; k < 3; k++) { await s.fire("CanPlay"); await s.fire("Playing"); }
  check("three rebuffers (canplay + playing again): no new play() call, no new write to .muted", s.video.plays.length === 2 && JSON.stringify(s.video.mutedWrites) === "[false,true]");
  check("...and it is still playing, still muted, never paused by the browser", !s.video.paused && s.video.pauses === 0 && s.video.muted === true);

  console.log("\n== D. manual sound");
  s.video.tapUnmute();
  check("the viewer turns the sound on with the native control: it keeps playing (a gesture is allowed to do that)", !s.video.paused && s.video.muted === false && s.video.pauses === 0);
  await s.fire("CanPlay"); await s.fire("Play"); await s.fire("Playing");
  s.video.currentTime = 31; await s.fire("TimeUpdate");
  check("after a rebuffer the page leaves the viewer's choice alone: still unmuted, still playing, still no write to .muted", s.video.muted === false && !s.video.paused && s.video.plays.length === 2 && JSON.stringify(s.video.mutedWrites) === "[false,true]");
  s.video.tapMute(); await s.fire("CanPlay"); await s.fire("Playing");
  check("a viewer who mutes it again is not un-muted behind their back by the next rebuffer", s.video.muted === true && !s.video.paused && JSON.stringify(s.video.mutedWrites) === "[false,true]");

  console.log("\n== E. the browser blocks every autoplay");
  const before = unhandled;
  s = session("blockAll");
  await s.fire("CanPlay");
  check("two attempts (sound, then muted), both refused, and no unhandled rejection", s.video.plays.length === 2 && s.video.plays[0].muted === false && s.video.plays[1].muted === true && unhandled === before, `plays=${s.video.plays.length} unhandled=${unhandled - before}`);
  check("no blank black box: the poster and the native controls (Play) are shown", s.ui().controls === true && s.ui().visible && s.ui().poster === "https://example.test/poster.jpg", JSON.stringify(s.ui()));
  check("the element is left UNMUTED, so the viewer's tap on Play starts it with sound", s.video.muted === false);
  await s.video.tapPlay(); await s.browserStarted();
  check("the viewer taps Play: it plays, with sound, and stays that way", !s.video.paused && s.video.muted === false && s.video.plays[2].muted === false && s.video.plays[2].gesture === true && s.video.pauses === 0);
  await s.fire("CanPlay"); await s.fire("Playing");
  check("...even after a rebuffer", !s.video.paused && s.video.muted === false && s.video.plays.length === 3);

  console.log("\n== F. everything else the player did is intact");
  s = session("allow");
  await s.fire("CanPlay"); await s.browserStarted();
  s.video.currentTime = 12.3; await s.fire("TimeUpdate");
  check("progress is still reported to the page on every timeupdate (the page's own 5-second saves are driven by it)", s.progress.length === 1 && s.progress[0] === 12.3, JSON.stringify(s.progress));
  s.video.currentTime = 40; await s.fire("LoadedMetadata");
  check("every visit still starts at 0:00 (loadedmetadata resets a restored position)", s.video.currentTime === 0);
  const fresh = session("allow");
  check("before anything plays, the player is the dark box (no controls yet) as before", fresh.ui().controls === false && !fresh.ui().visible);
  await fresh.fire("Error");
  check("a video that fails to load still shows the friendly message with the timeline below", /couldn.t load right now/.test(fresh.text()));
  const videoNode = (() => { const r = mount(HistoryVideo, { src: "a.mp4", orientation: "portrait" }); let n; walk(r(), (x) => { if (x.type === "video") n = x; }); return n; })();
  check("the <video> has no `muted` or `autoPlay` attribute (sound-first is decided in code, not by markup), inline playback, preload=metadata, no native fullscreen", videoNode.props.muted === undefined && videoNode.props.autoPlay === undefined && videoNode.props.playsInline === true && videoNode.props.preload === "metadata" && /nofullscreen/.test(videoNode.props.controlsList));

  console.log("\n== G. the source");
  const raw = read("components/academy/HistoryVideo.tsx");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  check("the component never assigns .muted itself (only lib/video/autoplayWithAudio.ts does, once, in its fixed order)", !/\.muted\s*=[^=]/.test(code));
  check("the sound-first attempt is guarded to run once per video and happens through the shared helper", /import \{ startWithAudioFirst \} from "@\/lib\/video\/autoplayWithAudio"/.test(code) && /if \(!v \|\| autoplayTriedRef\.current\) return;\s*autoplayTriedRef\.current = true;/.test(code) && (code.match(/startWithAudioFirst\(/g) || []).length === 1);
  check("when nothing could start, the player and its controls are revealed (not left hidden)", /outcome === "blocked"\) setVideoVisible\(true\)/.test(code));
  check("the `play` handler only reveals the player", /const handlePlay = useCallback\(\(\) => \{\s*setVideoVisible\(true\);\s*\}, \[\]\);/.test(code));
  check("play() is only ever called by the helper (the component has no play() of its own)", !/\.play\(/.test(code));
  check("the native control bar (the viewer's way to turn sound on) is bound to the player being revealed", /controls=\{videoVisible\}/.test(code) && /poster=\{videoVisible \? poster : undefined\}/.test(code));
  check("fullscreen, captions and the failure message are untouched", /requestFullscreen/.test(code) && /webkitRequestFullscreen/.test(code) && /<track kind="captions"/.test(code) && /couldn&apos;t load right now/.test(code));

  console.log("\n== H. the lesson page and the other players are untouched");
  const page = read("app/academy/origins/page.tsx");
  check("the lesson page still renders the player with progress tracking, the timeline and the quiz", /<HistoryVideo/.test(page) && /onProgress=\{handleVideoProgress\}/.test(page) && /saveAcademyVideoProgress\(createClient\(\), childId, content\.id, t\)/.test(page) && /t % 5 === 0/.test(page) && /content\.timeline\.map/.test(page) && /ready for the quiz/.test(page) && /Start the Quiz/.test(page) && /completeAcademyContent/.test(page));
  check("the page still navigates back to Learn", /href="\/learn"/.test(page));
  const welcome = read("app/welcome/page.tsx");
  check("the /welcome player is its own code and does not use the lesson player", !/HistoryVideo/.test(welcome) && /startWithAudioFirst/.test(welcome));
  check("the brand opening, login welcome and world cinematic still do not use the helper", ["app/onboarding/opening/page.tsx", "app/login-welcome/page.tsx", "components/world/LocationCinematic.tsx"].every((f) => !/lib\/video/.test(read(f))));

  console.log(`\n=== HISTORY OF CHESS PLAYER (sound-first, muted fallback, no auto-unmute): ${pass} passed, ${fails.length} failed ===`);
  fails.forEach((f) => console.log(" - " + f));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log("HARNESS ERROR", e && e.stack || e); process.exit(2); });
