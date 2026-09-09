/**
 * Tests for lib/voice — narration script, preferences and voice selection.
 *
 *   node scripts/test-voice.js
 *
 * Imports the real modules. The pure layers (script.ts, preference.ts) are
 * the ones tested here; webSpeech.ts talks to a browser API that does not
 * exist in node, so what IS asserted about it is structural: that it cannot
 * speak on its own, and that it degrades instead of throwing.
 *
 * The properties that matter:
 *   1. Nothing autoplays. Narration begins on a press, never on arrival.
 *   2. Narration never becomes load-bearing — every word spoken is a word
 *      already on the screen, so a device that cannot speak loses nothing.
 *   3. What is spoken is sayable: no emoji read out as "crown", no markdown
 *      asterisks, no utterance long enough for an engine to truncate.
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

const S = require(path.join(process.cwd(), "lib", "voice", "script.ts"));
const P = require(path.join(process.cwd(), "lib", "voice", "preference.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. Text is made sayable ---------------------------------------------
{
  check("emoji are not spoken", !/[\u{1F300}-\u{1FAFF}]/u.test(S.sanitizeForSpeech("The queen 👑 is powerful")));
  check("the words around an emoji survive", /queen/.test(S.sanitizeForSpeech("The queen 👑 is powerful")));
  check("arrows are stripped", !/→/.test(S.sanitizeForSpeech("Continue →")));
  check("middle dots are stripped", !/·/.test(S.sanitizeForSpeech("Day 12 · The Knight")));
  check("markdown emphasis is stripped", S.sanitizeForSpeech("the **queen**") === "the queen");
  check("em dashes become a pause", S.sanitizeForSpeech("Yes — really") === "Yes, really");
  check("whitespace is collapsed", S.sanitizeForSpeech("a    b\n\nc") === "a b c");
  check("space before punctuation is closed up", S.sanitizeForSpeech("hello 👑 .") === "hello.");
  check("empty input is empty output", S.sanitizeForSpeech("") === "");
  check("null input does not throw", S.sanitizeForSpeech(null) === "");
  check("plain prose is left alone", S.sanitizeForSpeech("The rook moves in straight lines.") === "The rook moves in straight lines.");
}

// --- 2. Chunking ---------------------------------------------------------
{
  check("short text is one chunk", S.chunkForSpeech("Hello there.").length === 1);
  check("empty text is no chunks", S.chunkForSpeech("").length === 0);
  check("whitespace-only text is no chunks", S.chunkForSpeech("   ").length === 0);

  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i}.`).join(" ");
  const chunks = S.chunkForSpeech(long, 200);
  check("long text is split", chunks.length > 1);
  check("no chunk exceeds the limit", chunks.every((c) => c.length <= 200));
  check("no chunk is empty", chunks.every((c) => c.trim().length > 0));
  // The whole text must survive the split — a dropped sentence is a lesson
  // the learner never hears.
  const rejoinedWords = chunks.join(" ").split(/\s+/).length;
  check("nothing is lost in the split", rejoinedWords === S.sanitizeForSpeech(long).split(/\s+/).length);

  // A single over-long sentence is kept whole rather than cut mid-clause.
  const oneSentence = "a".repeat(400);
  check("an over-long sentence is not chopped mid-word", S.chunkForSpeech(oneSentence, 200)[0].length === 400);
}

// --- 3. The two registers say different, true things ---------------------
{
  const seg = { kind: "piece_intro", title: "Meet the Knight!", piece: "knight" };
  const child = S.narrate(seg, "child");
  const adult = S.narrate(seg, "adult");

  check("both registers produce narration", child.length > 0 && adult.length > 0);
  check("the registers differ", child !== adult);
  check("the child version says L shape", /L shape/i.test(child));
  check("the adult version is precise", /perpendicular/i.test(adult));
  check("neither reads out an emoji", !/[\u{1F300}-\u{1FAFF}]/u.test(child + adult));

  // Every piece the lessons use must have real narration, or a lesson goes
  // silent exactly where narration is most useful.
  for (const piece of ["pawn", "knight", "bishop", "rook", "queen", "king"]) {
    const text = S.narrate({ kind: "piece_intro", title: "x", piece }, "child");
    check(`${piece} has child narration`, text.length > 30);
    check(`${piece} narration names the piece`, new RegExp(piece, "i").test(text));
  }

  // An unknown piece must NOT be described — inventing movement rules is the
  // one thing narration can do that is worse than saying nothing.
  const unknown = S.narrate({ kind: "piece_intro", title: "x", piece: "dragon" }, "child");
  check("an unknown piece gets no invented movement", !/moves|squares|diagonal/i.test(unknown));
  check("an unknown piece still gets its title spoken", unknown.length > 0);
}

// --- 4. Lesson segments --------------------------------------------------
{
  const story = S.narrate(
    { kind: "story", title: "The Sleepy Pawn Village", storyBeat: "The village sleeps.", objective: "Move a pawn." },
    "child"
  );
  check("story narration includes the title", /Sleepy Pawn Village/.test(story));
  check("story narration includes the story", /village sleeps/i.test(story));
  check("story narration includes the goal", /Move a pawn/.test(story));

  const puzzle = S.narrate({ kind: "puzzle", prompt: "Find the fork." }, "child");
  check("puzzle narration includes the prompt", /Find the fork/.test(puzzle));

  const reward = S.narrate({ kind: "reward", dayNumber: 12, totalDays: 30, title: "Day X" }, "adult");
  check("reward narration states the real day", /12/.test(reward) && /30/.test(reward));

  // Junk day numbers must produce no narration rather than "day NaN of 30".
  check("NaN day yields no narration", S.narrate({ kind: "reward", dayNumber: NaN, totalDays: 30, title: "x" }, "child") === "");
  check("zero-length course yields no narration", S.narrate({ kind: "reward", dayNumber: 1, totalDays: 0, title: "x" }, "child") === "");
  check("no narration ever leaks NaN", !/NaN|undefined/.test(reward));

  check("an unknown segment kind is silent", S.narrate({ kind: "nope" }, "child") === "");
}

// --- 5. Voice selection --------------------------------------------------
{
  const voices = [
    { name: "Spanish", lang: "es-ES" },
    { name: "US English", lang: "en-US" },
    { name: "British", lang: "en-GB" },
    { name: "British Default", lang: "en-GB", default: true },
  ];
  check("an exact language match wins", S.pickVoice(voices, "en-GB").lang === "en-GB");
  check("the platform default wins among equals", S.pickVoice(voices, "en-GB").name === "British Default");
  check("a same-language voice is used when there is no exact match", S.pickVoice(voices, "en-AU").lang.startsWith("en"));
  check("never returns nothing when voices exist", S.pickVoice(voices, "zz-ZZ") !== null);
  check("no voices means no voice", S.pickVoice([], "en-GB") === null);
  check("undefined voices does not throw", S.pickVoice(undefined, "en-GB") === null);
  check("selection is deterministic", S.pickVoice(voices, "en-GB") === S.pickVoice(voices, "en-GB"));

  const child = S.voiceSettingsFor("child");
  const adult = S.voiceSettingsFor("adult");
  check("the child voice is slower", child.rate < adult.rate);
  check("rates stay in a listenable band", [child, adult].every((v) => v.rate >= 0.5 && v.rate <= 1.5));
  check("pitches stay in a listenable band", [child, adult].every((v) => v.pitch >= 0.5 && v.pitch <= 1.5));
}

// --- 6. Preferences ------------------------------------------------------
{
  check("narration is OFF by default", P.DEFAULT_PREFERENCES.narrationEnabled === false);
  check("fewer-words is OFF by default", P.DEFAULT_PREFERENCES.simpleMode === false);
  check("the register follows the learner by default", P.DEFAULT_PREFERENCES.register === "auto");

  // Anything at all in storage must produce valid preferences.
  for (const junk of [null, undefined, 0, "", "nonsense", [], { register: "wizard" }, { narrationEnabled: "yes" }]) {
    const p = P.normalizePreferences(junk);
    check(`junk normalises safely: ${JSON.stringify(junk)}`, typeof p.narrationEnabled === "boolean");
    check(`junk never turns narration on: ${JSON.stringify(junk)}`, p.narrationEnabled === false);
  }
  check("a string 'yes' does not enable narration", P.normalizePreferences({ narrationEnabled: "yes" }).narrationEnabled === false);
  check("an unknown register falls back to auto", P.normalizePreferences({ register: "wizard" }).register === "auto");

  check("malformed JSON yields defaults", P.parsePreferences("{oh no").narrationEnabled === false);
  check("null JSON yields defaults", P.parsePreferences(null).simpleMode === false);
  check(
    "a round trip preserves the settings",
    P.parsePreferences(P.serializePreferences({ narrationEnabled: true, simpleMode: true, register: "adult" }))
      .register === "adult"
  );

  // Register resolution.
  check("auto + adult tone narrates precisely", P.registerFor({ register: "auto" }, true) === "adult");
  check("auto + child tone narrates warmly", P.registerFor({ register: "auto" }, false) === "child");
  check("an explicit child choice beats an adult tone", P.registerFor({ register: "child" }, true) === "child");
  check("an explicit adult choice beats a child tone", P.registerFor({ register: "adult" }, false) === "adult");

  // Storage helpers must be safe on the server, where there is no window.
  check("reading preferences on the server yields defaults", P.readPreferences().narrationEnabled === false);
  let threw = false;
  try {
    P.writePreferences(P.DEFAULT_PREFERENCES);
  } catch {
    threw = true;
  }
  check("writing preferences on the server does not throw", threw === false);
}

// --- 7. Structural: nothing autoplays, nothing is required ---------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const hook = strip(read("lib/voice/useNarration.ts"));
  const provider = strip(read("lib/voice/webSpeech.ts"));
  const controls = strip(read("components/voice/NarrationControls.tsx"));
  const bar = strip(read("components/voice/LearningModeBar.tsx"));
  const lesson = strip(read("app/lesson/[dayId]/page.tsx"));

  // The hook must never call speak() itself — the returned callback is the
  // only path, and it needs a press.
  check("the hook does not speak on its own", !/useEffect\([^)]*\)\s*=>\s*\{[^}]*provider\.speak/s.test(hook));
  check("the hook stops narration on unmount", /provider\.stop\(\)/.test(hook));
  check("the hook stops narration when the tab is hidden", /visibilitychange/.test(hook));
  check("the hook has no autoplay setting", !/autoPlay|autoplay/i.test(hook));

  check("the provider never fetches", !/fetch\(/.test(provider));
  check("the provider sends no audio anywhere", !/upload|XMLHttpRequest|WebSocket/.test(provider));
  check("the provider clamps the rate", /Math\.min\(Math\.max\(options\.rate/.test(provider));
  check("the provider guards every synth call", (provider.match(/try \{/g) || []).length >= 5);

  check("controls disappear when speech is unavailable", /state === "unavailable"\) return null/.test(controls));
  check("controls offer a repeat", /Again|again/.test(controls));
  check("controls are labelled for screen readers", (controls.match(/aria-label/g) || []).length >= 4);
  check("controls meet the touch target size", /min-h-\[44px\]/.test(controls));
  check("control state is announced politely", /aria-live="polite"/.test(controls));

  check("the listen toggle only shows where speech works", /available && \(/.test(bar));
  check("toggles report their state", /aria-pressed/.test(bar));

  // The lesson must narrate its own content, not a separate script.
  check("the lesson narrates its real story beat", /storyBeat: lesson\.storyBeat/.test(lesson));
  check("the lesson narrates its real puzzle prompt", /prompt: lesson\.puzzle\.prompt/.test(lesson));
  check("changing step stops the voice", /stopNarration\(\);/.test(lesson));
  // Fewer-words mode must REMOVE decoration and KEEP what a learner acts on.
  // The story paragraph is decoration; the goal, the prompt and the Continue
  // button are not, and none of them may sit behind a simpleMode guard.
  check("fewer-words mode hides the story paragraph", /!simpleMode && \([\s\S]{0,200}\{storyBeat\}/.test(lesson));
  check("fewer-words mode still shows the goal", /Today's Goal[\s\S]{0,400}\{objective\}/.test(lesson));
  check("the goal is not behind a simpleMode guard", !/!simpleMode && \([\s\S]{0,200}Today's Goal/.test(lesson));
  check("the puzzle prompt is never hidden", !/!simpleMode && \([\s\S]{0,200}\{prompt\}/.test(lesson));
  check("fewer-words mode never hides the Continue button", !/simpleMode && [\s\S]{0,120}Continue/.test(lesson));
  check("fewer-words mode only enlarges the prompt", /simpleMode[\s\S]{0,120}text-xl/.test(lesson));
}

console.log(`\n=== VOICE: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}
