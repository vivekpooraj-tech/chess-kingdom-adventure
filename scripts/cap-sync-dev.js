// Explicit, opt-in local-device development sync — sets CAPACITOR_ENV for
// this one child process before invoking `cap sync`, so capacitor.config.ts
// picks the local dev server (see that file's own comment for why this
// exists instead of hand-editing it: a hand-edit that never got reverted is
// exactly how a real device ended up with an installed APK stuck loading
// http://localhost:3000).
//
// Usage:
//   npm run cap:sync:dev
//     -> loads http://localhost:3000 (pair with `adb reverse tcp:3000 tcp:3000`)
//   CAPACITOR_DEV_SERVER_URL=http://192.168.1.23:3000 npm run cap:sync:dev
//     -> loads that LAN address instead (no adb reverse needed on Wi-Fi)
//
// After device testing, run `npm run cap:sync` (no env var) to put the
// Android project back on the real production URL before any other build.
const { execSync } = require("child_process");

execSync("npx cap sync android", {
  stdio: "inherit",
  env: { ...process.env, CAPACITOR_ENV: "development" },
});
