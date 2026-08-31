"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { FullscreenIcon, CloseIcon } from "@/components/nav/icons";

/**
 * The Discover → History of Chess player.
 *
 * Playback stays INLINE with the browser's own `<video controls>` bar —
 * native `<video>` fullscreen is off (`controlsList="nofullscreen"` + a
 * globals.css rule), because Capacitor's WebChromeClient can't host it and
 * Android's native fullscreen view drew its control bar flush against the
 * system navigation bar.
 *
 * Fullscreen instead uses the Web Fullscreen API on THIS wrapper element,
 * so the whole thing stays inside our own `env(safe-area-inset-*)` padding
 * (see `.history-video:fullscreen` in globals.css) and can't collide with
 * the system nav. Feature-detected — if the API is unavailable the button
 * simply isn't rendered and inline playback is unchanged.
 *
 * Every mount starts at 0:00 — no resume-from-last-position. Entering /
 * exiting fullscreen never remounts the <video>, so it keeps playing from
 * wherever it was.
 */
export function HistoryVideo({
  src,
  poster,
  orientation,
  captionsUrl,
  onProgress,
}: {
  src: string;
  poster?: string;
  orientation: "portrait" | "landscape";
  captionsUrl?: string | null;
  /** Fired ~every timeupdate with the current playback position (seconds). */
  onProgress?: (currentTimeSeconds: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    setFullscreenSupported(
      typeof document !== "undefined" &&
        document.fullscreenEnabled === true &&
        typeof HTMLElement.prototype.requestFullscreen === "function"
    );

    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      wrapperRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Start from the beginning on every visit. Forcing currentTime to 0 here
  // (rather than relying on the default) also defeats a WebView/bfcache
  // restoring a previous position on back-navigation.
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime > 0) v.currentTime = 0;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v) onProgress?.(v.currentTime);
  }, [onProgress]);

  return (
    <div
      ref={wrapperRef}
      data-fullscreen={isFullscreen ? "true" : undefined}
      className={clsx(
        "history-video relative overflow-hidden bg-premium-navy",
        !isFullscreen &&
          (orientation === "portrait"
            ? "mx-auto w-full max-w-[340px] rounded-premiumCard shadow-premiumCard aspect-[9/16] sm:max-w-[380px] lg:max-w-3xl lg:aspect-video"
            : "mx-auto w-full max-w-md rounded-premiumCard shadow-premiumCard aspect-video sm:max-w-xl lg:max-w-3xl")
      )}
    >
      {/* Blurred poster letterbox behind the clip on the wide (lg) inline
          frame only — a cinematic edge rather than dead black bars. */}
      {poster && orientation === "portrait" && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className="history-video__poster pointer-events-none absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-60 blur-xl lg:block"
        />
      )}

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        // Inline only — see the component doc comment.
        controlsList="nofullscreen noremoteplayback nodownload"
        disablePictureInPicture
        playsInline
        preload="metadata"
        className="video-inline history-video__el relative z-10 mx-auto h-full w-full bg-black object-cover lg:w-auto lg:bg-transparent lg:object-contain lg:shadow-premiumCard"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      >
        {captionsUrl && (
          <track kind="captions" src={captionsUrl} srcLang="en" label="English" default />
        )}
      </video>

      {fullscreenSupported && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={isFullscreen}
          className="history-video__fs absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-premiumBtn border border-white/15 bg-black/55 text-premium-ivory backdrop-blur-sm transition-colors hover:bg-black/75 hover:text-white active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/70"
        >
          {isFullscreen ? (
            <CloseIcon className="h-5 w-5" />
          ) : (
            <FullscreenIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
