/**
 * Tests for lib/ollie/observability.ts — Ollie provider failure logging.
 *
 *   node scripts/test-ollie-observability.js
 *
 * Before this module, a provider failure (missing key, timeout, a 500 from
 * Anthropic, an empty reply) was completely invisible in production: every
 * one of them just quietly fell through to the local knowledge base, and a
 * missing ANTHROPIC_API_KEY looked identical in the logs to Anthropic being
 * down, because nothing was logged at all.
 *
 * The one rule that matters more than any category name: NOTHING SENSITIVE
 * IS EVER LOGGED. No API key, no child message, no system prompt, no Ollie
 * reply. classifyFailure's input type structurally cannot carry any of that
 * — it only has booleans and a status code — so this suite proves the
 * classifier by construction rather than by scanning strings for secrets
 * that could never have gotten in.
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

const O = require(path.join(process.cwd(), "lib", "ollie", "observability.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. Classification is correct and specific ---------------------------
{
  check("no key at all", O.classifyFailure({ hasKey: false, keyLooksPlausible: false }) === "no_key");
  check(
    "a key too short to be real",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: false }) === "short_key"
  );
  check(
    "our own timeout firing",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, wasAborted: true }) === "timeout"
  );
  check(
    "a thrown network error",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, threw: true }) === "network_error"
  );
  check(
    "a 401 from the provider",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, httpStatus: 401 }) === "http_error"
  );
  check(
    "a 500 from the provider",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, httpStatus: 500 }) === "http_error"
  );
  check(
    "a 200 with no usable text",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, httpStatus: 200, emptyText: true }) ===
      "empty_response"
  );
  check(
    "an OK response with text somehow still flagged empty",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, emptyText: true }) === "empty_response"
  );
  check(
    "nothing specific wrong falls back to unknown, not a guess",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true }) === "unknown"
  );

  // Priority: a missing key is reported as missing, never masked by a status
  // code that could not have happened without a key.
  check(
    "no key wins over any other flag",
    O.classifyFailure({ hasKey: false, keyLooksPlausible: false, httpStatus: 500, threw: true }) === "no_key"
  );
  check(
    "an abort is reported as a timeout even if also marked as thrown",
    O.classifyFailure({ hasKey: true, keyLooksPlausible: true, wasAborted: true, threw: true }) === "timeout"
  );
}

// --- 2. The classifier cannot leak anything sensitive, by construction ---
{
  // FailureShape has no field that could carry a key, a prompt or a reply —
  // passing one through is simply not possible without TypeScript rejecting
  // it at compile time. This is asserted here on the actual declared shape
  // of the type, read from source, so it fails if a future edit adds one.
  const src = fs.readFileSync(path.join(process.cwd(), "lib", "ollie", "observability.ts"), "utf8");
  // Trim to the interface body itself — up to its closing brace — not the
  // explanatory doc comment above classifyFailure, which legitimately
  // mentions "prompt" in prose while explaining that the shape carries none.
  const shapeStart = src.indexOf("interface FailureShape");
  const shapeBlock = src.slice(shapeStart, src.indexOf("}", shapeStart) + 1);
  check("FailureShape carries no key field", !/apiKey|secret|token/i.test(shapeBlock));
  check("FailureShape carries no message/prompt field", !/\bmessage\b|\bprompt\b|\breply\b/i.test(shapeBlock));

  check("classifyFailure never touches process.env", !/process\.env/.test(src.slice(0, src.indexOf("export function recordOllieOutcome"))));
}

// --- 3. Logging never throws and never leaks --------------------------
{
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const warnings = [];
  const infos = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  console.info = (...args) => infos.push(args.join(" "));

  try {
    O.recordOllieOutcome({ kind: "provider_failure", provider: "anthropic", category: "timeout" });
    O.recordOllieOutcome({ kind: "provider_success", provider: "anthropic" });
    O.recordOllieOutcome({ kind: "fallback_used", reason: "provider_failed" });
    O.recordOllieOutcome({ kind: "fallback_used", reason: "provider_not_configured" });
  } finally {
    console.warn = originalWarn;
    console.info = originalInfo;
  }

  check("a failure is logged as a warning", warnings.length === 1);
  check("success and fallback are logged as info, not warnings", infos.length === 3);
  check("the failure log names the category", warnings[0].includes("timeout"));
  check("the failure log names the provider", warnings[0].includes("anthropic"));
  let validJson = false;
  try {
    JSON.parse(warnings[0].slice(warnings[0].indexOf("{")));
    validJson = true;
  } catch {
    validJson = false;
  }
  check("logs are valid JSON payloads", validJson);

  const allLogged = warnings.concat(infos).join(" ");
  check("no log line contains anything that looks like an API key", !/sk-ant-|AIza[A-Za-z0-9_-]{20,}/.test(allLogged));
  check("no log line contains a request/response body marker", !/systemPrompt|"message":|"reply":/.test(allLogged));

  // Logging must never throw even if console itself is broken.
  console.warn = () => {
    throw new Error("console is broken");
  };
  let threw = false;
  try {
    O.recordOllieOutcome({ kind: "provider_failure", provider: "anthropic", category: "unknown" });
  } catch {
    threw = true;
  } finally {
    console.warn = originalWarn;
  }
  check("a broken console does not throw out of recordOllieOutcome", threw === false);
}

// --- 4. Wiring: every provider records its own outcomes, never a secret --
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const anthropic = strip(read("lib/ollie/providers/anthropic.ts"));
  const gemini = strip(read("lib/ollie/providers/gemini.ts"));
  const provider = strip(read("lib/ollie/aiProvider.ts"));

  for (const [name, src] of [["anthropic", anthropic], ["gemini", gemini]]) {
    check(`${name} imports the observability module`, /from "..\/observability"/.test(src));
    check(`${name} records at least one failure path`, /recordOllieOutcome\(\{\s*kind: "provider_failure"/.test(src));
    check(`${name} records success`, /kind: "provider_success"/.test(src));
    // The classifier call must never be handed the raw key or message — only
    // booleans/derived values. `!!apiKey` (a boolean) is fine and expected;
    // passing `apiKey` itself (the string) is what must never happen.
    const classifyCalls = src.match(/classifyFailure\(\{[\s\S]*?\}\)/g) ?? [];
    check(`${name} has at least one classifyFailure call to check`, classifyCalls.length > 0);
    check(
      `${name} never passes the raw key string into classifyFailure`,
      classifyCalls.every((call) => !/:\s*apiKey\s*[,}]/.test(call))
    );
    check(
      `${name} never passes the message/prompt into classifyFailure`,
      classifyCalls.every((call) => !/\bmessage\b|\bsystemPrompt\b/.test(call))
    );
  }

  check("aiProvider records when the fallback is used", /kind: "fallback_used"/.test(provider));
  check("aiProvider distinguishes an unconfigured provider from a failed one", /provider_not_configured/.test(provider));
}

console.log(`\n=== OLLIE OBSERVABILITY: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}
