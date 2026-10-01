"use client";

import { OllieNote } from "@/components/ollie/OllieNote";
import { useMode } from "@/lib/mode/useMode";
import { getOllieHomeLine } from "@/lib/home/ollieHomeLine";
import type { BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";

/**
 * Client wrapper around OllieNote that re-tones Home's Ollie line for the
 * active presentation mode (Phase 2). `defaultLine` is the server-computed
 * classic-pro text (getOllieHomeLine() with no mode) and is what renders on
 * first paint — matching useMode()'s own "default on server, corrected in
 * an effect" pattern, so there is no hydration mismatch. Once useMode()
 * reports a real mode (kids/adult), the SAME deterministic function is
 * re-called client-side with the identical action/buddy/neutralTone inputs
 * to get that mode's tone — no new data, no AI, no network call.
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
  const { mode } = useMode();
  const line =
    mode === "classic-pro" ? defaultLine : getOllieHomeLine(action, buddy, neutralTone, mode);

  return (
    <OllieNote buddyEmoji={buddy.emoji} className="home-ollie-note">
      {line}
    </OllieNote>
  );
}
