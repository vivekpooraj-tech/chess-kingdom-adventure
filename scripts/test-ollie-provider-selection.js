// Pure-JS mirror of the provider-selection logic in lib/ollie/aiProvider.ts
// (getSelectedProvider) and the key-shape checks in
// lib/ollie/providers/{anthropic,gemini}.ts. No network, no server --
// this only tests which provider NAME gets chosen for a given set of env
// vars, not that the provider's own API call works -- that needs a live
// key and was verified manually against both Anthropic and Gemini.
//
// Run: node scripts/test-ollie-provider-selection.js

const ANTHROPIC_MIN_KEY_LENGTH = 40;
const GEMINI_MIN_KEY_LENGTH = 20;

function hasUsableAnthropicKey(env) {
  const key = env.ANTHROPIC_API_KEY;
  return !!key && key.length >= ANTHROPIC_MIN_KEY_LENGTH;
}

function getSelectedProvider(env) {
  const configured = env.OLLIE_AI_PROVIDER;
  if (configured === "anthropic" || configured === "development" || configured === "fallback") {
    return configured;
  }
  return hasUsableAnthropicKey(env) ? "anthropic" : "fallback";
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

const REAL_KEY = "a".repeat(108); // shape of a real Anthropic key, not a real one
const PLACEHOLDER_KEY = "sk-ant-...";

// --- Explicit OLLIE_AI_PROVIDER always wins, regardless of key state ---
check(
  "explicit development wins even with a usable Anthropic key present",
  getSelectedProvider({ OLLIE_AI_PROVIDER: "development", ANTHROPIC_API_KEY: REAL_KEY }),
  "development"
);
check(
  "explicit anthropic wins even with no key at all (provider adapter itself will no-op)",
  getSelectedProvider({ OLLIE_AI_PROVIDER: "anthropic" }),
  "anthropic"
);
check(
  "explicit fallback wins even with a usable Anthropic key present",
  getSelectedProvider({ OLLIE_AI_PROVIDER: "fallback", ANTHROPIC_API_KEY: REAL_KEY }),
  "fallback"
);
check(
  "an unrecognized OLLIE_AI_PROVIDER value is ignored, not trusted blindly",
  getSelectedProvider({ OLLIE_AI_PROVIDER: "not-a-real-provider", ANTHROPIC_API_KEY: REAL_KEY }),
  "anthropic"
);

// --- No explicit provider set: auto-detect from key presence (today's exact production behavior) ---
check(
  "no provider set + usable Anthropic key -> anthropic (unchanged prior behavior)",
  getSelectedProvider({ ANTHROPIC_API_KEY: REAL_KEY }),
  "anthropic"
);
check(
  "no provider set + placeholder Anthropic key -> fallback",
  getSelectedProvider({ ANTHROPIC_API_KEY: PLACEHOLDER_KEY }),
  "fallback"
);
check("no provider set + no key at all -> fallback", getSelectedProvider({}), "fallback");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
