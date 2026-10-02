"use client";

import { useEffect, useState } from "react";
import { TEXT } from "@/lib/designSystem";
import { ParentPinSetup } from "@/components/parentLock/ParentPinForms";
import { useChessTime } from "@/components/parentLock/ChessTimeProvider";
import {
  hasSeenParentDashboardPinPrompt,
  markParentDashboardPinPromptSeen,
} from "@/lib/parentLock/storage";

/**
 * Shown once on the first visit to the Parent Dashboard when no Parent PIN
 * exists yet. Registration does not collect a PIN — this is the natural place
 * a parent lands after More → For Parents.
 */
export function ParentDashboardFirstPinSetup() {
  const { pinConfigured } = useChessTime();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pinConfigured) {
      markParentDashboardPinPromptSeen();
      return;
    }
    if (!hasSeenParentDashboardPinPrompt()) {
      setShow(true);
    }
  }, [pinConfigured]);

  function dismiss() {
    markParentDashboardPinPromptSeen();
    setShow(false);
  }

  if (!show || pinConfigured) return null;

  return (
    <section
      className="w-full flex flex-col gap-4 rounded-premiumCard border border-premium-gold/30 bg-gradient-to-br from-premium-navyLight/40 via-premium-navy to-premium-midnight p-5 shadow-premiumGlow"
      aria-labelledby="parent-pin-first-setup-title"
    >
      <div className="flex flex-col gap-2">
        <p className={`${TEXT.meta} text-premium-gold`}>First time here</p>
        <h2 id="parent-pin-first-setup-title" className={TEXT.heading}>
          Set up your Parent PIN
        </h2>
        <p className={TEXT.body}>
          A 4–6 digit PIN keeps screen time limits and parent settings behind a grown-up
          check. It stays on this device only.
        </p>
      </div>
      <ParentPinSetup onComplete={dismiss} />
      <button
        type="button"
        onClick={dismiss}
        className="self-center min-h-[44px] px-4 font-classic-body text-sm text-premium-ivory/60 underline-offset-4 hover:text-premium-ivory hover:underline"
      >
        Skip for now
      </button>
    </section>
  );
}
