import type { WorldLocationId } from "@/lib/world/locations";

/**
 * Per-game-launch pre-game cinematics for World locations — a short,
 * full-screen clip (optionally with subtle background music) shown once
 * between difficulty selection and the chess board (see
 * app/free-play/page.tsx's "cinematic" view state). Distinct from
 * lib/world/locations.ts's `art` (a persistent, silent background plate
 * behind the live board): a cinematic plays once per game start and is
 * never mounted during actual gameplay.
 *
 * The video is hosted, unmodified, in the same public `academy-media`
 * Supabase Storage bucket as every other video asset in this app (opening
 * video, login welcome). The music is a separate, original, local asset
 * (public/sounds/world/) — not hosted alongside the video, and not the
 * video's own (muted) audio track; see lib/world/cinematicMusic.ts for why
 * they're independent playback paths. A location without an entry here
 * simply has no cinematic — Free Play's own logic falls through straight to
 * the board, exactly as it did before either location had one; a location
 * with a `video` but no `music` still gets its cinematic, silently.
 */
export interface WorldCinematic {
  video: string;
  music?: string;
}

export const WORLD_CINEMATICS: Partial<Record<WorldLocationId, WorldCinematic>> = {
  "london-eye": {
    video:
      "https://fyanjpjuttjzpikhfztk.supabase.co/storage/v1/object/public/academy-media/london-eye/hero.mp4",
    music: "/sounds/world/london-eye-music.mp3",
  },
  chaturanga: {
    video:
      "https://fyanjpjuttjzpikhfztk.supabase.co/storage/v1/object/public/academy-media/chaturanga/hero.mp4",
    music: "/sounds/world/chaturanga-music.mp3",
  },
};

export function getWorldCinematic(id: WorldLocationId | null | undefined): WorldCinematic | null {
  if (!id) return null;
  return WORLD_CINEMATICS[id] ?? null;
}
