"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, markOpeningVideoSeen } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { shouldSkipWelcome } from "@/lib/learner/experienceLevel";
import { OPENING_VIDEO_URL } from "@/content/openingVideo";

/**
 * First-time cinematic opening (brand logo reveal), shown exactly once per
 * child, right after the final onboarding step (app/onboarding/pieces) and
 * before whatever it would otherwise have sent them to.
 *
 * Deliberately hands off to the SAME destination pieces already resolved
 * (shouldSkipWelcome ? "/kingdom-map" : "/welcome") rather than hardcoding
 * "/kingdom-map" — this is a splash inserted in front of the existing
 * funnel, not a new branch of it. /welcome's own one-time-video logic
 * (Chess Origins) is untouched and still runs normally afterward for
 * learners who haven't skipped it.
 *
 * Persistence mirrors every other onboarding field on this table
 * (avatar_id, buddy_id, experience_level, ...): a boolean column on
 * `children`, read as part of the normal profile resolve, written once via
 * markOpeningVideoSeen(). A returning user's child row already has it
 * `true`, so this page redirects before ever mounting a <video> — no flash.
 */
export default function OpeningVideoPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextHrefRef = useRef<string>("/kingdom-map");
  // Guards against onEnded firing more than once, and against onError firing
  // after onEnded already ran (or vice versa) — either path writes the seen
  // flag and navigates AT MOST once.
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
      if (resolution.needsSelection) {
        router.replace("/choose-child");
        return;
      }
      const child = resolution.child;
      if (!child) {
        router.replace("/choose-child");
        return;
      }
      if (cancelled) return;

      const next = shouldSkipWelcome(child.experience_level) ? "/kingdom-map" : "/welcome";
      nextHrefRef.current = next;

      // Returning user (or a re-visit within the same session) — the video
      // has already been shown. Redirect immediately, never render it again.
      if (child.has_seen_opening_video) {
        router.replace(next);
        return;
      }

      setChildId(child.id);
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function settle() {
    if (settledRef.current) return;
    settledRef.current = true;
    if (childId) {
      // Best-effort: a failed write here must never trap the user on this
      // screen. Worst case (rare: a network blip on this one write) is the
      // video plays once more on a future login — never a broken flow.
      await markOpeningVideoSeen(createClient(), childId).catch(() => {});
    }
    router.replace(nextHrefRef.current);
  }

  function handleVideoReady() {
    const v = videoRef.current;
    if (!v) return;
    // Attempt autoplay WITH the video's existing audio first, per spec.
    // Browsers that block unmuted autoplay reject this promise (typically
    // NotAllowedError) rather than throwing synchronously — fall back to a
    // muted attempt so the cinematic still plays visually; playback
    // continuing without sound is a graceful degradation, not a broken flow.
    v.muted = false;
    v.play().catch(() => {
      if (!videoRef.current) return;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {
        // Even muted autoplay was blocked (rare, but some embedded WebViews
        // do this). Treat exactly like an unavailable video: fall through
        // to Home/Welcome rather than showing a stalled black screen.
        setVideoUnavailable(true);
      });
    });
  }

  // Deliberately NO generic timeout that marks this seen just because
  // loading is slow — only a genuine onEnded or a genuine onError (via
  // handleUnavailable) ever calls settle().
  function handleUnavailable() {
    setVideoUnavailable(true);
  }

  // videoUnavailable is its own effect (rather than calling settle() right
  // in the event handlers above) so it also covers the "couldn't even start
  // playback" fallback path from handleVideoReady, with the same
  // exactly-once guard.
  useEffect(() => {
    if (videoUnavailable) settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUnavailable]);

  if (!ready) {
    // Same neutral, un-flashy hold used by "/" and "/welcome" while
    // resolving the session — indistinguishable from a brief load, never a
    // visible blank flash before the video (or the redirect) takes over.
    return <main className="min-h-screen bg-premium-midnightDeep" />;
  }

  return (
    <main className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {videoUnavailable ? null : (
        <video
          ref={videoRef}
          src={OPENING_VIDEO_URL}
          className={`h-full w-full object-contain bg-black transition-opacity duration-150 ${
            videoVisible ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
          playsInline
          preload="auto"
          autoPlay
          controls={false}
          onCanPlay={handleVideoReady}
          onPlaying={() => setVideoVisible(true)}
          onEnded={settle}
          onError={handleUnavailable}
        />
      )}
    </main>
  );
}
