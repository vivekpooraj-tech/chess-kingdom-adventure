"use client";

import type { ReactNode } from "react";
import type { WatchPlayer } from "@/lib/watch/lichess";

/** LIVE is a dot AND the word, never colour alone. */
export function LiveBadge({ live = true }: { live?: boolean }) {
  return live ? (
    <span className="wt-live">
      <span className="wt-live__dot" aria-hidden="true" />
      LIVE
    </span>
  ) : (
    <span className="wt-live wt-live--done">FINISHED</span>
  );
}

export function PlayerLine({ p }: { p: WatchPlayer }) {
  return (
    <span className="wt-player">
      {p.title && <abbr className="wt-title" title={p.title}>{p.title}</abbr>}
      <span className="wt-player__name">{p.name}</span>
      {p.rating !== undefined && <span className="wt-rating">{p.rating}</span>}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  onRetry,
}: {
  tone?: "info" | "error";
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="wt-notice" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <p className="wt-notice__title">{title}</p>
      {children && <p className="wt-notice__body">{children}</p>}
      {onRetry && (
        <button type="button" className="wt-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
