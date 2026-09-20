import type { BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";
import type { ModeId } from "@/lib/mode/modes";

/**
 * Deterministic Ollie copy for Home's hero — reuses the buddy persona without
 * any AI or extra backend calls. Presentation-only companion to
 * getPrimaryAction(), which stays unchanged.
 *
 * PHASE 2 — `mode` is an OPTIONAL third tone axis, additive on top of the
 * existing `neutralTone` branch (experience-level driven, unchanged):
 *   - omitted / "classic-pro"  -> exactly the pre-Phase-2 output (used for
 *     the server-rendered default, so Home's first paint never changes)
 *   - "kids"                   -> friendly/adventurous guide voice
 *   - "adult"                  -> coach/training-companion voice
 * Mode is not known at request time (see lib/mode/useMode.ts — it lives in
 * localStorage, not a cookie), so the server always computes the default
 * (classic) line; components/home/OllieModeLine.tsx re-calls this function
 * client-side, with the SAME action/buddy/neutralTone inputs, once the real
 * mode is known — the same "correct after hydration" pattern useMode()
 * itself uses for <html data-mode>.
 */
export function getOllieHomeLine(
  action: PrimaryAction,
  buddy: BuddyOption,
  neutralTone: boolean,
  mode?: ModeId
): string {
  const shortName = buddy.name.split(" ")[0];

  if (mode === "kids") {
    if (action.kind === "school") {
      return action.isFirstSession
        ? `${shortName} here! Your kingdom adventure begins with Chess School — let's go!`
        : `Onward! Session ${action.sessionNumber} of your Chess School quest awaits.`;
    }
    if (action.kind === "focus") {
      return `${action.skillName} showed up in a few of your games — let's turn it into a superpower!`;
    }
    if (action.kind === "practice" || action.kind === "puzzles") {
      return buddy.encouragement[0] ?? "A brand-new puzzle is waiting in the kingdom!";
    }
    if (action.kind === "academy") {
      return `Adventure calls! ${action.title} is next on your journey.`;
    }
    return buddy.greeting || "Ready for an adventure?";
  }

  if (mode === "adult") {
    if (action.kind === "school") {
      return action.isFirstSession
        ? "Your training begins with Chess School — session one is ready."
        : `Next in your program: Chess School, session ${action.sessionNumber}.`;
    }
    if (action.kind === "focus") {
      return `${action.skillName} is your current development focus — recurring across ${action.weakCount} reviewed games.`;
    }
    if (action.kind === "practice" || action.kind === "puzzles") {
      return "A focused set of puzzles is a strong way to open today's session.";
    }
    if (action.kind === "academy") {
      return `Recommended for today's session: ${action.title}.`;
    }
    return "Choose today's training focus below, or follow the recommendation.";
  }

  if (action.kind === "school") {
    if (neutralTone) {
      return action.isFirstSession
        ? "Your first Chess School session is ready when you are."
        : `Continue Chess School — ${action.title}.`;
    }
    return action.isFirstSession
      ? `${shortName} here! Let's start Chess School together.`
      : `Session ${action.sessionNumber} is next — you've got this!`;
  }

  if (action.kind === "focus") {
    return neutralTone
      ? `A good time to work on ${action.skillName}.`
      : `${action.skillName} came up a lot — let's sharpen it up together!`;
  }

  if (action.kind === "practice" || action.kind === "puzzles") {
    return neutralTone
      ? "A fresh puzzle is a great way to warm up."
      : buddy.encouragement[0] ?? "Let's solve a puzzle together!";
  }

  if (action.kind === "academy") {
    return neutralTone
      ? `${action.title} is a solid next step in the Academy.`
      : `The Academy has something great for you — ${action.title}!`;
  }

  return neutralTone
    ? "Pick an activity below, or follow today's recommendation."
    : buddy.greeting || "Ready when you are!";
}
