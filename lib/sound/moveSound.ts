/**
 * Chess move sound effects. Three short, preloaded HTMLAudioElement
 * instances (no new dependency — Web Audio API/Howler would be overkill for
 * a handful of fire-and-forget clips) created once at module load and
 * replayed from the start on every call, so rapid successive moves never
 * pile up overlapping tails or allocate a new Audio object per move.
 *
 * Playback is strictly fire-and-forget: a blocked/failed play() is swallowed
 * so audio can never throw into, delay, or gate chess move logic. Standard
 * <audio> playback already respects the device's media volume and system
 * silent/DND state with zero extra code.
 */
const SOUND_URLS = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  checkmate: "/sounds/checkmate.mp3",
} as const;

type MoveSoundKind = keyof typeof SOUND_URLS;

let players: Record<MoveSoundKind, HTMLAudioElement> | null = null;

function getPlayers(): Record<MoveSoundKind, HTMLAudioElement> | null {
  if (typeof window === "undefined") return null;
  if (!players) {
    const move = new Audio(SOUND_URLS.move);
    const capture = new Audio(SOUND_URLS.capture);
    const checkmate = new Audio(SOUND_URLS.checkmate);
    move.preload = "auto";
    capture.preload = "auto";
    checkmate.preload = "auto";
    players = { move, capture, checkmate };
  }
  return players;
}

export function playMoveSound(kind: MoveSoundKind): void {
  const p = getPlayers();
  if (!p) return;
  const audio = p[kind];
  try {
    audio.currentTime = 0;
  } catch {
    // Not yet seekable (metadata still loading) — play() below still works
    // from wherever the element currently is.
  }
  audio.play().catch(() => {
    // Blocked by autoplay policy or failed to load — never surface this as
    // an error, and never let it affect the move that already happened.
  });
}
