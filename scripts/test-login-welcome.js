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

console.log(`\n=== LOGIN WELCOME: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error(failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
