"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { FullscreenIcon, ExitFullscreenIcon } from "@/components/nav/icons";

// Prefixed Fullscreen API members some Android WebViews still only expose.
type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function ignore(result: Promise<void> | void) {
  if (result && typeof (result as Promise<void>).then === "function") {
    (result as Promise<void>).catch(() => {});
  }
}

/**
 * The Discover → History of Chess player.
 *
 * Playback stays INLINE with the browser's own `<video controls>` bar —
 * native `<video>` fullscreen is off (`controlsList="nofullscreen"` + a
 * globals.css rule), because Capacitor's WebChromeClient can't host it and
 * Android's native fullscreen view drew its control bar flush against the
 * system navigation bar.
 *
 * Fullscreen instead uses the Web Fullscreen API on THIS wrapper element
 * (standard + WebKit-prefixed), so the whole surface stays inside a padded
 * inner stage — `.history-video[data-fullscreen]` in globals.css — and can't
 * collide with the system nav. Feature-detected: no button if unsupported.
 *
 * Sizing is CSS-driven (`.history-video--inline[data-orientation]`), not JS,
 * so device rotation never touches React state or remounts the <video>.
 * Every mount starts at 0:00; entering / exiting fullscreen and rotating
 * never reset playback.
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const d = document as FsDocument;
    const proto = HTMLElement.prototype as FsElement;

    setFullscreenSupported(
      (d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true) &&
        (typeof proto.requestFullscreen === "function" ||
          typeof proto.webkitRequestFullscreen === "function")
    );

    // Android WebViews are inconsistent about which of these two events
    // fires — listen for both, and read whichever fullscreen-element
    // property the runtime exposes.
    function syncFullscreen() {
      const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
      setIsFullscreen(fsEl === wrapperRef.current);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const d = document as FsDocument;
    const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
    if (fsEl) {
      const exit = d.exitFullscreen ?? d.webkitExitFullscreen;
      if (exit) ignore(exit.call(document));
      return;
    }
    const el = wrapperRef.current as FsElement | null;
    if (!el) return;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (request) ignore(request.call(el));
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
      data-orientation={orientation}
      data-fullscreen={isFullscreen ? "true" : undefined}
      className={clsx(
        "history-video relative overflow-hidden bg-premium-navy",
        !isFullscreen && "history-video--inline mx-auto w-full rounded-premiumCard shadow-premiumCard"
      )}
    >
      {/* The stage is a plain descendant, so in fullscreen it can be padded
          to keep the <video> (and its native control bar) clear of the
          system bars — the fullscreened wrapper itself is locked edge-to-
          edge by the browser's UA rules. */}
      <div className="history-video__stage absolute inset-0 flex items-center justify-center">
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
          onError={() => setFailed(true)}
        >
          {captionsUrl && (
            <track kind="captions" src={captionsUrl} srcLang="en" label="English" default />
          )}
        </video>
      </div>

      {failed && (
        <div
          role="status"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-premium-midnightDeep/85 px-6 text-center backdrop-blur-sm"
        >
          <span className="text-3xl" aria-hidden="true">
            🏛️
          </span>
          <p className="font-classic-body text-sm text-premium-ivory/80">
            The video couldn&apos;t load right now — the timeline below still has the whole story.
          </p>
        </div>
      )}

      {fullscreenSupported && !failed && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={isFullscreen}
          className="history-video__fs absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-premiumBtn border border-white/15 bg-black/55 text-premium-ivory backdrop-blur-sm transition-colors hover:bg-black/75 hover:text-white active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/70"
        >
          {isFullscreen ? (
            <ExitFullscreenIcon className="h-5 w-5" />
          ) : (
            <FullscreenIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
