import type { CapacitorConfig } from '@capacitor/cli';
import { BRAND } from './lib/brand';

// The one deployed URL every normal build (debug or release) ships with.
// This must stay the safe, always-correct default — never something a
// developer has to remember to set or revert by hand. A prior device-
// testing session hand-edited this file to point at a local dev server,
// synced it into the Android project, and the installed APK on a real
// phone kept loading http://localhost:3000 (net::ERR_CONNECTION_REFUSED)
// because nothing forced it back before the next build. That workflow
// (edit this file, remember to revert it) is exactly what's being
// eliminated below.
const PRODUCTION_URL = 'https://chess-kingdom-adventure-opal.vercel.app';

// Local-device development is opt-in ONLY via `npm run cap:sync:dev`
// (scripts/cap-sync-dev.js), which sets CAPACITOR_ENV for that one
// command and nothing else — never by editing this file. Plain
// `npx cap sync`, a plain Android Studio build, or any CI/release build
// all see CAPACITOR_ENV unset and get PRODUCTION_URL, unconditionally.
//
// CAPACITOR_DEV_SERVER_URL defaults to the documented `adb reverse
// tcp:3000 tcp:3000` workflow (loads the host machine's `next dev` over
// the USB connection); override it with your machine's LAN IP
// (e.g. http://192.168.1.23:3000) to skip adb reverse on Wi-Fi instead.
const isLocalDev = process.env.CAPACITOR_ENV === 'development';
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL || 'http://localhost:3000';

const config: CapacitorConfig = {
  // Package ID is a permanent app identity once published (Play Store ties
  // updates to it) — left as-is even if the display name changes later.
  appId: 'com.chesskingdom.adventure',
  appName: BRAND.name,
  // Not a static bundle — this app has API routes, middleware, and
  // server-rendered pages that all need a real backend, so the WebView
  // loads the deployed site directly instead of local files in `webDir`
  // (which Capacitor still requires a value for, but it goes unused once
  // `server.url` is set).
  webDir: 'public',
  server: isLocalDev
    ? { url: devServerUrl, cleartext: true }
    : { url: PRODUCTION_URL, cleartext: false },
};

export default config;
