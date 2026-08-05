import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chesskingdom.adventure',
  appName: 'Chess Kingdom Adventure',
  // Not a static bundle — this app has API routes, middleware, and
  // server-rendered pages that all need a real backend, so the WebView
  // loads the deployed site directly instead of local files in `webDir`
  // (which Capacitor still requires a value for, but it goes unused once
  // `server.url` is set).
  webDir: 'public',
  server: {
    url: 'https://chess-kingdom-adventure-opal.vercel.app',
    cleartext: false,
  },
};

export default config;
