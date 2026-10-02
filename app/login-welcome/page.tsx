"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { postAuthDestination } from "@/lib/auth/postAuthDestination";
import { markLoginWelcomeShownThisSession } from "@/lib/loginWelcome";
import { LOGIN_WELCOME_VIDEO_URL } from "@/content/loginWelcomeVideo";

const STALL_MS = 8000;

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
 * both attempts fail, the file errors, or nothing has started after
 * STALL_MS — and the page never moves on by itself in that state.
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
  const [needsGesture, setNeedsGesture] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextHrefRef = useRef<string>("/kingdom-map");
  const settledRef = useRef(false);
  const startedRef = useRef(false);
  const autoplayAttemptedRef = useRef(false);

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

  // If nothing has started a while after the page is ready (slow network, a
  // stalled decoder, an autoplay policy that never answers), surface the
  // Play / Continue controls instead of leaving a black screen. This never
  // navigates on its own.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      if (!startedRef.current && !settledRef.current) setNeedsGesture(true);
    }, STALL_MS);
    return () => window.clearTimeout(t);
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
    markLoginWelcomeShownThisSession();
    router.replace(nextHrefRef.current);
  }

  function handleCanPlay() {
    if (autoplayAttemptedRef.current || startedRef.current) return;
    autoplayAttemptedRef.current = true;
    const v = videoRef.current;
    if (!v) return;
    // One unmuted attempt. Do not retry it, and do not unmute later.
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
        playMutedFallback();
      });
  }

  /** The same video, muted, after the sound attempt was refused. */
  function playMutedFallback() {
    const v = videoRef.current;
    if (!v || startedRef.current) return;
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
        if (!startedRef.current) setNeedsGesture(true);
      });
  }

  function handlePlaying() {
    logVideo("event playing", videoRef.current);
    rememberStarted();
    setNeedsGesture(false);
    setLoadFailed(false);
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
    setLoadFailed(true);
    setNeedsGesture(true);
  }

  function playFromTap() {
    if (startedRef.current || settledRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    setNeedsGesture(false);
    setLoadFailed(false);
    if (v.error) v.load();
    v.muted = false;
    v.play().catch(() => playMutedFallback());
  }

  if (!ready) {
    return <main className="min-h-screen bg-black" />;
  }

  return (
    <main className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={LOGIN_WELCOME_VIDEO_URL}
        className="h-full w-full bg-black object-contain"
        playsInline
        preload="auto"
        autoPlay
        controls={false}
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
