/**
 * The first-time cinematic opening (brand logo reveal: CHESS -> EVOLUTION ->
 * MIND -> CHESS MIND) — distinct from content/academyVideos.ts's Chess
 * Origins video shown by /welcome. Hosted, unmodified, in the same public
 * `academy-media` Supabase Storage bucket, following that file's exact
 * pattern: a typed URL so swapping the asset later is a content change, not
 * a code change.
 *
 * Source asset: 1080x1920 (9:16), ~6s, H.264 + AAC, uploaded byte-for-byte
 * (verified via Content-Length) — no re-encode.
 */
export const OPENING_VIDEO_URL =
  "https://fyanjpjuttjzpikhfztk.supabase.co/storage/v1/object/public/academy-media/opening-video/hero.mp4";
