"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HISTORY_OF_CHESS } from "@/content/academyVideos";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getAcademyProgress,
  saveAcademyVideoProgress,
  completeAcademyContent,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { shouldSkipWelcome } from "@/lib/learner/experienceLevel";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { Button, IconButton } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/branding/Logo";
import {
  PlayIcon,
  PauseIcon,
  SoundOnIcon,
  SoundOffIcon,
  FullscreenIcon,
} from "@/components/nav/icons";

type Stage = "loading" | "welcome" | "video" | "outro";

/**
 * First-time cinematic introduction (Phase 12) — reuses the exact same
 * Chess Origins video/content (content/academyVideos.ts) and the exact
 * same child_academy_progress table the permanent Academy → Chess Origins
 * page already writes to (lib/supabase/queries.ts). A row for this
 * content id, in ANY status, is treated as "this child has already been
 * shown the origins content" — first-time cinematic or a later Academy
 * visit, doesn't matter which — so this never shows twice for the same
 * child and never needs a second, parallel tracking mechanism. Tracking
 * is per-child by construction (child_academy_progress is keyed by
 * child_id), so siblings on the same account are unaffected by each
 * other's progress.
 */
export default function WelcomePage() {
  const router = useRouter();
  const content = HISTORY_OF_CHESS;

  const [childId, setChildId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoUnavailable, setVideoUnavailable] = useState(!content.videoUrl);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seenWrittenRef = useRef(false);

  useEffect(() => {
    setFullscreenSupported(typeof document !== "undefined" && document.fullscreenEnabled === true);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setChildId(child.id);

      if (shouldSkipWelcome(child.experience_level)) {
        router.replace("/kingdom-map");
        return;
      }

      // Any existing row for this content — regardless of status — means
      // this child has already been shown it. Never auto-display twice.
      const alreadySeen = await getAcademyProgress(supabase, child.id, content.id).catch(
        () => null
      );
      if (alreadySeen) {
        router.replace("/kingdom-map");
        return;
      }
      setStage("welcome");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function markSeen() {
    if (seenWrittenRef.current || !childId) return;
    seenWrittenRef.current = true;
    // quizScore: null — this flow never asks a quiz question, unlike the
    // permanent Academy version of this same content.
    await completeAcademyContent(createClient(), childId, content.id, null).catch(() => {});
  }

  function handleTimeUpdate() {
    if (!childId || !videoRef.current) return;
    const t = Math.floor(videoRef.current.currentTime);
    if (t > 0 && t % 5 === 0) {
      saveAcademyVideoProgress(createClient(), childId, content.id, t).catch(() => {});
    }
  }

  function handleVideoReady() {
    if (!videoRef.current) return;
    // Attempt muted autoplay only — never with sound. Browsers reliably
    // allow this; if it's still blocked for some reason, the visible
    // Play control below still works.
    videoRef.current.muted = true;
    setMuted(true);
    videoRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleSound() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }

  function handleVideoEnded() {
    setPlaying(false);
    markSeen();
    setStage("outro");
  }

  function handleSkip() {
    markSeen();
    setStage("outro");
  }

  function enterKingdom() {
    router.push("/kingdom-map");
  }

  if (!childId || stage === "loading") {
    return <main className="min-h-screen bg-premium-midnightDeep" />;
  }

  return (
    <ScreenTimeGate childId={childId}>
      <main className="min-h-screen bg-premium-midnightDeep flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {stage === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <Logo variant="full" size={260} />
              <p className={`${TEXT.body} mt-4`}>
                Every kingdom has an origin. Before your journey begins, discover where the game
                itself began.
              </p>
              <Button tone="premium" className="mt-8" onClick={() => setStage("video")}>
                Begin →
              </Button>
            </motion.div>
          )}

          {stage === "video" && (
            <motion.div
              key="video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-3xl flex flex-col items-center gap-4"
            >
              <div
                ref={containerRef}
                className="relative w-full aspect-video bg-black rounded-premiumCard overflow-hidden shadow-premiumGlow"
              >
                {videoUnavailable ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-premium-navyLight to-premium-midnightDeep text-center px-6">
                    <p className={`${TEXT.meta} text-premium-gold`}>Chess Origins</p>
                    <p className={TEXT.body}>
                      The cinematic isn't ready yet — but your journey doesn't have to wait.
                    </p>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    src={content.videoUrl!}
                    playsInline
                    onCanPlay={handleVideoReady}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                    onError={() => setVideoUnavailable(true)}
                    className="w-full h-full object-cover"
                  >
                    {content.captionsUrl && (
                      <track kind="captions" src={content.captionsUrl} srcLang="en" label="English" default />
                    )}
                  </video>
                )}

                <button
                  onClick={handleSkip}
                  aria-label="Skip intro"
                  className="absolute top-3 right-3 font-classic-body text-xs text-premium-ivory/70 hover:text-premium-ivory bg-black/40 rounded-full px-3 py-1.5 border border-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
                >
                  Skip Intro
                </button>

                {!videoUnavailable && (
                  <div className="absolute bottom-0 inset-x-0 flex items-center gap-2 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <IconButton label={playing ? "Pause" : "Play"} tone="premium" onClick={togglePlay}>
                      {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                    </IconButton>

                    {muted ? (
                      <button
                        onClick={toggleSound}
                        className="flex items-center gap-1.5 rounded-full bg-premium-gold/15 border border-premium-gold/40 text-premium-gold px-3 py-1.5 font-classic-body text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
                      >
                        <SoundOffIcon className="w-4 h-4" /> Sound On
                      </button>
                    ) : (
                      <IconButton label="Mute" tone="premium" onClick={toggleSound}>
                        <SoundOnIcon className="w-4 h-4" />
                      </IconButton>
                    )}

                    <div className="flex-1" />

                    {fullscreenSupported && (
                      <IconButton label="Fullscreen" tone="premium" onClick={toggleFullscreen}>
                        <FullscreenIcon className="w-4 h-4" />
                      </IconButton>
                    )}
                  </div>
                )}
              </div>

              {videoUnavailable && (
                <Button tone="premium" onClick={handleSkip}>
                  Continue →
                </Button>
              )}
            </motion.div>
          )}

          {stage === "outro" && (
            <motion.div
              key="outro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <p className={`${TEXT.meta} text-premium-gold`}>Chess Origins</p>
              <h1 className={`${TEXT.display} mt-2`}>The game is thousands of years old.</h1>
              <p className={`${TEXT.heading} mt-1`}>Now your journey begins.</p>
              <Button tone="premium" className="mt-8" onClick={enterKingdom}>
                Enter {BRAND.name} →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </ScreenTimeGate>
  );
}
