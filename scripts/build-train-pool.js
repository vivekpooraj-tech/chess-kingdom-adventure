/**
 * Build the Train Your Chess Mind pool index.
 *
 *   node scripts/build-train-pool.js [--workers=N] [--out=data/trainYourMind/pool-index.json]
 *
 * For every puzzle in data/puzzles/tactics-library.json (+ the optional
 * tactics-library-train.json) this classifies it into exercise families/levels
 * AND builds the exercise once, running the structural validator. Only exercises
 * that build and validate enter the index, so the server never discovers a broken
 * exercise at request time.
 *
 * The index maps family -> level -> [puzzle ids / authored keys]. Work is split
 * across child processes (chess.js is CPU-bound).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(ROOT, request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};

const BASE = path.join(ROOT, "data", "puzzles", "tactics-library.json");
const EXTRA = path.join(ROOT, "data", "puzzles", "tactics-library-train.json");
const OUT = path.resolve(ROOT, arg("out", "data/trainYourMind/pool-index.json"));

function loadLibrary() {
  const map = new Map();
  for (const f of [BASE, EXTRA]) {
    if (!fs.existsSync(f)) continue;
    for (const p of JSON.parse(fs.readFileSync(f, "utf8"))) if (!map.has(p.id)) map.set(p.id, p);
  }
  return [...map.values()];
}

const R = (p) => require(path.join(ROOT, p));

function buildAndValidate(family, key, level, puzzle, validateExercise) {
  const e = family.build({ key, level, puzzle });
  if (!e) return "build returned null";
  const expected = `x:${family.id}:${key}`;
  if (e.id !== expected) return "id mismatch";
  const errs = validateExercise(e);
  return errs.length ? errs.join("; ") : null;
}

// ---------------------------------------------------------------- worker
if (arg("worker")) {
  const i = Number(arg("worker"));
  const n = Number(arg("of"));
  const partial = arg("partial");
  const pool = R("lib/trainYourMind/engine/pool.ts");
  const { validateExercise } = R("lib/trainYourMind/engine/validate.ts");
  const lib = loadLibrary();
  const families = {};
  const stats = { classified: 0, ok: 0, fail: 0, failByFamily: {}, reasons: {} };
  for (let idx = i; idx < lib.length; idx += n) {
    const p = lib[idx];
    for (const { family, level } of pool.classifyPuzzle(p)) {
      stats.classified++;
      const def = pool.familyById(family);
      let err;
      try {
        err = buildAndValidate(def, p.id, level, p, validateExercise);
      } catch (e) {
        err = "threw: " + String(e && e.message).slice(0, 60);
      }
      if (err) {
        stats.fail++;
        stats.failByFamily[family] = (stats.failByFamily[family] || 0) + 1;
        const r = err.slice(0, 50);
        stats.reasons[r] = (stats.reasons[r] || 0) + 1;
      } else {
        stats.ok++;
        ((families[family] ||= {})[level] ||= []).push(p.id);
      }
    }
    if (((idx - i) / n) % 2000 === 0) process.stderr.write(`[w${i}] ${Math.round((idx / lib.length) * 100)}%\n`);
  }
  fs.writeFileSync(partial, JSON.stringify({ families, stats }));
  process.exit(0);
}

// ---------------------------------------------------------------- main
(async () => {
  const lib = loadLibrary();
  const workers = Math.max(1, Math.min(Number(arg("workers", Math.max(1, os.cpus().length - 1))), 12));
  console.log(`library: ${lib.length} puzzles; workers: ${workers}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "train-pool-"));
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: workers }, (_, i) =>
      new Promise((resolve, reject) => {
        const child = cp.spawn(process.execPath, [__filename, `--worker=${i}`, `--of=${workers}`, `--partial=${path.join(tmp, `p${i}.json`)}`], { stdio: ["ignore", "inherit", "inherit"] });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${i} exited ${code}`))));
      })
    )
  );

  const pool = R("lib/trainYourMind/engine/pool.ts");
  const { validateExercise } = R("lib/trainYourMind/engine/validate.ts");
  const { fnv1a } = R("lib/trainYourMind/exerciseIds.ts");
  const families = {};
  const total = { classified: 0, ok: 0, fail: 0, failByFamily: {}, reasons: {} };
  for (let i = 0; i < workers; i++) {
    const part = JSON.parse(fs.readFileSync(path.join(tmp, `p${i}.json`), "utf8"));
    for (const [fam, byLevel] of Object.entries(part.families)) for (const [lvl, ids] of Object.entries(byLevel)) ((families[fam] ||= {})[lvl] ||= []).push(...ids);
    total.classified += part.stats.classified;
    total.ok += part.stats.ok;
    total.fail += part.stats.fail;
    for (const [k, v] of Object.entries(part.stats.failByFamily)) total.failByFamily[k] = (total.failByFamily[k] || 0) + v;
    for (const [k, v] of Object.entries(part.stats.reasons)) total.reasons[k] = (total.reasons[k] || 0) + v;
  }

  // Authored / generated families with fixed keys.
  for (const s of pool.staticDescriptors()) {
    const def = pool.familyById(s.family);
    const err = buildAndValidate(def, s.key, s.level, undefined, validateExercise);
    if (err) {
      total.fail++;
      total.failByFamily[s.family] = (total.failByFamily[s.family] || 0) + 1;
    } else {
      total.ok++;
      ((families[s.family] ||= {})[s.level] ||= []).push(s.key);
    }
  }

  for (const byLevel of Object.values(families)) for (const ids of Object.values(byLevel)) ids.sort();
  const ids = lib.map((p) => p.id).sort();
  const index = {
    version: pool.POOL_INDEX_VERSION,
    puzzleCount: lib.length,
    fingerprint: fnv1a(ids.join(",")),
    families,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index));
  fs.rmSync(tmp, { recursive: true, force: true });

  const table = {};
  for (const [fam, byLevel] of Object.entries(families)) table[fam] = [1, 2, 3, 4, 5].map((l) => (byLevel[l] || []).length);
  console.log(`\nbuilt in ${Math.round((Date.now() - t0) / 1000)}s: ok=${total.ok} dropped=${total.fail}`);
  console.log("dropped by family:", total.failByFamily);
  console.log("top drop reasons:", Object.entries(total.reasons).sort((a, b) => b[1] - a[1]).slice(0, 8));
  for (const [fam, row] of Object.entries(table)) console.log(fam.padEnd(18), row.map((n) => String(n).padStart(6)).join(" "));
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
