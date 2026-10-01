"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { postAuthDestination } from "@/lib/auth/postAuthDestination";
import { markLoginWelcomeShownThisSession } from "@/lib/loginWelcome";
import { LOGIN_WELCOME_VIDEO_URL } from "@/content/loginWelcomeVideo";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

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
  const [playbackError, setPlaybackError] = useState(false);

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
    // Muted autoplay is what browsers allow without a tap. Unmuted-first
    // was rejected, and that rejection used to leave the page immediately.
    v.muted = true;
    v.play().catch(() => {
      if (!startedRef.current) setNeedsGesture(true);
    });
  }

  function handlePlaying() {
    rememberStarted();
    setNeedsGesture(false);
    setPlaybackError(false);
  }

  function handleError() {
    if (startedRef.current || settledRef.current) return;
    setPlaybackError(true);
    setNeedsGesture(true);
  }

  function playFromGesture() {
    const v = videoRef.current;
    if (!v) return;
    setNeedsGesture(false);
    if (v.error) v.load();
    v.muted = false;
    v.play().catch(() => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = true;
      el.play().catch(() => {
        if (!startedRef.current) setNeedsGesture(true);
      });
    });
  }

  if (!ready) {
    return <main className="min-h-screen bg-black" />;
  }

  return (
    <main className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={LOGIN_WELCOME_VIDEO_URL}
        className="h-full w-full object-contain"
        playsInline
        muted
        preload="auto"
        autoPlay
        controls={false}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onEnded={finish}
        onError={handleError}
      />
      {needsGesture ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 px-6">
          {playbackError ? (
            <p className={`${TEXT.body} text-center text-white`}>
              The welcome video couldn&apos;t start.
            </p>
          ) : null}
          <Button tone="premium" onClick={playFromGesture}>
            Play
          </Button>
          {playbackError ? (
            <Button tone="premium" variant="ghost" onClick={() => router.replace(nextHrefRef.current)}>
              Continue
            </Button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
