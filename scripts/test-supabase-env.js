/**
 * Tests for lib/supabase/env.ts.
 *
 *   node scripts/test-supabase-env.js
 *
 * Pure logic only — the environment is a parameter, so nothing here touches
 * process.env, the network, or a database.
 *
 * These lock down the exact production outage this module was written for: an
 * unset or malformed NEXT_PUBLIC_SUPABASE_URL reaching the SDK from middleware
 * and taking the whole site down with 500 MIDDLEWARE_INVOCATION_FAILED. The
 * rule being tested is that a bad value is ALWAYS reported, never passed
 * through to createServerClient(), and never silently turned into something
 * that looks valid but points somewhere else.
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

const E = require(path.join(process.cwd(), "lib", "supabase", "env.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const GOOD_URL = "https://abcdefghijklm.supabase.co";
const GOOD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon.key";
const env = (url, key) => ({
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
});

// --- 1. The happy path -----------------------------------------------------
{
  const r = E.readSupabaseConfig(env(GOOD_URL, GOOD_KEY));
  check("a correct config is accepted", r.ok === true);
  check("url passes through unchanged", r.ok && r.config.url === GOOD_URL);
  check("key passes through unchanged", r.ok && r.config.anonKey === GOOD_KEY);
  check("no warnings for a clean config", r.ok && r.warnings.length === 0);
}

// --- 2. The outage: missing values -----------------------------------------
{
  const cases = [
    ["both unset", env(undefined, undefined)],
    ["url unset", env(undefined, GOOD_KEY)],
    ["key unset", env(GOOD_URL, undefined)],
    ["both empty", env("", "")],
    ["url empty", env("", GOOD_KEY)],
    ["key empty", env(GOOD_URL, "")],
    ["url whitespace only", env("   ", GOOD_KEY)],
    ["key whitespace only", env(GOOD_URL, "  \n ")],
    ["entirely empty env", {}],
  ];
  for (const [label, e] of cases) {
    const r = E.readSupabaseConfig(e);
    check(`rejected: ${label}`, r.ok === false);
    check(`rejection explains why: ${label}`, r.ok === false && r.problems.length > 0);
  }

  // Both faults are reported together, so one redeploy fixes both.
  const both = E.readSupabaseConfig(env(undefined, undefined));
  check("both problems reported at once", both.ok === false && both.problems.length === 2);
}

// --- 3. The outage: malformed URLs ----------------------------------------
{
  const rejected = [
    ["non-http scheme", "ftp://abc.supabase.co"],
    ["javascript scheme", "javascript:alert(1)"],
    ["internal whitespace", "https://abc supabase.co"],
    ["bare word, no host", "not a url"],
    ["scheme only", "https://"],
  ];
  for (const [label, url] of rejected) {
    const r = E.readSupabaseConfig(env(url, GOOD_KEY));
    check(`rejected malformed url: ${label}`, r.ok === false);
  }

  // The specific value that produced "Invalid supabaseUrl" in production.
  const noScheme = E.readSupabaseConfig(env("abcdefghijklm.supabase.co", GOOD_KEY));
  check("missing scheme is corrected, not fatal", noScheme.ok === true);
  check("missing scheme becomes https", noScheme.ok && noScheme.config.url === GOOD_URL);
  check("missing scheme still warns", noScheme.ok && noScheme.warnings.length === 1);
  check(
    "the warning names the variable",
    noScheme.ok && /NEXT_PUBLIC_SUPABASE_URL/.test(noScheme.warnings[0])
  );
}

// --- 4. Paste damage: quotes and padding ----------------------------------
{
  const equivalents = [
    ` ${GOOD_URL} `,
    `"${GOOD_URL}"`,
    `'${GOOD_URL}'`,
    `\`${GOOD_URL}\``,
    `  "${GOOD_URL}"  `,
    `"'${GOOD_URL}'"`,
    `${GOOD_URL}\n`,
    `\t${GOOD_URL}\r\n`,
  ];
  for (const raw of equivalents) {
    const r = E.readSupabaseConfig(env(raw, GOOD_KEY));
    check(`sanitised url: ${JSON.stringify(raw)}`, r.ok === true && r.config.url === GOOD_URL);
  }

  const quotedKey = E.readSupabaseConfig(env(GOOD_URL, `"${GOOD_KEY}"`));
  check("quoted key is unquoted", quotedKey.ok && quotedKey.config.anonKey === GOOD_KEY);

  const paddedKey = E.readSupabaseConfig(env(GOOD_URL, `  ${GOOD_KEY}\n`));
  check("padded key is trimmed", paddedKey.ok && paddedKey.config.anonKey === GOOD_KEY);

  // A key with a line break INSIDE it is truncated data, not padding.
  const brokenKey = E.readSupabaseConfig(env(GOOD_URL, "eyJhbGci\nOiJIUzI1"));
  check("key with internal whitespace is rejected", brokenKey.ok === false);

  // Unmatched quotes are left alone rather than silently truncated.
  check('unmatched leading quote preserved', E.sanitizeEnvValue('"abc') === '"abc');
  check("unmatched trailing quote preserved", E.sanitizeEnvValue("abc'") === "abc'");
  check("non-string input yields empty", E.sanitizeEnvValue(undefined) === "" && E.sanitizeEnvValue(null) === "");
}

// --- 5. Origin normalisation ----------------------------------------------
{
  const cases = [
    [`${GOOD_URL}/`, GOOD_URL],
    [`${GOOD_URL}//`, GOOD_URL],
    [`${GOOD_URL}/rest/v1`, GOOD_URL],
    [`${GOOD_URL}/?apikey=x`, GOOD_URL],
    [`${GOOD_URL}#frag`, GOOD_URL],
  ];
  for (const [raw, want] of cases) {
    const r = E.readSupabaseConfig(env(raw, GOOD_KEY));
    check(`normalised to origin: ${raw}`, r.ok === true && r.config.url === want);
  }

  const withPath = E.readSupabaseConfig(env(`${GOOD_URL}/rest/v1`, GOOD_KEY));
  check("a stripped path is warned about", withPath.ok && withPath.warnings.length >= 1);

  // Local Supabase must keep working.
  const local = E.readSupabaseConfig(env("http://localhost:54321", GOOD_KEY));
  check("http localhost is allowed", local.ok === true);
  check("localhost port preserved", local.ok && local.config.url === "http://localhost:54321");
  check("host and port are never altered",
    E.readSupabaseConfig(env("https://abc.supabase.co:8443", GOOD_KEY)).config.url ===
      "https://abc.supabase.co:8443");
}

// --- 6. getSupabaseConfig throws usefully ---------------------------------
{
  let threw = null;
  try {
    E.getSupabaseConfig(env(undefined, undefined));
  } catch (err) {
    threw = err;
  }
  check("getSupabaseConfig throws on a bad config", threw !== null);
  check("the message names the url variable", threw && /NEXT_PUBLIC_SUPABASE_URL/.test(threw.message));
  check("the message names the key variable", threw && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(threw.message));
  check("the message says a redeploy is needed", threw && /redeploy/i.test(threw.message));
  check(
    "the message is not the SDK's opaque one",
    threw && !/Invalid supabaseUrl/.test(threw.message)
  );

  check("getSupabaseConfig returns the config when valid",
    E.getSupabaseConfig(env(GOOD_URL, GOOD_KEY)).url === GOOD_URL);
}

// --- 7. No secret ever leaks into a message -------------------------------
{
  const SECRET = "super-secret-anon-key-value";
  const r = E.readSupabaseConfig(env("ftp://bad", SECRET));
  const joined = r.ok ? "" : r.problems.join(" ") + E.describeSupabaseConfigProblem(r.problems);
  check("the anon key value never appears in an error", !joined.includes(SECRET));

  // A whitespace-damaged key is reported without echoing it back.
  const r2 = E.readSupabaseConfig(env(GOOD_URL, `${SECRET} ${SECRET}`));
  const joined2 = r2.ok ? "" : r2.problems.join(" ");
  check("a damaged key is not echoed", !joined2.includes(SECRET));
}

// --- 8. Callers actually use it -------------------------------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const files = {
    "middleware.ts": read("middleware.ts"),
    "lib/supabase/server.ts": read("lib/supabase/server.ts"),
    "lib/supabase/client.ts": read("lib/supabase/client.ts"),
    "app/auth/callback/route.ts": read("app/auth/callback/route.ts"),
  };

  for (const [name, src] of Object.entries(files)) {
    // The `!` non-null assertion on the env vars is the original bug.
    check(
      `${name}: no unchecked NEXT_PUBLIC_SUPABASE_URL!`,
      !/process\.env\.NEXT_PUBLIC_SUPABASE_URL\s*!/.test(src)
    );
    check(
      `${name}: no unchecked NEXT_PUBLIC_SUPABASE_ANON_KEY!`,
      !/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*!/.test(src)
    );
    check(`${name}: goes through the validator`, /supabase\/env|from "\.\/env"/.test(src));
  }

  // Middleware must degrade, not throw, and must not use the throwing accessor.
  const mw = files["middleware.ts"];
  check("middleware uses the non-throwing reader", /readSupabaseConfig\(/.test(mw));
  check("middleware does NOT use the throwing accessor", !/getSupabaseConfig\(/.test(mw));
  check("middleware has a catch-all guard", /catch\s*\(\s*error\s*\)/.test(mw));
  check("middleware still exports a matcher", /export const config/.test(mw));

  // The service-role key must never be READ anywhere the browser can reach,
  // nor by the shared env module. Naming it in a comment (env.ts explains why
  // it is deliberately excluded) is fine — what matters is that no code path
  // actually accesses it, so this looks for the access, not the word.
  const readsServiceRole = (src) => /process\.env\.[A-Za-z_]*SERVICE_ROLE/.test(src);
  const allSrc = Object.values(files).join("\n");
  check("no service role key read in client-reachable code", !readsServiceRole(allSrc));
  const envSrc = read("lib/supabase/env.ts");
  check("env module never reads the service role key", !readsServiceRole(envSrc));
  check(
    "service role key is never exposed as NEXT_PUBLIC",
    !/NEXT_PUBLIC_[A-Za-z_]*SERVICE_ROLE/.test(allSrc + envSrc)
  );
}

console.log(`\n=== SUPABASE ENV: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}
