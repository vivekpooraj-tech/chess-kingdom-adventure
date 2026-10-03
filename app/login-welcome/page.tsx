"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { postAuthDestination } from "@/lib/auth/postAuthDestination";
import { markLoginWelcomeShownThisSession } from "@/lib/loginWelcome";
import { LOGIN_WELCOME_VIDEO_URL } from "@/content/loginWelcomeVideo";
import {
  initialWelcomeState,
  reduceWelcome,
  type WelcomeEffect,
  type WelcomeEvent,
  type WelcomeState,
} from "@/lib/loginWelcomeMachine";

// Monotonic: a wall-clock jump (NTP sync on a just-woken device) must not
// look like the video going silent.
const now = () => performance.now();

/**
 * Video 2 — the returning-user welcome animation. Reached from exactly two
 * places, never navigated to directly by any in-app link or nav item:
 *
 *  - app/parent-gate/page.tsx  (Trigger A: a genuine sign-out-then-sign-in)
 *  - app/page.tsx              (Trigger B: a genuine cold app launch)
 *
 * This page writes NO database flag. Video 1's has_seen_opening_video stays
 * a once-ever-per-child fact owned by the opening-video page. Video 2's only
 * "seen" bookkeeping is the sessionStorage guard in lib/loginWelcome.ts, and
 * it is written only after playback has actually started — never because
 * autoplay was blocked or the file failed to load.
 *
 * Sound is attempted once, unmuted, with no tap. The Android WebView allows
 * that because Capacitor sets setMediaPlaybackRequiresUserGesture(false).
 * If that play() is rejected, the same video continues muted and stays on
 * screen. A video that has already started muted is never unmuted later —
 * that pause was measured in Chrome. Play and Continue are offered only when
 * both attempts fail, the file errors, or the video has genuinely stopped
 * making progress (lib/loginWelcomeMachine.ts) — a merely slow start is not
 * a failure, and a late `playing` clears the overlay. The page never moves
 * on by itself in that state.
 *
 * Destination after the video is computed via the exact same
 * postAuthDestination() every login already resolves through — this page
 * is only ever reached for an already-onboarded child in practice, but
 * recomputes properly rather than hardcoding "/kingdom-map", so it can
 * never send someone to a stale or wrong destination if account state
 * changed in between.
 */
