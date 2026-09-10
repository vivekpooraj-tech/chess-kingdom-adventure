"use client";

import { TEXT } from "@/lib/designSystem";
import { useChessTimeOptional } from "./ChessTimeProvider";

export function ChessTimeBanner() {
  const chessTime = useChessTimeOptional();
  if (!chessTime?.session?.active) return null;

  if (chessTime.expired) {
    return (
      <div
        className="chess-time-banner sticky top-0 z-40 w-full border-b border-premium-gold/30 bg-premium-gold/10 backdrop-blur-md px-[var(--screen-gutter)] py-2"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold">
              ♟ Chess Time complete
            </p>
            <p className={`${TEXT.caption} normal-case text-premium-ivory/85 truncate`}>
              Great job today — a parent can exit with their PIN.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chess-time-banner sticky top-0 z-40 w-full border-b border-premium-gold/25 bg-premium-midnightDeep/95 backdrop-blur-md px-[var(--screen-gutter)] py-2"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold">
            ♟ Chess Time
          </p>
          <p className={`${TEXT.caption} normal-case text-premium-ivory/80 truncate`}>
            Focus Mode keeps Chess Mind focused — not other apps on your device.
          </p>
        </div>
        <p className="font-classic-display text-lg tabular-nums text-premium-ivory flex-none">
          {chessTime.remainingLabel}
        </p>
      </div>
    </div>
  );
}

export function ScreenPinningGuide() {
  const chessTime = useChessTimeOptional();
  const caps = chessTime?.capabilities;

  return (
    <section className="w-full rounded-premiumCard border border-premium-gold/20 bg-premium-navy/60 p-5 flex flex-col gap-3">
      <h2 className={TEXT.heading}>How to keep your child focused on the device</h2>
      <p className={TEXT.body}>
        Chess Time keeps navigation inside Chess Mind. For stronger device-level focus, use your
        tablet&apos;s built-in tools — steps may vary by phone manufacturer.
      </p>

      {caps?.platform === "android" && (
        <ol className={`${TEXT.body} list-decimal pl-5 flex flex-col gap-2`}>
          <li>Start Chess Time in this app.</li>
          <li>Open Settings → Security (or Privacy) → Screen Pinning / App Pinning.</li>
          <li>Turn on pinning, then open Chess Mind and pin this app.</li>
          <li>Give the device to your child.</li>
        </ol>
      )}

      {caps?.platform === "ios" && (
        <p className={TEXT.body}>
          On iPhone or iPad, use <strong>Settings → Accessibility → Guided Access</strong> to lock
          the device to one app. Triple-click the side button to start and end Guided Access.
        </p>
      )}

      {caps?.platform === "web" && (
        <p className={TEXT.body}>
          In a browser, Chess Time only limits pages inside this site. Install the Chess Mind Android
          app for Screen Pinning guidance.
        </p>
      )}

      {caps?.lockTaskActive && (
        <p className="font-classic-body text-sm text-emerald-400">
          Your device appears to be using app pinning.
        </p>
      )}

      {!caps?.supportsTrueKioskMode && (
        <p className={`${TEXT.caption} normal-case italic`}>
          Full kiosk mode (blocking every other app automatically) requires a managed school device —
          not available in the standard Chess Mind app.
        </p>
      )}
    </section>
  );
}
