"use client";

import { useEffect, useRef, useState } from "react";
import { playCinematicMusic, stopCinematicMusic } from "@/lib/world/cinematicMusic";

/**
 * A short, full-screen, muted pre-game cinematic — the same presentation
 * pattern as app/login-welcome/page.tsx (full-screen, no controls, clean
 * transition), adapted for a per-game-launch moment rather than a route:
 * this is a view-state swap inside app/free-play/page.tsx, not a
 * navigation, and it unmounts the instant `onDone` fires — never present
 * once the board is showing.
 *
 * The VIDEO is muted from the start (unlike the opening/login-welcome
 * videos, which attempt sound first) — a muted <video> is allowed to
 * autoplay everywhere, so there is no autoplay-blocked/unmuted-retry flash
 * to guard against. The opacity-until-`onPlaying` guard below is extra
 * insurance against a blank first frame regardless.
 *
 * MUSIC, if this location has one (see content/worldCinematics.ts), plays
 * through a completely separate audio element (lib/world/cinematicMusic.ts)
 * — never the video's own audio track, and never lib/sound/moveSound.ts's
 * chess sounds. It starts once this component mounts and is stopped in
 * exactly two places: the shared `settle()` (covers both `onEnded` and
 * `onError`, guarded so it only ever runs once) and this effect's own
 * cleanup (a safety net for an unmount that didn't go through `settle()`,
 * e.g. a fast double-navigation) — `stopCinematicMusic()` is idempotent, so
 * calling it from both is never a double-stop bug.
 *
 * Exactly-once semantics: `onEnded` (real playback finished) or `onError`
 * (genuine failure) each call `onDone` through the same settledRef guard —
 * never both, and never a generic timeout marking it "done" just because
 * loading is slow.
 */
export function LocationCinematic({
  src,
  musicSrc,
  onDone,
}: {
  src: string;
  musicSrc?: string;
  onDone: () => void;
}) {
  const settledRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (musicSrc) playCinematicMusic(musicSrc);
    return () => stopCinematicMusic();
    // musicSrc is fixed for the lifetime of one cinematic mount (a new
    // location is a new mount of this component, via React's key-less
    // remount when the parent's view state changes) — no need to react to
    // it changing mid-cinematic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function settle() {
    if (settledRef.current) return;
    settledRef.current = true;
    stopCinematicMusic();
    onDone();
  }

  return (
    <main className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      <video
        src={src}
        className={`h-full w-full bg-black object-contain transition-opacity duration-150 ${
          visible ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        playsInline
        preload="auto"
        autoPlay
        muted
        controls={false}
        onPlaying={() => setVisible(true)}
        onEnded={settle}
        onError={settle}
      />
    </main>
  );
}
