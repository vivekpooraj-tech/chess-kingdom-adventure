"use client";

import { OllieNote } from "@/components/ollie/OllieNote";
import { useModeVariant } from "@/lib/mode/useModeVariant";
import { getOllieHomeLine } from "@/lib/home/ollieHomeLine";
import type { BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";

/**
 * Client wrapper around OllieNote that re-tones Home's Ollie line for the
 * active presentation mode (Phase 2). `defaultLine` is the server-computed
 * classic-pro text (getOllieHomeLine() with no mode) and is what renders on
 * first paint — matching useModeVariant()'s "default on server, corrected
 * in an effect" guarantee, so there is no hydration mismatch. Once the real
 * mode is known, the SAME deterministic function is re-called client-side
 * with the identical action/buddy/neutralTone inputs to get that mode's
 * tone — no new data, no AI, no network call. Built on useModeVariant()
 * (Phase 2.1-A) rather than its own inline useMode() branch, so this and
 * HomeModePresentation share the one hydration-safety mechanism.
 */
export function OllieModeLine({
  action,
  buddy,
  neutralTone,
  defaultLine,
}: {
  action: PrimaryAction;
  buddy: BuddyOption;
  neutralTone: boolean;
  defaultLine: string;
}) {
  const line = useModeVariant({
    "classic-pro": defaultLine,
    adult: getOllieHomeLine(action, buddy, neutralTone, "adult"),
    kids: getOllieHomeLine(action, buddy, neutralTone, "kids"),
  });

  return (
    <OllieNote buddyEmoji={buddy.emoji} className="home-ollie-note">
      {line}
    </OllieNote>
  );
}