export default function LoginWelcomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [welcome, setWelcome] = useState<WelcomeState>(initialWelcomeState);
  const needsGesture = welcome.phase === "fallback";
  const loadFailed = welcome.failure === "error";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextHrefRef = useRef<string>("/kingdom-map");
  const settledRef = useRef(false);
  const startedRef = useRef(false);
  const machineRef = useRef<WelcomeState>(welcome);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (cancelled) return;

      if (resolution.needsSelection) {
        router.replace("/choose-child");
        return;
      }

      const { href } = postAuthDestination(resolution);
      nextHrefRef.current = href;
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Watchdog for a video that has genuinely stopped (see
  // lib/loginWelcomeMachine.ts): it asks "has the video made any progress
  // lately?", never "have N seconds passed since the page loaded?", so a slow
  // but live start is left alone while a dead one still gets the Play /
  // Continue escape. This never navigates on its own.
  useEffect(() => {
    if (!ready) return;
    dispatch({ type: "ready", at: now() });
    const id = window.setInterval(() => dispatch({ type: "tick", at: now() }), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function logVideo(label: string, v: HTMLVideoElement | null) {
    const err = v?.error;
    console.log(
      `[login-welcome] ${label} muted=${v ? v.muted : "null"} volume=${v ? v.volume : "null"} readyState=${v ? v.readyState : "null"} paused=${v ? v.paused : "null"} currentTime=${v ? v.currentTime : "null"} error=${err ? `${err.code} ${err.message}` : "none"}`
    );
  }

  function rejectionText(reason: unknown) {
    if (reason instanceof Error) return `${reason.name} ${reason.message}`;
    return String(reason);
  }

  function rememberStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    markLoginWelcomeShownThisSession();
  }

  function finish() {
    if (settledRef.current) return;
    settledRef.current = true;
    startedRef.current = true;
    dispatch({ type: "settled", at: now() });
    markLoginWelcomeShownThisSession();
    router.replace(nextHrefRef.current);
  }

  /** Feed one event to the fallback machine and run whatever it asks for. */
  function dispatch(event: WelcomeEvent) {
    const before = machineRef.current;
    const { state, effects } = reduceWelcome(before, event);
    machineRef.current = state;
    // Progress events arrive several times a second; only re-render when
    // what is on screen can actually change.
    if (state.phase !== before.phase || state.failure !== before.failure) setWelcome(state);
    for (const effect of effects) runEffect(effect);
  }

  function runEffect(effect: WelcomeEffect) {
    const v = videoRef.current;
    if (!v || settledRef.current) return;
    // Each rejection carries the attempt id it belongs to, so a result from an
    // attempt that a newer one has since replaced (e.g. aborted by load()) is
    // ignored by the machine instead of triggering a muted retry or the overlay.
    if (effect.kind === "play-unmuted") {
      // One unmuted attempt per load. Do not retry it, and do not unmute later.
      if (v.error) v.load();
      logVideo("ready", v);
      v.muted = false;
      logVideo("before-unmuted-play", v);
      v.play()
        .then(() => {
          console.log("[login-welcome] unmuted-play SUCCESS");
          logVideo("after-unmuted-play", videoRef.current);
        })
        .catch((reason: unknown) => {
          console.log(`[login-welcome] unmuted-play REJECTED ${rejectionText(reason)}`);
          dispatch({ type: "unmuted-rejected", at: now(), attempt: effect.attempt });
        });
      return;
    }
    // The same video, muted, after the sound attempt was refused.
    v.muted = true;
    console.log("[login-welcome] fallback-muted-play");
    logVideo("before-muted-play", v);
    v.play()
      .then(() => {
        console.log("[login-welcome] muted-play SUCCESS");
        logVideo("after-muted-play", videoRef.current);
      })
      .catch((mutedReason: unknown) => {
        console.log(`[login-welcome] muted-play REJECTED ${rejectionText(mutedReason)}`);
        logVideo("muted-play-failed", videoRef.current);
        dispatch({ type: "muted-rejected", at: now(), attempt: effect.attempt });
      });
  }

  function handleCanPlay() {
    logVideo("event canplay", videoRef.current);
    dispatch({ type: "canplay", at: now() });
  }

  /** loadstart / progress / loadedmetadata / loadeddata / … — the video is alive. */
  function handleProgress() {
    dispatch({ type: "progress", at: now() });
  }

  function handleWaiting() {
    logVideo("event waiting", videoRef.current);
    dispatch({ type: "waiting", at: now() });
  }

  function handleStalled() {
    logVideo("event stalled", videoRef.current);
    dispatch({ type: "stalled", at: now() });
  }

  function handlePlaying() {
    logVideo("event playing", videoRef.current);
    rememberStarted();
    dispatch({ type: "playing", at: now() });
  }

  function handlePause() {
    logVideo("event pause", videoRef.current);
  }

  function handleEnded() {
    logVideo("event ended", videoRef.current);
    finish();
  }

  function handleError() {
    logVideo("event error", videoRef.current);
    if (startedRef.current || settledRef.current) return;
    dispatch({ type: "error", at: now() });
  }

  function playFromTap() {
    // Not gated on startedRef: the overlay can also appear after playback
    // started and then froze, and Play must be able to resume it.
    if (settledRef.current) return;
    if (!videoRef.current) return;
    dispatch({ type: "tap-play", at: now() });
  }

  if (!ready) {
    return <main className="min-h-screen bg-black" />;
  }

  return (
    <main className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={LOGIN_WELCOME_VIDEO_URL}
        // Android WebView paints its stock grey play-circle on any <video>
        // without a poster until the first frame arrives (a visible flash on
        // every launch). A transparent poster over the black page replaces it.
        poster="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
        className="h-full w-full bg-black object-contain"
        playsInline
        preload="auto"
        autoPlay
        controls={false}
        onLoadStart={handleProgress}
        onProgress={handleProgress}
        onLoadedMetadata={handleProgress}
        onLoadedData={handleProgress}
        onDurationChange={handleProgress}
        onCanPlayThrough={handleProgress}
        onTimeUpdate={handleProgress}
        onWaiting={handleWaiting}
        onStalled={handleStalled}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
      />
      {needsGesture ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/55 px-6 text-center">
          {loadFailed ? (
            <p role="alert" className="max-w-xs font-classic-body text-sm text-white/80">
              The welcome video couldn&apos;t load right now.
            </p>
          ) : null}
          <button
            type="button"
            aria-label="Play the welcome video"
            className="min-h-[48px] min-w-[8rem] rounded-full bg-white px-8 font-classic-body text-base font-semibold text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            onClick={playFromTap}
          >
            Play
          </button>
          <button
            type="button"
            className="min-h-[48px] px-6 font-classic-body text-sm text-white/75 underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            onClick={finish}
          >
            Continue
          </button>
        </div>
      ) : null}
    </main>
  );
}
