/**
 * Lichess connection (Phase 1) — pure-logic + static checks. No browser, no network, no database.
 *   node scripts/test-lichess-connect.js
 *
 * Covers: adult-only eligibility, PKCE (S256) + state, authorize URL, redirect URIs (Lichess's dot-in-scheme rule), single-use pending auth,
 * callback validation, token exchange error handling (mocked fetch), per-profile token store that never exposes the token, and static
 * guarantees (Android filter, deep-link branch, minors never see the row, no logging/URL leakage, no matchmaking/DB change).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ts = require("typescript");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0; const fails = [];
const check = (name, ok, detail) => { if (ok) pass++; else { fails.push(name + (detail ? " -- " + detail : "")); console.log("FAIL " + name + (detail ? " -- " + detail : "")); } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function load(rel, globals = {}) {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", ...Object.keys(globals), out)(mod, mod.exports, require, ...Object.values(globals));
  return mod.exports;
}
function memoryStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }

(async () => {
  console.log("\n=== A. Eligibility: adults only ===");
  const { isLichessEligible } = load("lib/lichess/eligibility.ts");
  check("adult (18+) is eligible", isLichessEligible("adult") === true);
  for (const band of ["young", "tween", "teen", "", null, undefined, "ADULT", "adult "]) check(`not eligible: ${JSON.stringify(band)}`, isLichessEligible(band) === false);

  console.log("\n=== B. PKCE + state + authorize URL ===");
  const ls = memoryStorage();
  let fetchImpl = async () => { throw new Error("no fetch"); };
  const oauth = load("lib/lichess/oauth.ts", { localStorage: ls, crypto: crypto.webcrypto, btoa: (s) => Buffer.from(s, "binary").toString("base64"), TextEncoder, URLSearchParams, fetch: (...a) => fetchImpl(...a) });
  const v = oauth.createVerifier();
  check("verifier is >= 43 chars (Lichess minimum)", v.length >= 43, String(v.length));
  check("verifier is base64url only", /^[A-Za-z0-9_-]+$/.test(v));
  check("verifiers are unique", new Set(Array.from({ length: 50 }, () => oauth.createVerifier())).size === 50);
  const expected = crypto.createHash("sha256").update(v).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  check("challenge is unpadded base64url SHA-256 of the verifier (S256)", (await oauth.challengeFor(v)) === expected);
  check("states are unique and non-trivial", new Set(Array.from({ length: 50 }, () => oauth.createState())).size === 50 && oauth.createState().length >= 20);
  const url = new URL(oauth.buildAuthorizeUrl({ challenge: expected, state: "st", redirectUri: "https://www.chessmind.club/lichess/callback" }));
  const q = url.searchParams;
  check("authorize endpoint is lichess.org/oauth", url.origin === "https://lichess.org" && url.pathname === "/oauth");
  check("response_type=code, S256, state present", q.get("response_type") === "code" && q.get("code_challenge_method") === "S256" && q.get("state") === "st" && q.get("code_challenge") === expected);
  check("minimal scope: exactly board:play", q.get("scope") === "board:play");
  check("no client secret / verifier in the authorize URL", !/secret|verifier/i.test(url.search) && !url.search.includes(v));
  check("a client id is sent (public client)", !!q.get("client_id"));

  console.log("\n=== C. Redirect URIs ===");
  check("web redirect = origin + /lichess/callback", oauth.redirectUriFor(false, "http://localhost:3000") === "http://localhost:3000/lichess/callback");
  check("native redirect uses the dotted app-id scheme", oauth.redirectUriFor(true, "https://x") === "com.chesskingdom.adventure://lichess/callback");
  const scheme = new URL(oauth.redirectUriFor(true, "https://x")).protocol.replace(":", "");
  check("native scheme contains a dot (Lichess rejects dot-less custom schemes)", scheme.includes("."));
  check("native redirect is NOT the Supabase sign-in scheme", !oauth.redirectUriFor(true, "").startsWith("chesskingdom://"));
  check("native scheme equals the Android applicationId", /applicationId "com\.chesskingdom\.adventure"/.test(read("android/app/build.gradle")) && oauth.LICHESS_NATIVE_SCHEME === "com.chesskingdom.adventure");

  console.log("\n=== D. Pending authorization: single use + callback validation ===");
  const now = Date.now();
  const pending = { verifier: v, state: "S1", childId: "child-A", redirectUri: "r", createdAt: now };
  oauth.savePending(pending);
  check("pending is stored", ls.getItem("cm:lichess:pending") !== null);
  const taken = oauth.takePending();
  check("takePending returns it and REMOVES it (single use)", taken && taken.state === "S1" && ls.getItem("cm:lichess:pending") === null && oauth.takePending() === null);
  ls.setItem("cm:lichess:pending", "{not json");
  check("corrupt pending is treated as none", oauth.takePending() === null);
  const ok = { code: "c", state: "S1", error: null };
  check("valid callback accepted", oauth.validateCallback(pending, ok, "child-A", now + 1000).ok === true);
  const why = (p, params, child, t) => { const r = oauth.validateCallback(p, params, child, t); return r.ok ? "ok" : r.reason; };
  check("error=access_denied -> denied", why(pending, { code: null, state: "S1", error: "access_denied" }, "child-A", now) === "denied");
  check("no pending -> no_pending", why(null, ok, "child-A", now) === "no_pending");
  check("older than 10 minutes -> expired", why(pending, ok, "child-A", now + oauth.PENDING_TTL_MS + 1) === "expired");
  check("state mismatch rejected", why(pending, { ...ok, state: "other" }, "child-A", now) === "state_mismatch");
  check("missing state rejected", why(pending, { ...ok, state: null }, "child-A", now) === "state_mismatch");
  check("a different active profile rejected", why(pending, ok, "child-B", now) === "wrong_profile");
  check("no active profile rejected", why(pending, ok, null, now) === "wrong_profile");
  check("missing code rejected", why(pending, { ...ok, code: null }, "child-A", now) === "no_code");

  console.log("\n=== E. Token exchange (mocked fetch): errors are generic and never leak ===");
  let seen = null;
  fetchImpl = async (u, init) => { seen = { u, init }; return { ok: true, json: async () => ({ access_token: "lip_SECRET", expires_in: 31536000, token_type: "Bearer" }) }; };
  const r1 = await oauth.exchangeCode("CODE", v, "https://x/lichess/callback");
  const body = new URLSearchParams(seen.init.body);
  check("exchange POSTs to /api/token with the verifier, code, redirect and no secret", seen.u === "https://lichess.org/api/token" && seen.init.method === "POST" && body.get("grant_type") === "authorization_code" && body.get("code_verifier") === v && body.get("code") === "CODE" && !body.get("client_secret"));
  check("exchange returns the token and lifetime", r1.token === "lip_SECRET" && r1.expiresInSec === 31536000);
  fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", detail: "lip_SECRET" }) });
  let err1; try { await oauth.exchangeCode("c", v, "r"); } catch (e) { err1 = e; }
  check("a rejected exchange throws a generic 'rejected' error that does not echo the body", err1 && err1.kind === "rejected" && !/lip_|invalid_grant/.test(err1.message));
  fetchImpl = async () => { throw new TypeError("Failed to fetch"); };
  let err2; try { await oauth.exchangeCode("c", v, "r"); } catch (e) { err2 = e; }
  check("a network failure throws a 'network' error", err2 && err2.kind === "network");
  fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  let err3; try { await oauth.exchangeCode("c", v, "r"); } catch (e) { err3 = e; }
  check("a response with no access_token is rejected", err3 && err3.kind === "rejected");
  fetchImpl = async (u, init) => { seen = { u, init }; return { ok: true, json: async () => ({ id: "x", username: "Magnus" }) }; };
  check("account lookup returns only the username", (await oauth.fetchAccountName("t")) === "Magnus" && seen.init.headers.Authorization === "Bearer t");
  fetchImpl = async (u, init) => { seen = { u, init }; return { ok: true }; };
  check("revoke sends DELETE /api/token with the bearer", (await oauth.revokeToken("tok")) === true && seen.init.method === "DELETE" && seen.u === "https://lichess.org/api/token" && seen.init.headers.Authorization === "Bearer tok");
  fetchImpl = async () => { throw new Error("offline"); };
  check("revoke never throws (offline)", (await oauth.revokeToken("tok")) === false);

  console.log("\n=== F. Token store: per profile, token never exposed to the UI ===");
  const ls2 = memoryStorage();
  const store = load("lib/lichess/tokenStore.ts", { localStorage: ls2, Date });
  store.saveConnection("child-A", "lip_TOKEN_A", "Alice", 3600);
  check("a profile can read its own public connection", store.readConnection("child-A").username === "Alice");
  check("readConnection NEVER includes the token", !JSON.stringify(store.readConnection("child-A")).includes("lip_TOKEN_A") && !("token" in store.readConnection("child-A")));
  check("readToken is available to the Lichess client", store.readToken("child-A") === "lip_TOKEN_A");
  check("another profile on the same device sees nothing", store.readConnection("child-B") === null && store.readToken("child-B") === null);
  store.clearConnection("child-A");
  check("disconnect clears the token", store.readConnection("child-A") === null && store.readToken("child-A") === null && ls2._m.size === 0);
  store.saveConnection("child-C", "lip_OLD", "Old", 1);
  ls2.setItem("cm:lichess:conn:child-C", JSON.stringify({ token: "lip_OLD", username: "Old", connectedAt: 0, expiresAt: Date.now() - 1000 }));
  check("an expired token is dropped, not returned", store.readToken("child-C") === null && !ls2._m.has("cm:lichess:conn:child-C"));

  console.log("\n=== G. Static guarantees ===");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  check("Android: dotted-scheme filter for the Lichess callback exists", /android:scheme="com\.chesskingdom\.adventure"\s+android:host="lichess"/.test(manifest));
  check("Android: the Supabase sign-in filter (chesskingdom) is still there, unchanged", /<data android:scheme="chesskingdom" \/>/.test(manifest) && /android:autoVerify="true"/.test(manifest));
  const dl = read("components/CapacitorDeepLinkHandler.tsx");
  check("deep links: Lichess branch is separate from, and before, the Supabase branch", dl.indexOf("LICHESS_NATIVE_SCHEME}:`") > 0 && dl.indexOf("LICHESS_NATIVE_SCHEME}:`") < dl.indexOf('url.protocol !== "chesskingdom:"'));
  check("deep links: an already-handled Lichess link is ignored (a cold-start launch URL must not re-route on every page load)", /sessionStorage\.getItem\(LICHESS_HANDLED_KEY\) === url\.href\) return;/.test(dl) && /sessionStorage\.setItem\(LICHESS_HANDLED_KEY, url\.href\)/.test(dl));
  check("deep links: the replay guard sits before the browser close and the route push", dl.indexOf("LICHESS_HANDLED_KEY, url.href") < dl.indexOf("router.push(`${WEB_CALLBACK_PATH}"));
  check("deep links: the Supabase exchange path is untouched", /exchangeCodeForSession\(code\)/.test(dl) && /router\.push\(exchangeError \? "\/sign-in\?error=auth_failed" : "\/parent-gate"\)/.test(dl));
  check("deep links: cold start also recognises the Lichess scheme", /getLaunchUrl/.test(dl) && /launch\?\.url\?\.startsWith\(`\$\{LICHESS_NATIVE_SCHEME\}:\/\/`\)/.test(dl));
  const row = read("components/lichess/LichessConnectRow.tsx");
  check("the Connect row renders nothing unless eligible", /if \(!eligible\) return null;/.test(row) && /isLichessEligible\(ageBand\)/.test(row));
  check("the Connect row has a Disconnect action that revokes and clears", /data-lichess-disconnect/.test(row) && /revokeToken\(token\)/.test(row) && /clearConnection\(childId\)/.test(row));
  const more = read("app/(tabs)/more/page.tsx");
  check("More passes the active child's id and age band to the row", /<LichessConnectRow childId=\{child\.id\} ageBand=\{child\.age_band \?\? null\} \/>/.test(more));
  const cb = read("app/lichess/callback/page.tsx");
  check("callback re-checks eligibility server-side-of-the-click (adult only)", /isLichessEligible\(child\?\.age_band\)/.test(cb));
  const runCb = cb.slice(cb.indexOf("async function runCallback"), cb.indexOf("function CallbackInner"));
  check("callback fails closed FIRST: the eligibility check comes before validateCallback, any exchange, and any other message", runCb.indexOf("isLichessEligible(child?.age_band)") > 0 && runCb.indexOf("isLichessEligible(child?.age_band)") < runCb.indexOf("validateCallback(") && runCb.indexOf("isLichessEligible(child?.age_band)") < runCb.indexOf("exchangeCode("));
  const notEligibleLine = cb.split(/\r?\n/).find((l) => l.trim().startsWith("not_eligible:")) || "";
  check("callback: the not-eligible message is generic and contains no Lichess wording", notEligibleLine.includes("This page isn't available.") && !/lichess/i.test(notEligibleLine), notEligibleLine);
  check("callback validates state, profile and expiry via validateCallback", /validateCallback\(pending/.test(cb));
  const libFiles = ["lib/lichess/oauth.ts", "lib/lichess/tokenStore.ts", "lib/lichess/eligibility.ts", "components/lichess/LichessConnectRow.tsx", "app/lichess/callback/page.tsx"].map((f) => [f, strip(read(f))]);
  check("no console.* anywhere in the Lichess code (tokens can never be logged)", libFiles.every(([, s]) => !/console\./.test(s)));
  check("the token is never placed in a URL or search param", libFiles.every(([, s]) => !/(searchParams|URLSearchParams)\([^)]*token/i.test(s)) && !/router\.(push|replace)\([^)]*token/i.test(strip(cb)));
  check("tokens are not sent to analytics, Supabase or our API", libFiles.every(([, s]) => !/posthog|analytics|supabase\.(from|rpc)|\/api\/(?!token|account)/i.test(s.replace(/lichess\.org\/api\/(token|account)/g, ""))) );
  check("no client secret anywhere", libFiles.every(([, s]) => !/client_secret/.test(s.replace(/!body\.get\("client_secret"\)/g, ""))));
  check("no Lichess chat, hints, or engine in the new code", libFiles.every(([, s]) => !/chat|stockfish|hint|coach/i.test(s)));
  const mm = read("app/matchmaking/page.tsx");
  check("matchmaking is untouched in Phase 1 (no Lichess reference)", !/lichess/i.test(mm));
  check("no Lichess reference in the rating code or online game page", !/lichess/i.test(read("app/online/[gameId]/page.tsx")) && !/lichess/i.test(read("lib/supabase/queries.ts")));
  check("no migration added by this change", !fs.readdirSync(path.join(ROOT, "supabase/migrations")).some((f) => /lichess/i.test(f)));

  console.log(`\n=== LICHESS CONNECT (Phase 1, logic): ${pass} passed, ${fails.length} failed ===`);
  process.exit(fails.length ? 1 : 0);
})();
