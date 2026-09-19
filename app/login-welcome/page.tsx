"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { postAuthDestination } from "@/lib/auth/postAuthDestination";
import { markLoginWelcomeShownThisSession } from "@/lib/loginWelcome";
import { LOGIN_WELCOME_VIDEO_URL } from "@/content/loginWelcomeVideo";

/**
 * Video 2 — the returning-user welcome animation. Reached from exactly two
 * places, never navigated to directly by any in-app link or nav item:
 *
 *  - app/parent-gate/page.tsx  (Trigger A: a genuine sign-out-then-sign-in)
 *  - app/page.tsx              (Trigger B: a genuine cold app launch)
 *
 * Structurally a near-twin of app/onboarding/opening/page.tsx (same
 * autoplay-with-audio attempt, same exactly-once settle() guard, same
 * graceful fallback on error) but with ONE deliberate difference: this
 * page writes NO database flag. Video 1's has_seen_opening_video is a
 * once-ever-per-child fact; Video 2 is a once-per-login-event moment, and
 * its only "seen" bookkeeping is the sessionStorage guard in
 * lib/loginWelcome.ts, set here so a stray later revisit of "/" in the same
 * browser/WebView session can't also replay it via Trigger B.
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
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextHrefRef = useRef<string>("/kingdom-map");
  const settledRef = useRef(false);
  const [videoVisible, setVideoVisible] = useState(false);

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

  function settle() {
    if (settledRef.current) return;
    settledRef.current = true;
    markLoginWelcomeShownThisSession();
    router.replace(nextHrefRef.current);
  }

  function handleVideoReady() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      if (!videoRef.current) return;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {
        setVideoUnavailable(true);
      });
    });
  }

  // Same rule as the opening video: no generic timeout marks this settled —
  // only a genuine onEnded, or a genuine unrecoverable error via this
  // fallback path.
  function handleUnavailable() {
    setVideoUnavailable(true);
  }

  function handlePlaying() {
    setVideoVisible(true);
  }

  useEffect(() => {
    if (videoUnavailable) settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUnavailable]);

  if (!ready) {
    return <main className="min-h-screen bg-premium-midnightDeep" />;
  }

  return (
    <main className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {videoUnavailable ? null : (
        <video
          ref={videoRef}
          src={LOGIN_WELCOME_VIDEO_URL}
          className={`h-full w-full object-contain transition-opacity duration-150 ${videoVisible ? "opacity-100" : "opacity-0"}`}
          playsInline
          preload="auto"
          autoPlay
          controls={false}
          onCanPlay={handleVideoReady}
          onPlaying={handlePlaying}
          onEnded={settle}
          onError={handleUnavailable}
        />
      )}
    </main>
  );
}
