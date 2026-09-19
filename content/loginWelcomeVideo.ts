/**
 * Video 2 — the returning-user welcome animation, shown after a genuine
 * returning login (app/parent-gate) or a genuine cold app launch
 * (app/page.tsx). Distinct from content/openingVideo.ts's first-time
 * signup video — the two never share a code path.
 *
 * Source asset: 720x1280 (9:16), ~4s, H.264 + AAC, uploaded byte-for-byte
 * (verified via Content-Length) — no re-encode.
 */
export const LOGIN_WELCOME_VIDEO_URL =
  "https://fyanjpjuttjzpikhfztk.supabase.co/storage/v1/object/public/academy-media/login-welcome/hero.mp4";
